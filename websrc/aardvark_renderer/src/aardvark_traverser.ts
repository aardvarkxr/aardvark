import { CRendererEndpoint } from '@aardvarkxr/aardvark-react';
import { CGrabStateProcessor } from './grab_state_processor';
import { mat4, vec3, quat, vec4, mat3 } from '@tlaukkan/tsm';
import bind from 'bind-decorator';
import { endpointAddrToString, endpointAddrIsEmpty, MessageType, MsgNodeHaptic, 
	MsgAttachGadgetToHook, MsgDetachGadgetFromHook, AvGrabEventType, AvNode, 
	ENodeFlags, AvNodeTransform, AvConstraint, AvNodeType, EHand, EVolumeType, 
	AvGrabEvent, MsgUpdateSceneGraph, EndpointType, MsgGrabEvent, endpointAddrsMatch, 
	MsgUpdateActionState, EndpointAddr, Av, AvModelInstance, MsgDestroyGadget, g_builtinModelPanel, g_builtinModelPanelInverted, g_builtinModelCylinder, AvActionState, EAction, getActionFromState, emptyActionState } from '@aardvarkxr/aardvark-shared';
import { computeUniverseFromLine, nodeTransformToMat4, translateMat, nodeTransformFromMat4, vec3MultiplyAndAdd, scaleAxisToFit, scaleMat, minIgnoringNulls } from './traverser_utils';
const equal = require( 'fast-deep-equal' );

interface NodeData
{
	lastModelUri?: string;
	modelInstance?: AvModelInstance;
	grabberProcessor?: CGrabStateProcessor;
	lastParentFromNode?: mat4;
	constraint?: AvConstraint;
	lastFlags?: ENodeFlags;
	lastFrameUsed: number;
}



interface TransformComputeFunction
{
	( universeFromParents: mat4[], parentFromNode: mat4 ): mat4;
}

class PendingTransform
{
	private m_needsUpdate = true;
	private m_parents: PendingTransform[] = null;
	private m_parentFromNode: mat4 = null;
	private m_universeFromNode: mat4 = null;
	private m_applyFunction: (universeFromNode: mat4) => void = null;
	private m_computeFunction: TransformComputeFunction = null;
	private m_currentlyResolving = false;

	public resolve()
	{
		if( this.m_universeFromNode )
		{
			return;
		}

		if( this.m_needsUpdate )
		{
			console.log( "Pending transform needs an update in resolve");
			this.m_parentFromNode = mat4.identity;
		}
		
		if( this.m_currentlyResolving )
		{
			throw "Loop in pending transform parents";
		}

		this.m_currentlyResolving = true;

		if( this.m_parents )
		{
			let universeFromParents: mat4[] = [];
			for( let parent of this.m_parents )
			{
				parent.resolve();
				universeFromParents.push( parent.m_universeFromNode );
			}

			if( this.m_computeFunction )
			{
				this.m_universeFromNode = this.m_computeFunction( universeFromParents, 
					this.m_parentFromNode );
			}
			else
			{
				this.m_universeFromNode = new mat4;
				mat4.product( universeFromParents[ 0 ], this.m_parentFromNode, 
					this.m_universeFromNode );
			}
		}
		else
		{
			this.m_universeFromNode = this.m_parentFromNode;
		}

		this.m_currentlyResolving = false;

		if( this.m_applyFunction )
		{
			this.m_applyFunction( this.m_universeFromNode );
		}

	}

	public getUniverseFromNode():mat4
	{
		return this.m_universeFromNode;
	}
	public needsUpdate(): boolean
	{
		return this.m_needsUpdate;
	}
	public update( parents: PendingTransform[], parentFromNode: mat4, 
		updateCallback?: ( universeFromNode:mat4 ) => void,
		computeCallback?: TransformComputeFunction)
	{
		this.m_needsUpdate = false;
		this.m_parents = parents;
		this.m_parentFromNode = parentFromNode ? parentFromNode : mat4.identity;
		this.m_applyFunction = updateCallback;
		this.m_computeFunction = computeCallback;

		this.checkForLoops();
	}

	private checkForLoops()
	{
		if( !this.m_parents )
			return;

		for( let test = this.m_parents[0]; test != null; test = test.m_parents ? test.m_parents[0] : null )
		{
			if( test == this )
			{
				throw "Somebody created a loop in transform parents";
			}
		}
	}
}


interface NodeToNodeAnchor_t
{
	parentGlobalId: EndpointAddr;
	handleGlobalId?: EndpointAddr;
	grabberFromGrabbable: mat4;
	grabbableParentFromGrabbableOrigin?: mat4;
	anchorToRestore?: NodeToNodeAnchor_t;
}

interface AvNodeRoot
{
	gadgetId: number;
	root: AvNode;
	hook?: string | EndpointAddr;
	hookFromGadget?: AvNodeTransform;
	handIsRelevant: Set<EHand>;
}

export class AvDefaultTraverser
{
	private m_inFrameTraversal = false;
	private m_handDeviceForNode: { [nodeGlobalId:string]:EHand } = {};
	private m_currentHand = EHand.Invalid;
	private m_currentVisibility = true;
	private m_currentGrabbableGlobalId:EndpointAddr = null;
	private m_universeFromNodeTransforms: { [ nodeGlobalId:string ]: PendingTransform } = {};
	private m_nodeData: { [ nodeGlobalId:string ]: NodeData } = {};
	private m_lastFrameUniverseFromNodeTransforms: { [ nodeGlobalId:string ]: mat4 } = {};
	private m_roots: { [gadgetId:number] : AvNodeRoot } = {};
	private m_currentRoot: AvNodeRoot = null;
	private m_renderList: AvModelInstance[] = [];
	private m_nodeToNodeAnchors: { [ nodeGlobalId: string ]: NodeToNodeAnchor_t } = {};
	private m_hooksInUse: EndpointAddr[] = [];
	private m_endpoint: CRendererEndpoint = null;
	private m_grabEventsToProcess: AvGrabEvent[] = [];
	private m_grabEventTimer: number = -1;
	private m_frameNumber: number = 1;
	private m_actionState: { [ hand: number ] : AvActionState } = {};

