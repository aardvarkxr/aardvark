import { CGrabStateProcessor } from './aardvark-react/grab_state_processor';
import { MsgUpdateSceneGraph, EndpointType, MsgGrabEvent, endpointAddrsMatch, MsgSetEditMode, EndpointAddr } from 'common/aardvark-react/aardvark_protocol';
import { CRendererEndpoint } from './aardvark-react/renderer_endpoint';
import { Av, AvGrabEventType, AvNode, ENodeFlags, AvNodeTransform, AvConstraint } from 'common/aardvark';
import { AvModelInstance, AvNodeType, EHand, EVolumeType, AvGrabEvent } from './aardvark';
import { mat4, vec3, quat, vec4, mat3 } from '@tlaukkan/tsm';
import bind from 'bind-decorator';
import { endpointAddrToString, endpointAddrIsEmpty, MessageType, MsgNodeHaptic, MsgAttachGadgetToHook, MsgDetachGadgetFromHook } from './aardvark-react/aardvark_protocol';

interface NodeData
{
	lastModelUri?: string;
	modelInstance?: AvModelInstance;
	grabberProcessor?: CGrabStateProcessor;
	lastParentFromNode?: mat4;
	constraint?: AvConstraint;
}

function translateMat( t: vec3)
{
	let m = new mat4();
	m.setIdentity();
	m.translate( t );
	return m;
}

function scaleMat( s: vec3)
{
	let m = new mat4();
	m.setIdentity();
	m.scale( s );
	return m;
}

function getRowFromMat( m: mat4, n: number ) : vec3 
{
	let row = m.row( n );
	return new vec3( [ row[ 0 ], row[ 1 ],row[ 2 ], ] );
}

function nodeTransformFromMat4( m: mat4 ) : AvNodeTransform
{
	let transform: AvNodeTransform = {};
	let pos = m.multiplyVec4( new vec4( [ 0, 0, 0, 1 ] ) );
	if( pos.x != 0 || pos.y != 0 || pos.z != 0 )
	{
		transform.position = { x: pos.x, y: pos.y, z: pos.z };
	}

	let xScale = getRowFromMat( m, 0 ).length();
	let yScale = getRowFromMat( m, 1 ).length();
	let zScale = getRowFromMat( m, 2 ).length();
	if( xScale != 1 || yScale != 1 || zScale != 1 )
	{
		transform.scale = { x : xScale, y: yScale, z: zScale };
	}

	let rotMat = new mat3( 
		[
			m.at( 0 + 0 ) / xScale, m.at( 0 + 1 ) / xScale, m.at( 0 + 2 ) / xScale,
			m.at( 4 + 0 ) / yScale, m.at( 4 + 1 ) / yScale, m.at( 4 + 2 ) / yScale,
			m.at( 8 + 0 ) / zScale, m.at( 8 + 1 ) / zScale, m.at( 8 + 2 ) / zScale,
		] );
	let rot = rotMat.toQuat();
	if( rot.x != 0 || rot.y != 0 || rot.z != 0 )
	{
		transform.rotation = { x: rot.x, y: rot.y, z: rot.z, w: rot.w };
	}

	return transform;
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
	parentFromNodeTransform: mat4;
	universeFromParentStart: mat4;
}

interface AvNodeRoot
{
	gadgetId: number;
	root: AvNode;
	hook?: string | EndpointAddr;
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
	private m_renderList: AvModelInstance[] = [];
	private m_nodeToNodeAnchors: { [ nodeGlobalId: string ]: NodeToNodeAnchor_t } = {};
	private m_hooksInUse: EndpointAddr[] = [];
	private m_endpoint: CRendererEndpoint = null;
	private m_editMode: { [hand: number]: boolean } = { };
	private m_editableNodesForHand: { [ hand: number ]: AvNode[] } = {}
	private m_grabEventsToProcess: AvGrabEvent[] = [];
	private m_grabEventTimer: number = -1;

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

