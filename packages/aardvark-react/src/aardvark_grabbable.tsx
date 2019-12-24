import { AvGadget } from './aardvark_gadget';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import bind from 'bind-decorator';
import { EndpointAddr, AvNodeType, AvGrabEvent, AvGrabEventType, 
	AvConstraint, AvNodeTransform, ENodeFlags } from '@aardvarkxr/aardvark-shared';
import { AvTransform } from './aardvark_transform';

export interface GrabResponse
{
	allowed: boolean;
	proxyGrabbableGlobalId?: EndpointAddr;
	proxyHandleGlobalId?: EndpointAddr;
}

/** This enum defines the possible highlight states of an AvGrabbable. 
*/
export enum HighlightType
{
	/** Nothing interesting is going on with the grabbable. */
	None = 0,

	/** There is a grabber within grabbing range of the grabbable. */
	InRange = 1,

	/** There is a grabber actively grabbing the grabbable, and it isn't attached to anything. */
	Grabbed = 2,

	/** The grabbed grabbable is within drop range of a hook. */
	InHookRange = 3,
}


interface AvGrabbableProps extends AvBaseNodeProps
{
	/** This callback is called whenever the highlight state of the grabbable is updated. 
	 * Use this to change models, apply scale, animate, color tint, or however else you 
	 * want to indicate grabber proximity and grab state to the user. If this callback is
	 * not specified, the grabbable will not highlight.
	 * 
	 * @default no highlight
	 */
	updateHighlight?: ( highlightType: HighlightType, handleAddr: EndpointAddr, tethered: boolean ) => void;

	/** This callback allows the grabbable's owner to override the default behavior
	 * when the grabbable is grabbed. If this is not specified, the grabbable's transform
	 * will be updated to match the grabber whenever it is grabbed.
	 * 
	 * @default grabbing moves the grabbable
	 */
	onGrabRequest?: ( event: AvGrabEvent ) => Promise<GrabResponse>;

	/** This callback allows the grabbables owner to respond when the transform for the
	 * grabbable has been updated as the result of being grabbed.
	 * 
	 * * parentFromNode - The transform from the coordinate system of the grabbable itself to the 
	 * 		coordinate system of its parent in the scene graph.
	 * * universeFromNode - The transform from the coordinate system of the grabbable itself to
	 * 		the coordinate system of the "universe", which means the center of the user's play area.
	 */
	onTransformUpdated?: ( parentFromNode: AvNodeTransform, universeFromNode: AvNodeTransform ) => void;

	/** Defines the constraints to apply to the transform of the grabbable after it has been 
	 * grabbed.
	 * 
	 * @default No constraints
	 */
	constraint?: AvConstraint;

	/** If this prop is true, the grabbable will stay wherever it was dropped at the end of a 
	 * grab. If preserveDropTransform is false for the root grabbable of a gadget, that gadget
	 * will not be able to be dropped in the world, and will be destroyed when dropped anywhere
	 * other than a hook
	 * 
	 * @default false
	 */
	preserveDropTransform?: boolean;

	/** The initial transform of the grabbable before it has been grabbed. 
	 * 
	 * @default identity transform
	 */
	initialTransform?: AvNodeTransform;

	/** If this prop is true the grabbable can be attached to hooks by dropping on them.
	 * 
	 * @default false
	 */
	dropOnHooks?: boolean;

	/** If this is true, the grabbable will always be grabbed with an identity transform
	 * instead of preserving the transform between the grabbable and the grabber at the
	 * start of the grab.
	 * 
	 * @default false
	 */
	grabWithIdentityTransform?: boolean;
}

interface AvGrabbableState
{
	/** If this grabbable is tethered to a hook, this will be the EPA of the hook. */
	hook?: EndpointAddr;

	/** If this grabbable is tethered to a hook, this will be the transform from
	 * the grabbable to the hook.
	 */
	hookFromGrabbable?: AvNodeTransform;

	/** The last highlight that we told anyone. */
	lastHighlight: HighlightType;

	/** The last handle that we told anyone */
	lastHandle: EndpointAddr;

}


/** This is a node that can be grabbed. Depending on how it is configured, the node
 * may be reparented to the grabber, or it may just call back the owner with its 
 * updated grab state.
 */
export class AvGrabbable extends AvBaseNode< AvGrabbableProps, AvGrabbableState >
{
	/** The last highlight that we told anyone. */
	private m_lastNotifiedHighlight: HighlightType = HighlightType.None;
	private m_lastNotifiedHandle: EndpointAddr = null;
	private m_lastNotifiedTethered: boolean = false;

	constructor( props: any )
	{
		super( props );

		this.state = 
		{ 
			lastHighlight: HighlightType.None,
			lastHandle: null,
		};
	}