	constructor()
	{
		this.m_endpoint = new CRendererEndpoint( this.onEndpointOpen );
		this.m_endpoint.registerHandler( MessageType.UpdateSceneGraph, this.onUpdateSceneGraph )
		this.m_endpoint.registerHandler( MessageType.GrabEvent, 
			( type: MessageType, m: MsgGrabEvent ) =>
			{
				this.grabEvent( m.event );
			} );
		this.m_endpoint.registerHandler( MessageType.NodeHaptic, this.onNodeHaptic );
	}

	@bind onEndpointOpen()
	{

	}

	@bind onUpdateSceneGraph( type:MessageType, payload: any, sender: EndpointAddr )
	{
		let m = payload as MsgUpdateSceneGraph;
		if( !m.root )
		{
			// TODO: Clean up drags and such?
			delete this.m_roots[ sender.endpointId ];
		}
		else
		{
			this.updateGlobalIds( m.root, sender.endpointId );
			let rootData = this.m_roots[ sender.endpointId ];
			if( !rootData )
			{
				rootData = this.m_roots[ sender.endpointId ] = 
				{ 
					gadgetId: sender.endpointId, 
					handIsRelevant: new Set<EHand>(),
					root: null 
				};
			}

			rootData.root = m.root;
			rootData.hook = m.hook;
			rootData.hookFromGadget = m.hookFromGadget;
		}
	}

	private updateGlobalIds( node: AvNode, gadgetId: number )
	{
		node.globalId =
		{
			type: EndpointType.Node,
			endpointId: gadgetId,
			nodeId: node.id,
		}

		if( node.children )
		{
			for( let child of node.children )
			{
				this.updateGlobalIds( child, gadgetId );
			}
		}
	}

	@bind
	public traverse()
	{
		if( !this.m_roots )
		{
			return;
		}

		this.m_inFrameTraversal = true;
		this.m_currentHand = EHand.Invalid;
		this.m_currentVisibility = true;
		this.m_currentGrabbableGlobalId = null;
		this.m_universeFromNodeTransforms = {};
		this.m_renderList = [];
		this.clearHooksInUse();
		this.m_frameNumber++;

		for ( let gadgetId in this.m_roots )
		{
			this.traverseSceneGraph( this.m_roots[ gadgetId ] );
		}
	
		this.m_lastFrameUniverseFromNodeTransforms = {};
		for ( let nodeGlobalId in this.m_universeFromNodeTransforms )
		{
			let transform = this.m_universeFromNodeTransforms[ nodeGlobalId ];
			transform.resolve();
			this.m_lastFrameUniverseFromNodeTransforms[ nodeGlobalId] = transform.getUniverseFromNode();
		}
	
		this.m_inFrameTraversal = false;
	
		Av().renderer.renderList( this.m_renderList );

		this.updateInput();
		this.updateGrabberIntersections();
		this.updatePokerProximity();

		this.cleanupOldNodeData();
	}

	private updateInput()
	{
		this.updateActionState( EHand.Left );
		this.updateActionState( EHand.Right );
	}

	private sendUpdateActionState( gadgetId: number, hand: EHand, actionState: AvActionState )
	{
		let m: MsgUpdateActionState =
		{
			gadgetId,
			hand,
			actionState,
		}

		this.m_endpoint.sendMessage( MessageType.UpdateActionState, m );
	}


	private updateActionState( hand: EHand )
	{
		let newActionState = Av().renderer.getActionState( hand );
		let oldActionState = this.m_actionState[ hand ]
		if( !equal( newActionState, oldActionState ) )
		{
			for( let gadgetId in this.m_roots )
			{
				let root = this.m_roots[ gadgetId ];
				if( !root.handIsRelevant.has( hand ) )
					continue;

				this.sendUpdateActionState( root.gadgetId, hand, newActionState );
			}
			this.m_actionState[ hand ] = newActionState;
		}
	}

	private updateGrabberIntersections()
	{
		//console.log( "updating grabber intersections" );
		let states = Av().renderer.updateGrabberIntersections();
		for( let state of states )
		{
			let nodeData = this.getNodeDataByEpa( state.grabberId );
			if( !nodeData.grabberProcessor )
			{
				nodeData.grabberProcessor = new CGrabStateProcessor(
					{
						sendGrabEvent: ( event: AvGrabEvent ) => 
						{ 
							this.sendGrabEvent( event );
						},
						getActionState: ( hand: EHand, action: EAction ) =>
						{
							return getActionFromState( action, this.m_actionState[ hand ] );
						},
						getUniverseFromNode: this.getLastUniverseFromNode,
						grabberEpa: state.grabberId
					} );
			}

			// figure out which handles are only here to detect proximity
			if( state.grabbables )
			{
				for( let intersection of state.grabbables )
				{
					let handleData = this.getNodeDataByEpa( intersection.handleId );
					if( handleData && typeof handleData.lastFlags === "number" )
					{
						intersection.handleFlags = handleData.lastFlags;
					}
					else
					{
						intersection.handleFlags = 0;
					}

					let grabbableData = this.getNodeDataByEpa( intersection.grabbableId );
					if( grabbableData && typeof grabbableData.lastFlags === "number" )
					{
						intersection.grabbableFlags = grabbableData.lastFlags;
					}
					else
					{
						intersection.grabbableFlags = 0;
					}

				}
			}

			nodeData.grabberProcessor.onGrabberIntersections( state );
		}
	}