		this.m_editMode[ EHand.Left ] = false;
		this.m_editMode[ EHand.Right ] = false;
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
			this.m_roots[ sender.endpointId ] =
			{
				gadgetId: sender.endpointId,
				root: m.root,
				hook: m.hook,
			}
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
		this.m_handDeviceForNode = {};
		this.m_currentHand = EHand.Invalid;
		this.m_currentVisibility = true;
		this.m_currentGrabbableGlobalId = null;
		this.m_universeFromNodeTransforms = {};
		this.m_renderList = [];
		this.m_editableNodesForHand[ EHand.Invalid ] = [];
		this.m_editableNodesForHand[ EHand.Left ] = [];
		this.m_editableNodesForHand[ EHand.Right ] = [];
		this.clearHooksInUse();

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

		this.updateEditMode( EHand.Left );
		this.updateEditMode( EHand.Right );
		this.updateGrabberIntersections();
		this.updatePokerProximity();
	}

	private updateEditMode( hand: EHand )
	{
		let editMode = Av().renderer.isEditPressed( hand );
		if( editMode != this.m_editMode[ hand ] )
		{
			for( let node of this.m_editableNodesForHand[ hand ] )
			{
				let m: MsgSetEditMode =
				{
					nodeId: node.globalId,
					hand,
					editMode,
				}

				this.m_endpoint.sendMessage( MessageType.SetEditMode, m );
			}

			this.m_editMode[ hand ] = editMode;
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
						grabberEpa: state.grabberId
					} );
			}

			nodeData.grabberProcessor.onGrabberIntersections( state );
		}
	}

	private updatePokerProximity()
	{
		let proximities = Av().renderer.updatePokerProximity();
		for( let proximity of proximities )
		{
			this.m_endpoint.sendMessage( MessageType.PokerProximity, proximity );
		}
	}

	private sendGrabEvent( event: AvGrabEvent )
	{
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
		let nodeIdStr = endpointAddrToString( nodeGlobalId );
		if( !this.m_nodeData.hasOwnProperty( nodeIdStr ) )
		{
			this.m_nodeData[ nodeIdStr] = {};
		}
		return this.m_nodeData[ nodeIdStr ];
	}

	traverseSceneGraph( root: AvNodeRoot ): void
	{
		if( root.root )
		{
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
					this.setHookOrigin( root.hook, root.root );
				}
				this.setHookOrigin( root.hook, rootNode );
			}

			this.traverseNode( rootNode, null );
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
			
			default:
				throw "Invalid node type";
			}
		}

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

		this.m_currentHand = handBefore;
		this.m_currentVisibility = visibilityBefore;
	}


	traverseOrigin( node: AvNode, defaultParent: PendingTransform )
	{
		this.setHookOrigin( node.propOrigin, node );
	}


	setHookOrigin( origin: string | EndpointAddr, node: AvNode )
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

				this.m_editableNodesForHand[ this.m_currentHand ].push( node );
			}
		}
		else if( origin != null )
		{
			this.m_nodeToNodeAnchors[ endpointAddrToString( node.globalId ) ] =
			{
				parentGlobalId: origin,
				parentFromNodeTransform: mat4.identity,
			}
		}
	}

	traverseTransform( node: AvNode, defaultParent: PendingTransform )
	{
		if ( node.propTransform )
		{
			let transform = node.propTransform;

			let vTrans: vec3;
			if ( transform.position )
			{
				vTrans = new vec3( [ transform.position.x, transform.position.y, transform.position.z ] );
			}
			else
			{
				vTrans = new vec3( [ 0, 0, 0 ] );
			}
			let vScale: vec3;
			if ( transform.scale )
			{
				vScale = new vec3( [ transform.scale.x, transform.scale.y, transform.scale.z ] );
			}
			else
			{
				vScale = new vec3( [ 1, 1, 1 ] );
			}
			let qRot: quat;
			if ( transform.rotation )
			{
				qRot = new quat( [ transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w ] );
			}
			else
			{
				qRot = new quat( [ 0, 0, 0, 1 ] );
			}

			let mat = translateMat( vTrans ).multiply( qRot.toMat4() );
			mat = mat.multiply( scaleMat( vScale ) ) ;
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

			this.updateTransform( node.globalId, defaultParent, mat4.identity,
				( universeFromNode: mat4 ) =>
			{
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
			let sPanelModelUri = "https://aardvark.install/models/panel/panel.glb";
			if( textureInfo.invertY )
			{
				sPanelModelUri = "https://aardvark.install/models/panel/panel_inverted.glb";
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
		}
		else
		{
			let parentInfo = this.m_nodeToNodeAnchors[ nodeIdStr ];

			let hand = this.m_handDeviceForNode[ endpointAddrToString( parentInfo.parentGlobalId ) ];
			if( hand != undefined )
			{
				this.m_currentHand = hand;
				this.m_editableNodesForHand[ this.m_currentHand ].push( node );
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
					parentInfo.parentFromNodeTransform, 
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
						let grabberFromGrabbable = parentInfo.parentFromNodeTransform;
						let grabPoint = grabberFromGrabbable.multiplyVec4( new vec4( [ 0, 0, 0, 1 ] ) );
						let universeFromGrabber = universeFromParents[1];
						let universeFromParent = universeFromParents[0];
						let parentFromUniverse = universeFromParent.copy().inverse();
						
						let grabberPositionInParent = new vec3(
							parentFromUniverse.multiplyVec4( 
								universeFromGrabber.multiplyVec4( grabPoint ) ).xyz );
						
						if( constraint.minX != undefined )
						{
							grabberPositionInParent.x = Math.max( constraint.minX, 
								grabberPositionInParent.x );
						}
						if( constraint.maxX  != undefined )
						{
							grabberPositionInParent.x = Math.min( constraint.maxX, 
								grabberPositionInParent.x );
						}
						if( constraint.minY != undefined )
						{
							grabberPositionInParent.y = Math.max( constraint.minY, 
								grabberPositionInParent.y );
						}
						if( constraint.maxY != undefined )
						{
							grabberPositionInParent.y = Math.min( constraint.maxY, 
								grabberPositionInParent.y );
						}
						if( constraint.minZ != undefined )
						{
							grabberPositionInParent.z = Math.max( constraint.minZ, 
								grabberPositionInParent.z );
						}
						if( constraint.maxZ != undefined )
						{
							grabberPositionInParent.z = Math.min( constraint.maxZ, 
								grabberPositionInParent.z );
						}
						let parentFromNode = translateMat( grabberPositionInParent );
						let universeFromNode = mat4.product( universeFromParent, parentFromNode, new mat4() );
						this.preserveTransform( node, parentInfo.parentGlobalId, defaultParent,
							universeFromNode, parentFromNode );
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
				let parentFromNode = mat4.product( parentFromUniverse, universeFromNode, new mat4() );
	
				parentFromNode = parentFromNode;
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
	
		if( node.propConstraint )
		{
			let nodeData = this.getNodeData( node );
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
				default:
					throw "unsupported volume type";
			}
		} );
	}

	@bind
	public grabEvent( grabEvent: AvGrabEvent )
	{
		switch( grabEvent.type )
		{
			case AvGrabEventType.StartGrab:
				console.log( "Traverser starting grab of " + grabEvent.grabbableId + " by " + grabEvent.grabberId );

				let grabberIdStr = endpointAddrToString( grabEvent.grabberId );
				let grabbableIdStr = endpointAddrToString( grabEvent.grabbableId );
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

				this.m_nodeToNodeAnchors[ grabbableIdStr ] = 
				{
					parentGlobalId: grabEvent.grabberId,
					handleGlobalId: grabEvent.handleId,
					parentFromNodeTransform: grabberFromGrabbable,
					universeFromParentStart: universeFromGrabber.copy(),
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
				if( !endpointAddrIsEmpty( grabEvent.hookId ) )
				{
					// we're dropping onto a hook
					this.m_nodeToNodeAnchors[ endpointAddrToString( grabEvent.grabbableId ) ] = 
					{
						parentGlobalId: grabEvent.hookId,
						parentFromNodeTransform: null,
					};

					let msg: MsgAttachGadgetToHook =
					{
						grabbableNodeId: grabEvent.grabbableId,
						hookNodeId: grabEvent.hookId,
					}

					this.m_endpoint.sendMessage( MessageType.AttachGadgetToHook, msg );
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

}


