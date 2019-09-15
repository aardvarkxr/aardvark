import * as React from 'react';

import { AvGadget } from './aardvark_gadget';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvNodeType, AvGrabEvent, AvGrabEventType, AvConstraint, AvNodeTransform, ENodeFlags } from 'common/aardvark';
import bind from 'bind-decorator';
import { EndpointAddr, endpointAddrToString } from './aardvark_protocol';

export interface GrabResponse
{
	allowed: boolean;
	proxyGrabbableGlobalId?: EndpointAddr;
	proxyHandleGlobalId?: EndpointAddr;
}

export enum HighlightType
{
	None = 0,
	InRange = 1,
	Grabbed = 2,
	InHookRange = 3,
}

interface AvGrabbableProps extends AvBaseNodeProps
{
	updateHighlight?: ( highlightType: HighlightType ) => void;
	onGrabRequest?: ( event: AvGrabEvent ) => Promise<GrabResponse>;
	onTransformUpdated?: ( parentFromNode: AvNodeTransform, universeFromNode: AvNodeTransform ) => void;
	constraint?: AvConstraint;
	preserveDropTransform?: boolean;
}

export class AvGrabbable extends AvBaseNode< AvGrabbableProps, {} >
{
	m_lastHighlight = HighlightType.None;

	public buildNode()
	{
		AvGadget.instance().setGrabEventProcessor( this.m_nodeId, this.onGrabEvent );
		let node = this.createNodeObject( AvNodeType.Grabbable, this.m_nodeId );
		if( this.props.constraint )
		{
			node.propConstraint = this.props.constraint;
		}
		if( this.props.onTransformUpdated )
		{
			node.flags |= ENodeFlags.NotifyOnTransformChange;
		}
		if( this.props.preserveDropTransform )
		{
			node.flags |= ENodeFlags.PreserveGrabTransform;
		}
		return node;
	}

	public grabInProgress( grabber: EndpointAddr ):void
	{
		//console.log( `Starting out grabbed by ${ endpointAddrToString( grabber) }` );
		this.m_lastHighlight = HighlightType.Grabbed;
		if( this.props.updateHighlight )
		{
			this.props.updateHighlight( this.m_lastHighlight );
		}
	}

	@bind private onGrabEvent( evt: AvGrabEvent )
	{
//		console.log( `Grab event ${ AvGrabEventType[ evt.type ] }` );

		// by default, don't change the highlight
		var newHighlight = this.m_lastHighlight;

		switch( evt.type )
		{
			case AvGrabEventType.EnterRange:
				newHighlight = HighlightType.InRange;
				break;

			case AvGrabEventType.LeaveRange:
				break;

			case AvGrabEventType.StartGrab:
				newHighlight = HighlightType.Grabbed;
				break;

			case AvGrabEventType.EndGrab:
				newHighlight = HighlightType.InRange;
				break;

			case AvGrabEventType.EnterHookRange:
				newHighlight = HighlightType.InHookRange;
				break;

			case AvGrabEventType.LeaveHookRange:
				newHighlight = HighlightType.Grabbed;
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
			if( this.props.updateHighlight )
			{
				this.props.updateHighlight( this.m_lastHighlight );
			}
		}
	}

}