	private updatePokerProximity()
	{
		let proximities = Av().renderer.updatePokerProximity();
		for( let proximity of proximities )
		{
			proximity.actionState = this.m_actionState[ proximity.hand ];
			this.m_endpoint.sendMessage( MessageType.PokerProximity, proximity );
		}
	}

	private sendGrabEvent( event: AvGrabEvent )
	{
		if( event.type == AvGrabEventType.EndGrab )
		{
			// if we're ending a grab with no hook for a tethered thing, put us back to the old hook
			// and transform
			let grabbableIdStr = endpointAddrToString( event.grabbableId );
			let oldAnchor = this.m_nodeToNodeAnchors[ grabbableIdStr ];
			if( oldAnchor && oldAnchor.anchorToRestore && !event.hookId )
			{
				event.hookId = oldAnchor.anchorToRestore.parentGlobalId;
				event.hookFromGrabbable = 
					nodeTransformFromMat4( oldAnchor.anchorToRestore.grabberFromGrabbable );
			}
		}

		this.m_grabEventsToProcess.push( event );
		if( this.m_grabEventTimer == -1 )
		{
			this.m_grabEventTimer = window.setTimeout( () => 
			{
				let events = this.m_grabEventsToProcess;
				this.m_grabEventsToProcess = [];
				this.m_grabEventTimer = -1;
				for( let event of events )
				{
					this.grabEvent( event );
				}

			})
		}

		this.m_endpoint.sendGrabEvent( event );
	}

	getNodeData( node: AvNode ): NodeData
	{
		return this.getNodeDataByEpa( node.globalId );
	}

	getNodeDataByEpa( nodeGlobalId: EndpointAddr ): NodeData
	{
		if( !nodeGlobalId )
		{
			return null;
		}

		let nodeIdStr = endpointAddrToString( nodeGlobalId );
		if( !this.m_nodeData.hasOwnProperty( nodeIdStr ) )
		{
			let nodeData = { lastFrameUsed: this.m_frameNumber };
			this.m_nodeData[ nodeIdStr] = nodeData;
			return nodeData;
		}
		else
		{
			let nodeData = this.m_nodeData[ nodeIdStr ];
			nodeData.lastFrameUsed = this.m_frameNumber;
			return nodeData;	
		}
	}

	cleanupOldNodeData()
	{
		let keys = Object.keys( this.m_nodeData );
		let frameToDeleteBefore = this.m_frameNumber - 2;
		for( let nodeIdStr of keys )
		{
			let nodeData = this.m_nodeData[ nodeIdStr ];
			if( nodeData.lastFrameUsed < frameToDeleteBefore )
			{
				delete this.m_nodeData[ nodeIdStr ];
			}
		}
	}

	
	traverseSceneGraph( root: AvNodeRoot ): void
	{
		if( root.root )
		{
			this.m_currentRoot = root;
			let oldRelevantHands = this.m_currentRoot.handIsRelevant;
			this.m_currentRoot.handIsRelevant = new Set<EHand>();

			// get the ID for node 0. We're going to use that as the parent of
			// everything. 
			let rootNode: AvNode;
			if( root.root.id == 0 )
			{
				rootNode = root.root;
			}
			else
			{
				rootNode = 
				{
					type: AvNodeType.Container,
					id: 0,
					flags: ENodeFlags.Visible,
					globalId: { type: EndpointType.Node, endpointId: root.root.globalId.endpointId, nodeId: 0 },
					children: [ root.root ],
				}
			}

			if( root.hook )
			{
				if( root.root.type == AvNodeType.Grabbable 
					&& root.root.id != 0 )
				{
					// grabbable nodes are what need their origin set
					this.setHookOrigin( root.hook, root.root, root.hookFromGadget );
				}
				this.setHookOrigin( root.hook, rootNode, root.hookFromGadget );
			}

			this.traverseNode( rootNode, null );

			// send empty action data for any hand that we don't care about anymore
			for( let hand of oldRelevantHands )
			{
				if( hand == EHand.Invalid )
					continue;

				if( !this.m_currentRoot.handIsRelevant.has( hand ) )
				{
					this.sendUpdateActionState( root.gadgetId, hand, emptyActionState( ) );
				}
			}

			// send the current action data for any hand that we don't care about anymore
			for( let hand of this.m_currentRoot.handIsRelevant )
			{
				if( hand == EHand.Invalid )
					continue;

				if( !oldRelevantHands.has( hand ) )
				{
					this.sendUpdateActionState( root.gadgetId, hand, this.m_actionState[ hand ] );
				}
			}
			
			this.m_currentRoot = null;
		}
	}

