import * as React from 'react';

import { AvApp } from './aardvark_app';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvSceneContext, AvNodeType, AvGrabEventType } from 'common/aardvark';
import bind from 'bind-decorator';

export enum GrabberHighlight
{
	None = 0,
	InRange = 1,
	Grabbed = 2,
}

interface AvGrabberProps extends AvBaseNodeProps
{
	updateHighlight?: ( highlightType: GrabberHighlight ) => void;
}

export class AvGrabber extends AvBaseNode< AvGrabberProps, {} >
{
	m_lastHighlight = GrabberHighlight.None;
	m_lastGrabbable:string = null;

	public startNode( context:AvSceneContext )
	{
		context.startNode( this.m_nodeId, "grabber" + this.m_nodeId, AvNodeType.Grabber );

		AvApp.instance().setGrabberProcessor( this.m_nodeId, this.onGrabberIntersections );
	}

	@bind private onGrabberIntersections( isPressed: boolean, grabbableIds: string[] )
	{
		let newHighlight = this.m_lastHighlight;
	
		let newGrabbableId:string = null;
		if( this.m_lastGrabbable )
		{
			// try to stick with the same grabbable if possible
			if( -1 != grabbableIds.indexOf( this.m_lastGrabbable ) )
			{
				newGrabbableId = this.m_lastGrabbable;
			}
			else
			{
				// we lost our grabbable, so let it know that
				if( newHighlight == GrabberHighlight.Grabbed )
				{
					AvApp.instance().sendGrabEvent( this.m_nodeId, 
						this.m_lastGrabbable, AvGrabEventType.EndGrab );
					newHighlight = GrabberHighlight.InRange;
				}

				if( newHighlight == GrabberHighlight.InRange )
				{
					AvApp.instance().sendGrabEvent( this.m_nodeId, 
						this.m_lastGrabbable, AvGrabEventType.LeaveRange );
					newHighlight = GrabberHighlight.InRange;
					this.m_lastGrabbable = null;
				}

				if( grabbableIds.length > 0 )
				{
					newGrabbableId = grabbableIds[0];
				}
			}
		}

		if( newGrabbableId )
		{
			if( newGrabbableId == this.m_lastGrabbable )
			{
				// same grabbable as last time. Just update the grab state
				if( isPressed && newHighlight == GrabberHighlight.InRange )
				{
					AvApp.instance().sendGrabEvent( this.m_nodeId,
						newGrabbableId, AvGrabEventType.StartGrab );
					newHighlight = GrabberHighlight.Grabbed;
				}
				else if( !isPressed && newHighlight == GrabberHighlight.Grabbed )
				{
					AvApp.instance().sendGrabEvent( this.m_nodeId,
						newGrabbableId, AvGrabEventType.EndGrab );
					newHighlight = GrabberHighlight.InRange;
				}
			}
			else
			{
				// new grabbable. Update in range and maybe grab
				AvApp.instance().sendGrabEvent( this.m_nodeId,
					newGrabbableId, AvGrabEventType.EnterRange );
				newHighlight = GrabberHighlight.InRange;

				if( isPressed )
				{
					AvApp.instance().sendGrabEvent( this.m_nodeId,
						newGrabbableId, AvGrabEventType.StartGrab );
					newHighlight = GrabberHighlight.Grabbed;
				}

				this.m_lastGrabbable = newGrabbableId;
			}
		}

		if( this.m_lastHighlight != newHighlight )
		{
			this.m_lastHighlight = newHighlight;
			if( this.props.updateHighlight )
			{
				this.props.updateHighlight( this.m_lastHighlight );
			}
		}
	}

}