	public buildNode()
	{
		AvGadget.instance().setGrabEventProcessor( this.m_nodeId, this.onGrabEvent );
		let node = this.createNodeObject( AvNodeType.Grabbable, this.m_nodeId );
		if( this.props.constraint )
		{
			node.propConstraint = this.props.constraint;
		}
		if( this.props.initialTransform )
		{
			node.propTransform = this.props.initialTransform;
		}
		if( this.props.onTransformUpdated )
		{
			node.flags |= ENodeFlags.NotifyOnTransformChange;
		}
		if( this.props.preserveDropTransform )
		{
			node.flags |= ENodeFlags.PreserveGrabTransform;
		}
		if( this.props.dropOnHooks && !this.state.hook )
		{
			node.flags |= ENodeFlags.AllowDropOnHooks;
		}
		if( this.state.hook )
		{
			node.flags |= ENodeFlags.Tethered;
		}

		return node;
	}

	public grabInProgress( grabber: EndpointAddr ):void
	{
		//console.log( `Starting out grabbed by ${ endpointAddrToString( grabber) }` );
		this.setState( { lastHighlight: HighlightType.Grabbed } );
	}

	public componentDidUpdate()
	{
		if( this.props.updateHighlight )
		{
			if( this.state.lastHighlight != this.m_lastNotifiedHighlight
				|| this.state.lastHandle != this.m_lastNotifiedHandle 
				|| !!this.state.hook != this.m_lastNotifiedTethered )
			{
				this.m_lastNotifiedHighlight = this.state.lastHighlight;
				this.m_lastNotifiedHandle = this.state.lastHandle;
				this.m_lastNotifiedTethered = !!this.state.hook;
				this.props.updateHighlight( this.state.lastHighlight, this.state.lastHandle, !!this.state.hook );
			}
		}
	}

	@bind private onGrabEvent( evt: AvGrabEvent )
	{
//		console.log( `Grab event ${ AvGrabEventType[ evt.type ] }` );
		switch( evt.type )
		{
			case AvGrabEventType.EnterRange:
				this.setState( { lastHighlight: HighlightType.InRange, lastHandle: evt.handleId } );
				break;

			case AvGrabEventType.LeaveRange:
				this.setState( { lastHighlight: HighlightType.None, lastHandle: null } );
				break;

			case AvGrabEventType.StartGrab:
				this.setState( { lastHighlight: HighlightType.Grabbed, lastHandle: null } );
				break;

			case AvGrabEventType.EndGrab:
				this.setState( 
					{ 
						lastHighlight: HighlightType.InRange, 
						lastHandle: evt.handleId,
						hook: evt.hookId,
						hookFromGrabbable: evt.hookFromGrabbable,
					} );
				break;

			case AvGrabEventType.Detach:
				this.setState( { lastHighlight: HighlightType.Grabbed, lastHandle: evt.handleId, 
					hook: null, hookFromGrabbable: null } );
				break;

			case AvGrabEventType.EnterHookRange:
				this.setState( { lastHighlight: HighlightType.InHookRange, lastHandle: evt.handleId } );
				break;

			case AvGrabEventType.LeaveHookRange:
				this.setState( { lastHighlight: HighlightType.Grabbed, lastHandle: evt.handleId } );
				break;

			case AvGrabEventType.RequestGrab:
				if( !this.props.onGrabRequest )
				{
					// The grabber is asking us for permission. If our owner has
					// no opinion, just say yes.
					AvGadget.instance().sendGrabEvent(
						{
							type: AvGrabEventType.RequestGrabResponse,
							senderId: this.m_nodeId,
							grabbableId: evt.grabbableId,
							handleId: evt.handleId,
							grabberId: evt.grabberId,
							requestId: evt.requestId,
							useIdentityTransform: this.props.grabWithIdentityTransform,
							allowed: true,
						});
				}
				else
				{
					this.props.onGrabRequest( evt )
					.then( ( response: GrabResponse ) =>
					{
						let grabbableId: EndpointAddr;
						let handleId: EndpointAddr;
						if( response.proxyGrabbableGlobalId )
						{
							grabbableId = response.proxyGrabbableGlobalId;
							handleId = response.proxyHandleGlobalId;
						}
						else
						{
							grabbableId = evt.grabbableId;
							handleId = evt.handleId;
						}

						AvGadget.instance().sendGrabEvent(
							{
								type: AvGrabEventType.RequestGrabResponse,
								senderId: this.m_nodeId,
								grabbableId: grabbableId,
								handleId: handleId,
								grabberId: evt.grabberId,
								requestId: evt.requestId,
								allowed: response.allowed,
							});
					})
					.catch( ( reason: any ) =>
					{
						console.log( "Promise from onGrabRequest was unfulfilled", reason );
						AvGadget.instance().sendGrabEvent(
							{
								type: AvGrabEventType.RequestGrabResponse,
								senderId: this.m_nodeId,
								grabbableId: evt.grabbableId,
								handleId: evt.handleId,
								grabberId: evt.grabberId,
								requestId: evt.requestId,
								allowed: false,
							});
					});
				}
				break;

			case AvGrabEventType.TransformUpdated:
				if( this.props.onTransformUpdated )
				{
					this.props.onTransformUpdated( evt.parentFromNode, evt.universeFromNode );
				}
		}
	}
}