	traverseNode( node: AvNode, defaultParent: PendingTransform ): void
	{
		let handBefore = this.m_currentHand;
		let visibilityBefore = this.m_currentVisibility;

		this.m_currentVisibility = ( 0 != ( node.flags & ENodeFlags.Visible ) ) 
			&& this.m_currentVisibility;

		if( this.m_currentVisibility )
		{
			switch ( node.type )
			{
			case AvNodeType.Container:
				// nothing special to do here
				break;

			case AvNodeType.Origin:
				this.traverseOrigin( node, defaultParent );
				break;

			case AvNodeType.Transform:
				this.traverseTransform( node, defaultParent );
				break;

			case AvNodeType.Model:
				this.traverseModel( node, defaultParent );
				break;

			case AvNodeType.Panel:
				this.traversePanel( node, defaultParent );
				break;

			case AvNodeType.Poker:
				this.traversePoker( node, defaultParent );
				break;

			case AvNodeType.Grabbable:
				this.traverseGrabbable( node, defaultParent );
				break;

			case AvNodeType.Handle:
				this.traverseHandle( node, defaultParent );
				break;

			case AvNodeType.Grabber:
				this.traverseGrabber( node, defaultParent );
				break;

			case AvNodeType.Hook:
				this.traverseHook( node, defaultParent );
				break;
			
			case AvNodeType.Line:
				this.traverseLine( node, defaultParent );
				break;
			
			case AvNodeType.PanelIntersection:
				this.traversePanelIntersection( node, defaultParent );
				break;
			
			default:
				throw "Invalid node type";
			}
		}

		let nodeData = this.getNodeData( node );
		nodeData.lastFlags = node.flags;
		
		let thisNodeTransform = this.getTransform( node.globalId );
		if ( thisNodeTransform.needsUpdate() )
		{
			thisNodeTransform.update( defaultParent ? [ defaultParent ] : null, mat4.identity );
		}

		this.m_handDeviceForNode[ endpointAddrToString( node.globalId ) ] = this.m_currentHand;

		if( node.children )
		{
			for ( let child of node.children )
			{
				this.traverseNode( child, thisNodeTransform );
			}
		}

		if ( node.type == AvNodeType.Grabbable )
		{
			this.m_currentGrabbableGlobalId = null;
		}

		// remember that we used this hand
		this.m_currentRoot.handIsRelevant.add( this.m_currentHand );

		this.m_currentHand = handBefore;
		this.m_currentVisibility = visibilityBefore;
	}


	traverseOrigin( node: AvNode, defaultParent: PendingTransform )
	{
		this.setHookOrigin( node.propOrigin, node );
	}


	setHookOrigin( origin: string | EndpointAddr, node: AvNode, hookFromGrabbable?: AvNodeTransform )
	{
		if( typeof origin === "string" )
		{
			let universeFromOrigin = Av().renderer.getUniverseFromOriginTransform( origin );
			if ( universeFromOrigin )
			{
				this.updateTransform( node.globalId, null, new mat4( universeFromOrigin ), null );
	
				if ( origin == "/user/hand/left" )
				{
					this.m_currentHand = EHand.Left;
				}
				else if ( origin == "/user/hand/right" )
				{
					this.m_currentHand = EHand.Right;
				}
				else
				{
					this.m_currentHand = EHand.Invalid;
				}
			}
		}
		else if( origin != null )
		{
			let grabberFromGrabbable = mat4.identity;
			if( hookFromGrabbable )
			{
				grabberFromGrabbable = nodeTransformToMat4( hookFromGrabbable );
			}
			this.m_nodeToNodeAnchors[ endpointAddrToString( node.globalId ) ] =
			{
				parentGlobalId: origin,
				grabberFromGrabbable,
			}
		}
	}

	traverseTransform( node: AvNode, defaultParent: PendingTransform )
	{
		if ( node.propTransform )
		{
			let mat = nodeTransformToMat4( node.propTransform );
			this.updateTransform( node.globalId, defaultParent, mat, null );
		}
	}

	traverseModel( node: AvNode, defaultParent: PendingTransform )
	{
		let nodeData = this.getNodeData( node );

		if ( nodeData.lastModelUri != node.propModelUri )
		{
			nodeData.modelInstance = null;
		}

		if ( !nodeData.modelInstance )
		{
			nodeData.modelInstance = Av().renderer.createModelInstance( node.propModelUri );
			if ( nodeData.modelInstance )
			{
				nodeData.lastModelUri = node.propModelUri;
			}
		}

		if ( nodeData.modelInstance )
		{
			if( node.propColor )
			{
				let alpha = ( node.propColor.a == undefined ) ? 1 : node.propColor.a;
				nodeData.modelInstance.setBaseColor( 
					[ node.propColor.r, node.propColor.g, node.propColor.b, alpha ] );
			}

			let internalScale = 1;
			if( node.propScaleToFit )
			{
				let aabb = Av().renderer.getAABBForModel( node.propModelUri );
				if( !aabb )
				{
					// if we were told to scale the model, but it isn't loaded at this point,
					// abort drawing it so we don't have one frame of a wrongly-scaled model
					// as it loads in.
					return;
				}

				let possibleScale = minIgnoringNulls(
					scaleAxisToFit( node.propScaleToFit.x, aabb.xMin, aabb.xMax ),
					scaleAxisToFit( node.propScaleToFit.y, aabb.yMin, aabb.yMax ),
					scaleAxisToFit( node.propScaleToFit.z, aabb.zMin, aabb.zMax ) );
				if( possibleScale != null )
				{
					internalScale = possibleScale;
				}
			}

			this.updateTransform( node.globalId, defaultParent, mat4.identity,
				( universeFromNode: mat4 ) =>
			{
				if( internalScale != 1 )
				{
					let scaledNodeFromModel = scaleMat( new vec3( [ internalScale, internalScale, internalScale ] ) );
					universeFromNode = new mat4( universeFromNode.all() ).multiply( scaledNodeFromModel );
				}
				nodeData.modelInstance.setUniverseFromModelTransform( universeFromNode.all() );
				this.m_renderList.push( nodeData.modelInstance );
			} );
		}
	}

