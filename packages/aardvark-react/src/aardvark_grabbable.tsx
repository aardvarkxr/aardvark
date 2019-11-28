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

	/** There is a grabber actively grabbing the grabbable. */
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
	updateHighlight?: ( highlightType: HighlightType, handleAddr: EndpointAddr ) => void;

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
}

/** This is a node that can be grabbed. Depending on how it is configured, the node
 * may be reparented to the grabber, or it may just call back the owner with its 
 * updated grab state.
 */
export class AvGrabbable extends AvBaseNode< AvGrabbableProps, {} >
{
	private m_lastHighlight = HighlightType.None;
	private m_lastHandle: EndpointAddr = null;

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
		if( this.props.dropOnHooks )
		{
			node.flags |= ENodeFlags.AllowDropOnHooks;
		}
		
		return node;
	}

	public grabInProgress( grabber: EndpointAddr ):void
	{
		//console.log( `Starting out grabbed by ${ endpointAddrToString( grabber) }` );
		this.m_lastHighlight = HighlightType.Grabbed;
		if( this.props.updateHighlight )
		{
			this.props.updateHighlight( this.m_lastHighlight, this.m_lastHandle );
		}
	}

	@bind private onGrabEvent( evt: AvGrabEvent )
	{
//		console.log( `Grab event ${ AvGrabEventType[ evt.type ] }` );

		// by default, don't change the highlight
		let newHighlight = this.m_lastHighlight;
		let newHandle = this.m_lastHandle;

		switch( evt.type )
		{
			case AvGrabEventType.EnterRange:
				newHighlight = HighlightType.InRange;
				newHandle = evt.handleId;
				break;

			case AvGrabEventType.LeaveRange:
				newHighlight = HighlightType.None;
				newHandle = null;
				break;

			case AvGrabEventType.StartGrab:
				newHighlight = HighlightType.Grabbed;
				newHandle = evt.handleId;
				break;

			case AvGrabEventType.EndGrab:
				newHighlight = HighlightType.InRange;
				newHandle = evt.handleId;
				break;

			case AvGrabEventType.EnterHookRange:
				newHighlight = HighlightType.InHookRange;
				newHandle = evt.handleId;
				break;

			case AvGrabEventType.LeaveHookRange:
				newHighlight = HighlightType.Grabbed;
				newHandle = evt.handleId;
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

		if( newHighlight != this.m_lastHighlight )
		{
			this.m_lastHighlight = newHighlight;
			this.m_lastHandle = newHandle;
			if( this.props.updateHighlight )
			{
				this.props.updateHighlight( this.m_lastHighlight, newHandle );
			}
		}
	}

}
