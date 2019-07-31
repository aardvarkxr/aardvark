import * as React from 'react';

import { AvGadget } from './aardvark_gadget';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvSceneContext, AvNodeType, AvGrabEvent, AvGrabEventType } from 'common/aardvark';
import bind from 'bind-decorator';

export interface GrabResponse
{
	allowed: boolean;
	proxyGrabbableGlobalId?: string;
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
}

export class AvGrabbable extends AvBaseNode< AvGrabbableProps, {} >
{
	m_lastHighlight = HighlightType.None;

	public startNode( context:AvSceneContext )
	{
		context.startNode( this.m_nodeId, "grabbable" + this.m_nodeId, AvNodeType.Grabbable );

		AvGadget.instance().setGrabEventProcessor( this.m_nodeId, this.onGrabEvent );
	}

	@bind private onGrabEvent( evt: AvGrabEvent )
	{
		var newHighlight = HighlightType.None;
	
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
						AvGadget.instance().sendGrabEvent(
							{
								type: AvGrabEventType.RequestGrabResponse,
								senderId: this.m_nodeId,
								grabbableId: response.proxyGrabbableGlobalId ? response.proxyGrabbableGlobalId : evt.grabbableId,
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
								grabberId: evt.grabberId,
								requestId: evt.requestId,
								allowed: false,
							});
					});
				}
				break;

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