	traversePanel( node: AvNode, defaultParent: PendingTransform )
	{
		let nodeData = this.getNodeData( node );

		// if we don't have shared texture info for this panel yet, there's
		// nothing to do here
		if( !node.propSharedTexture )
			return;

		let textureInfo = node.propSharedTexture;

		if ( !nodeData.modelInstance )
		{
			let sPanelModelUri = g_builtinModelPanel;
			if( textureInfo.invertY )
			{
				sPanelModelUri = g_builtinModelPanelInverted;
			}

			nodeData.modelInstance = Av().renderer.createModelInstance( sPanelModelUri );
		}

		if ( nodeData.modelInstance )
		{
			try
			{
				nodeData.modelInstance.setOverrideTexture( textureInfo );
			}
			catch( e )
			{
				// just eat these and don't add the panel. Sometimes we find out about a panel 
				// before we find out about its texture
				return;
			}

			let hand = this.m_currentHand;
			this.updateTransform( node.globalId, defaultParent, mat4.identity,
				( universeFromNode: mat4 ) =>
			{
				nodeData.modelInstance.setUniverseFromModelTransform( universeFromNode.all() );
				this.m_renderList.push( nodeData.modelInstance );

				if ( node.propInteractive )
				{
					let panelNormal = universeFromNode.multiplyVec4( new vec4( [ 0, 1, 0, 0 ] ) );
					let zScale = panelNormal.length();
					let nodeFromUniverse = new mat4( universeFromNode.all() ).inverse();
					Av().renderer.addActivePanel(
						node.globalId,
						nodeFromUniverse.all(),
						zScale, 
						hand );
				}
			} );
		}
	}

	traversePoker( node: AvNode, defaultParent: PendingTransform )
	{
		let hand = this.m_currentHand;
		this.updateTransform( node.globalId, defaultParent, null,
			( universeFromNode: mat4 ) =>
		{
			let pokerInUniverse = universeFromNode.multiplyVec4( new vec4( [ 0, 0, 0, 1 ] ) );
			Av().renderer.addActivePoker( node.globalId, [ pokerInUniverse.x, pokerInUniverse.y, pokerInUniverse.z ], hand );
		} );
	}
	
	traverseGrabbable( node: AvNode, defaultParent: PendingTransform )
	{
		let nodeData = this.getNodeData( node );
		this.m_currentGrabbableGlobalId = node.globalId;
		let nodeIdStr = endpointAddrToString( node.globalId );
		if( !this.m_nodeToNodeAnchors.hasOwnProperty( nodeIdStr ) )
		{
			if( nodeData.lastParentFromNode )
			{
				this.updateTransform( node.globalId, defaultParent, nodeData.lastParentFromNode, null );
			}
			else if( node.propTransform )
			{
				let parentFromNode = nodeTransformToMat4( node.propTransform );
				this.updateTransform( node.globalId, defaultParent, parentFromNode, 
					( universeFromNode: mat4 ) =>
					{
						this.preserveTransform( node, null, defaultParent, universeFromNode, parentFromNode );
					} );
			}
		}
		else
		{
			let parentInfo = this.m_nodeToNodeAnchors[ nodeIdStr ];

			let hand = this.m_handDeviceForNode[ endpointAddrToString( parentInfo.parentGlobalId ) ];
			if( hand != undefined )
			{
				this.m_currentHand = hand;
			}

			if( parentInfo.parentGlobalId.type == EndpointType.Node )
			{
				this.addHookInUse( parentInfo.parentGlobalId );
			}
			let grabberTransform = this.getTransform( parentInfo.parentGlobalId );

			let constraint = node.propConstraint;
			if( parentInfo.handleGlobalId )
			{
				let handleNodeData = this.getNodeDataByEpa( parentInfo.handleGlobalId );
				if( handleNodeData.constraint )
				{
					constraint = handleNodeData.constraint;
				}
			}

			if( !constraint || !defaultParent )
			{
				// this is a simple grabbable that is transformed by its grabber directly
				this.updateTransform( node.globalId, grabberTransform, 
					parentInfo.grabberFromGrabbable, 
					( universeFromNode: mat4 ) =>
					{
						this.preserveTransform( node, parentInfo.parentGlobalId, defaultParent, 
							universeFromNode );
					} );
			}
			else
			{
				// this is a constrained grabbable that combines its parent's pose, the
				// constraints, and its grabber. We need a callback when it's time to compute
				// the transform
				this.updateTransformWithCompute( node.globalId,
					[ defaultParent, grabberTransform],
					mat4.identity, null,
					( universeFromParents: mat4[], unused: mat4) =>
					{
						// grabbable - the grabbable node itself
						// parent - the grabbable node's parent in the scene graph
						// grabber - the grabber node
						// grabbable origin - the origin of the grabbable for purposes of constraints.
						//		This may be the same as the parent, but if there was any kind of
						//		previous grabbing and dragging of the grabbable, this would include that
						//		previous transform. 
						let grabberFromGrabbable = parentInfo.grabberFromGrabbable;
						let grabPoint = grabberFromGrabbable.multiplyVec4( new vec4( [ 0, 0, 0, 1 ] ) );
						let universeFromGrabber = universeFromParents[1];
						let universeFromParent = universeFromParents[0];
						let universeFromGrabbableOrigin = universeFromParent;
						let parentFromGrabbableOrigin = mat4.identity;
						if( parentInfo.grabbableParentFromGrabbableOrigin )
						{
							universeFromGrabbableOrigin = mat4.product( universeFromParent, 
								parentInfo.grabbableParentFromGrabbableOrigin, new mat4() );
							parentFromGrabbableOrigin = parentInfo.grabbableParentFromGrabbableOrigin;
						}
						let grabbableOriginFromUniverse = universeFromGrabbableOrigin.copy().inverse();
						
						let grabberPositionInGrabbableOrigin = new vec3(
							grabbableOriginFromUniverse.multiplyVec4( 
								universeFromGrabber.multiplyVec4( grabPoint ) ).xyz );
						
						if( constraint.minX != undefined )
						{
							grabberPositionInGrabbableOrigin.x = Math.max( constraint.minX, 
								grabberPositionInGrabbableOrigin.x );
						}
						if( constraint.maxX  != undefined )
						{
							grabberPositionInGrabbableOrigin.x = Math.min( constraint.maxX, 
								grabberPositionInGrabbableOrigin.x );
						}
						if( constraint.minY != undefined )
						{
							grabberPositionInGrabbableOrigin.y = Math.max( constraint.minY, 
								grabberPositionInGrabbableOrigin.y );
						}
						if( constraint.maxY != undefined )
						{
							grabberPositionInGrabbableOrigin.y = Math.min( constraint.maxY, 
								grabberPositionInGrabbableOrigin.y );
						}
						if( constraint.minZ != undefined )
						{
							grabberPositionInGrabbableOrigin.z = Math.max( constraint.minZ, 
								grabberPositionInGrabbableOrigin.z );
						}
						if( constraint.maxZ != undefined )
						{
							grabberPositionInGrabbableOrigin.z = Math.min( constraint.maxZ, 
								grabberPositionInGrabbableOrigin.z );
						}
						let parentFromGrabbable = mat4.product( parentFromGrabbableOrigin, 
							translateMat( grabberPositionInGrabbableOrigin ), new mat4() );
						let universeFromNode = mat4.product( universeFromParent, parentFromGrabbable, new mat4() );
						this.preserveTransform( node, parentInfo.parentGlobalId, defaultParent,
							universeFromNode, parentFromGrabbable );
						return universeFromNode;
					} );
			}
		}
	}

	private preserveTransform( node: AvNode, grabberGlobalId: EndpointAddr, 
		parent: PendingTransform, universeFromNode: mat4, parentFromNode?: mat4 )
	{
		if( 0 == ( node.flags & ( ENodeFlags.PreserveGrabTransform | ENodeFlags.NotifyOnTransformChange ) ) )
			return;

		if( !parentFromNode )
		{
			parentFromNode = universeFromNode;
			if( parent )
			{
				let parentFromUniverse = parent.getUniverseFromNode().copy().inverse();
				parentFromNode = mat4.product( parentFromUniverse, universeFromNode, new mat4() );
			}	
		}

		if( node.flags & ENodeFlags.PreserveGrabTransform )
		{
			let nodeData = this.getNodeData( node );
			nodeData.lastParentFromNode = parentFromNode;
		}

		if( node.flags & ENodeFlags.NotifyOnTransformChange )
		{
			this.sendGrabEvent( 
				{
					type: AvGrabEventType.TransformUpdated,
					grabbableId: node.globalId,
					grabberId: grabberGlobalId,
					parentFromNode: nodeTransformFromMat4( parentFromNode ),
					universeFromNode: nodeTransformFromMat4( universeFromNode ),
				}
			)
		}
	}


	traverseHandle( node: AvNode, defaultParent: PendingTransform )
	{
		if ( !node.propVolume )
		{
			return;
		}
	
		let nodeData = this.getNodeData( node );

		if( node.propConstraint )
		{
			nodeData.constraint = node.propConstraint;
		}

		let grabbableGlobalId = this.m_currentGrabbableGlobalId;
		let hand = this.m_currentHand;
		this.updateTransform( node.globalId, defaultParent, null,
			( universeFromNode: mat4 ) =>
		{
			switch( node.propVolume.type )
			{
				case EVolumeType.Sphere:
					Av().renderer.addGrabbableHandle_Sphere( grabbableGlobalId, node.globalId,
						universeFromNode.all(), 
						node.propVolume.radius, hand );
					break;

				case EVolumeType.ModelBox:
					Av().renderer.addGrabbableHandle_ModelBox( grabbableGlobalId, node.globalId,
						universeFromNode.all(), 
						node.propVolume.uri, hand );
					break;

				default:
					throw "unsupported volume type";
			}
		} );
	}

	traverseGrabber(node: AvNode, defaultParent: PendingTransform )
	{
		if ( !node.propVolume )
		{
			return;
		}

		let grabberGlobalId = node.globalId;
		let grabberHand = this.m_currentHand;
		this.updateTransform( node.globalId, defaultParent, null,
			( universeFromNode: mat4 ) =>
		{
			switch( node.propVolume.type )
			{
				case EVolumeType.Sphere:
					Av().renderer.addGrabber_Sphere( grabberGlobalId, universeFromNode.all(), 
						node.propVolume.radius, grabberHand );
					break;
				default:
					throw "unsupported volume type";
			}
		} );
	}

	traverseHook( node: AvNode, defaultParent: PendingTransform )
	{
		if( !node.propVolume )
		{
			return;
		}

		let hookGlobalId = node.globalId;
		let hand = this.m_currentHand;
		this.updateTransform( node.globalId, defaultParent, null,
			( universeFromNode: mat4 ) =>
		{
			if( this.isHookInUse( hookGlobalId ) )
				return;

			switch( node.propVolume.type )
			{
				case EVolumeType.Sphere:
					Av().renderer.addHook_Sphere( hookGlobalId, universeFromNode.all(), node.propVolume.radius, hand );
					break;
				case EVolumeType.AABB:
					Av().renderer.addHook_Aabb( hookGlobalId, universeFromNode.all(), node.propVolume.aabb, hand );
					break;
				default:
					throw "unsupported volume type";
			}
		} );
	}

	traverseLine( node: AvNode, defaultParent: PendingTransform )
	{
		if( !node.propEndAddr )
		{
			return;
		}

		let lineEndTransform = this.getTransform( node.propEndAddr );
		let thickness = node.propThickness === undefined ? 0.003 : node.propThickness;
		this.updateTransformWithCompute( node.globalId,
			[ defaultParent, lineEndTransform ],
			mat4.identity, null,
			( [ universeFromStart, universeFromEnd ]: mat4[], unused: mat4) =>
			{
				let nodeData = this.getNodeData( node );

				if ( !nodeData.modelInstance )
				{
					nodeData.modelInstance = Av().renderer.createModelInstance( g_builtinModelCylinder );
					if ( nodeData.modelInstance )
					{
						nodeData.lastModelUri = g_builtinModelCylinder;
					}
				}
		
				if ( nodeData.modelInstance )
				{
					if( node.propColor )
					{
						let alpha = ( node.propColor.a == undefined ) ? 1 : node.propColor.a;
						nodeData.modelInstance.setBaseColor( 
							[ node.propColor.r, node.propColor.g, node.propColor.b, alpha ] );
					}
		
					let startPos = new vec3( universeFromStart.multiplyVec4( new vec4( [ 0, 0, 0, 1 ] ) ).xyz );
					let endPos = new vec3( universeFromEnd.multiplyVec4( new vec4( [ 0, 0, 0, 1 ] ) ).xyz );
					let lineVector = new vec3( endPos.xyz );
					lineVector.subtract( startPos );
					let lineLength = lineVector.length();
					lineVector.normalize();

					let startGap = node.propStartGap ? node.propStartGap : 0;
					let endGap = node.propEndGap ? node.propEndGap : 0;
					if( startGap + endGap < lineLength )
					{
						let actualStart = vec3MultiplyAndAdd( startPos, lineVector, startGap );
						let actualEnd = vec3MultiplyAndAdd( endPos, lineVector, -endGap );
						let universeFromLine = 	computeUniverseFromLine( actualStart, actualEnd, thickness ); 

						nodeData.modelInstance.setUniverseFromModelTransform( universeFromLine.all() );
						this.m_renderList.push( nodeData.modelInstance );
					}

				}
		
				return new mat4();
			} );
	}

	traversePanelIntersection( node: AvNode, defaultParent: PendingTransform )
	{
		if( !node.propEndAddr )
		{
			return;
		}

		let panelTransform = this.getTransform( node.propEndAddr );
		this.updateTransformWithCompute( node.globalId,
			[ defaultParent, panelTransform ],
			mat4.identity, null,
			( [ universeFromNode, universeFromPanel ]: mat4[], unused: mat4) =>
			{
				let nodePos = universeFromNode.multiplyVec4( new vec4( [ 0, 0, 0, 1 ] ) );
				let panelFromUniverse = universeFromPanel.copy().inverse();
				let intersectionPos = panelFromUniverse.multiplyVec4( nodePos );
				intersectionPos.y = 0; // zero out distance from the panel
				intersectionPos = universeFromPanel.multiplyVec4( intersectionPos );

				let result = universeFromPanel.all();
				result[12] = intersectionPos.x;
				result[13] = intersectionPos.y;
				result[14] = intersectionPos.z;
				return new mat4( result );
			} );
	}


	@bind
	public grabEvent( grabEvent: AvGrabEvent )
	{
		let grabbableData = this.getNodeDataByEpa( grabEvent.grabbableId );
		let grabbableFlags = grabbableData ? grabbableData.lastFlags : 0;
		let grabberIdStr = endpointAddrToString( grabEvent.grabberId );
		let grabbableIdStr = endpointAddrToString( grabEvent.grabbableId );
		switch( grabEvent.type )
		{
			case AvGrabEventType.StartGrab:
				console.log( "Traverser starting grab of " + grabEvent.grabbableId + " by " + grabEvent.grabberId );

				if( !this.m_lastFrameUniverseFromNodeTransforms.hasOwnProperty( grabberIdStr ) )
				{
					throw "grabber wasn't rendered last frame";
				}

				let universeFromGrabber = this.m_lastFrameUniverseFromNodeTransforms[ grabberIdStr ];
				let grabberFromGrabbable: mat4;
				if( !this.m_lastFrameUniverseFromNodeTransforms.hasOwnProperty( grabbableIdStr  ) 
					|| grabEvent.useIdentityTransform )
				{
					grabberFromGrabbable = mat4.identity;
				}
				else
				{
					let universeFromGrabbable = this.m_lastFrameUniverseFromNodeTransforms[ grabbableIdStr ];
					let grabberFromUniverse = universeFromGrabber.copy().inverse();
		
					grabberFromGrabbable = grabberFromUniverse.multiply( universeFromGrabbable );
				}

				let anchorToRestore: NodeToNodeAnchor_t;
				if( 0 == ( grabbableFlags & ENodeFlags.Tethered ) )
				{
					let oldAnchor = this.m_nodeToNodeAnchors[ grabbableIdStr ];
					if( oldAnchor && oldAnchor.parentGlobalId.type == EndpointType.Node )
					{
						let msg: MsgDetachGadgetFromHook =
						{
							grabbableNodeId: grabEvent.grabbableId,
							hookNodeId: oldAnchor.parentGlobalId,
						}
		
						this.m_endpoint.sendMessage( MessageType.DetachGadgetFromHook, msg );
					}	
				}
				else
				{
					anchorToRestore = this.m_nodeToNodeAnchors[ grabbableIdStr ];
				}

				let grabbableParentFromGrabbableOrigin: mat4;
				if( grabbableData && grabbableData.lastParentFromNode )
				{
					grabbableParentFromGrabbableOrigin = grabbableData.lastParentFromNode;
				}

				this.m_nodeToNodeAnchors[ grabbableIdStr ] = 
				{
					parentGlobalId: grabEvent.grabberId,
					handleGlobalId: grabEvent.handleId,
					grabberFromGrabbable,
					grabbableParentFromGrabbableOrigin, 
					anchorToRestore,
				};
				Av().renderer.startGrab( grabEvent.grabberId, grabEvent.grabbableId );
				console.log( `telling collider about ${ endpointAddrToString( grabEvent.grabberId ) } `
					+ `grabbing ${ endpointAddrToString( grabEvent.grabbableId ) }` );

				let grabStartedEvent:AvGrabEvent = 
				{
					type: AvGrabEventType.GrabStarted,
					grabberId: grabEvent.grabberId,
					grabbableId: grabEvent.grabbableId,
				};
				this.sendGrabEvent( grabStartedEvent );
				break;

			case AvGrabEventType.EndGrab:
				console.log( "Traverser ending grab of " + grabEvent.grabbableId + " by " + grabEvent.grabberId );
				Av().renderer.endGrab( grabEvent.grabberId, grabEvent.grabbableId );
				let oldAnchor = this.m_nodeToNodeAnchors[ grabbableIdStr ];
				if( !endpointAddrIsEmpty( grabEvent.hookId ) )
				{
					let anchor: NodeToNodeAnchor_t =
					{
						parentGlobalId: grabEvent.hookId,
						grabberFromGrabbable: null,
					};

					let msg: MsgAttachGadgetToHook =
					{
						grabbableNodeId: grabEvent.grabbableId,
						hookNodeId: grabEvent.hookId,
					}

					// we're dropping onto a hook
					let hookData = this.getNodeDataByEpa( grabEvent.hookId );
					if( hookData.lastFlags & ENodeFlags.PreserveGrabTransform )
					{
						// this hook wants to retain the relative transform
						anchor.grabberFromGrabbable = nodeTransformToMat4( grabEvent.hookFromGrabbable );
						msg.hookFromGrabbable = grabEvent.hookFromGrabbable;
					}

					this.m_nodeToNodeAnchors[ grabbableIdStr ] = anchor;

					this.m_endpoint.sendMessage( MessageType.AttachGadgetToHook, msg );
				}
				else if( ( grabbableFlags & ENodeFlags.PreserveGrabTransform ) == 0 )
				{
					let msg: MsgDestroyGadget =
					{
						gadgetId: grabEvent.grabbableId.endpointId,
					}

					this.m_endpoint.sendMessage( MessageType.DestroyGadget, msg );
				}
				else
				{
					// we're dropping into open space
					delete this.m_nodeToNodeAnchors[ endpointAddrToString( grabEvent.grabbableId ) ];
				}
				break;
		}

		if( grabEvent.grabberId )
		{
			let nodeData = this.getNodeDataByEpa( grabEvent.grabberId );
			if( nodeData && nodeData.grabberProcessor )
			{
				nodeData.grabberProcessor.onGrabEvent( grabEvent );
			}
		}
	}

	getTransform( globalNodeId: EndpointAddr  ): PendingTransform
	{
		let idStr = endpointAddrToString( globalNodeId );
		if( idStr == "0" )
			return null;

		if( !this.m_universeFromNodeTransforms.hasOwnProperty( idStr ) )
		{
			this.m_universeFromNodeTransforms[ idStr ] = new PendingTransform();
		}
		return this.m_universeFromNodeTransforms[ idStr ];
	}

	updateTransform( globalNodeId: EndpointAddr,
		parent: PendingTransform, parentFromNode: mat4,
		applyFunction: ( universeFromNode: mat4 ) => void )
	{
		let transform = this.getTransform( globalNodeId );
		transform.update( parent ? [ parent ] : null, parentFromNode, applyFunction );
		return transform;
	}

	updateTransformWithCompute( globalNodeId: EndpointAddr,
		parents: PendingTransform[], parentFromNode: mat4,
		applyFunction: ( universeFromNode: mat4 ) => void,
		computeFunction: TransformComputeFunction )
	{
		let transform = this.getTransform( globalNodeId );
		transform.update( parents, parentFromNode, applyFunction, computeFunction );
		return transform;
	}

	
	@bind
	public onNodeHaptic( messageType: MessageType, m: MsgNodeHaptic  )
	{
		let hapticHand = this.m_handDeviceForNode[ endpointAddrToString( m.nodeId ) ];
		if( hapticHand )
		{
			Av().renderer.sendHapticEventForHand( hapticHand, m.amplitude, m.frequency, m.duration );
		}
	}

	private isHookInUse( nodeId: EndpointAddr )
	{
		let hookData = this.getNodeDataByEpa( nodeId );
		if( hookData && hookData.lastFlags & ENodeFlags.AllowMultipleDrops )
		{
			return false;
		}

		for( let hookId of this.m_hooksInUse )
		{
			if( endpointAddrsMatch( nodeId, hookId ) )
				return true;
		}
		return false;
	}

	private addHookInUse( nodeId: EndpointAddr )
	{
		this.m_hooksInUse.push( nodeId );
	}

	private clearHooksInUse()
	{
		this.m_hooksInUse = [];
	}

	@bind
	private getLastUniverseFromNode( nodeAddr: EndpointAddr ): mat4
	{
		let nodeGlobalId = endpointAddrToString( nodeAddr );
		if( !this.m_lastFrameUniverseFromNodeTransforms.hasOwnProperty( nodeGlobalId ) )
		{
			return mat4.identity;
		}
		else
		{
			return this.m_lastFrameUniverseFromNodeTransforms[ nodeGlobalId ];
		}
	}
}


