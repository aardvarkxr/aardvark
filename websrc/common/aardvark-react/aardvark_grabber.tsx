import * as React from 'react';

import { AvGadget } from './aardvark_gadget';
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
	radius: number;
}

export class AvGrabber extends AvBaseNode< AvGrabberProps, {} >
{
	m_lastHighlight = GrabberHighlight.None;
	m_lastGrabbable:string = null;
	m_lastHook: string = null;

	public startNode( context:AvSceneContext )
	{
		context.startNode( this.m_nodeId, "grabber" + this.m_nodeId, AvNodeType.Grabber );
		context.setSphereVolume( this.props.radius );

		AvGadget.instance().setGrabberProcessor( this.m_nodeId, this.onGrabberIntersections );
	}

	@bind private onGrabberIntersections( isPressed: boolean, grabbableIds: string[], hookIds: string[] )
	{
		let newHighlight = this.m_lastHighlight;
	
		let newHookId: string = null;
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
					AvGadget.instance().sendGrabEvent( this.m_nodeId, 
						this.m_lastGrabbable, null, AvGrabEventType.EndGrab );
					newHighlight = GrabberHighlight.InRange;
				}

				if( newHighlight == GrabberHighlight.InRange )
				{
					AvGadget.instance().sendGrabEvent( this.m_nodeId, 
						this.m_lastGrabbable, null, AvGrabEventType.LeaveRange );
					newHighlight = GrabberHighlight.InRange;
					this.m_lastGrabbable = null;
				}

				if( grabbableIds.length > 0 )
				{
					newGrabbableId = grabbableIds[0];
				}
			}
		}

		// try to stick with the same hook if possible
		if( this.m_lastHook && -1 != hookIds.indexOf( this.m_lastHook ) )
		{
			newHookId = this.m_lastHook;
		}
		else if( hookIds.length > 0 )
		{
			newHookId = hookIds[0];
		}

		if( !newGrabbableId && grabbableIds.length > 0 )
		{
			newGrabbableId = grabbableIds[ 0 ];
		}

		if( newGrabbableId )
		{
			if( newGrabbableId == this.m_lastGrabbable )
			{
				// same grabbable as last time. Just update the grab state
				if( isPressed && newHighlight == GrabberHighlight.InRange )
				{
					AvGadget.instance().sendGrabEvent( this.m_nodeId,
						newGrabbableId, null, AvGrabEventType.StartGrab );
					newHighlight = GrabberHighlight.Grabbed;
				}
				else if( !isPressed && newHighlight == GrabberHighlight.Grabbed )
				{
					AvGadget.instance().sendGrabEvent( this.m_nodeId,
						newGrabbableId, newHookId, AvGrabEventType.EndGrab );
					newHighlight = GrabberHighlight.InRange;
				}
			}
			else
			{
				// new grabbable. Update in range and maybe grab
				AvGadget.instance().sendGrabEvent( this.m_nodeId,
					newGrabbableId, null, AvGrabEventType.EnterRange );
				newHighlight = GrabberHighlight.InRange;

				if( isPressed )
				{
					AvGadget.instance().sendGrabEvent( this.m_nodeId,
						newGrabbableId, null, AvGrabEventType.StartGrab );
					newHighlight = GrabberHighlight.Grabbed;
				}

				this.m_lastGrabbable = newGrabbableId;
			}
		}

		if( newHighlight != GrabberHighlight.Grabbed )
		{
			// if we're not grabbing we don't want to highlight any hooks
			newHookId = null;
		}

		if( newHookId != this.m_lastHook )
		{
			// notify any hooks we entered/left
			if( this.m_lastHook )
			{
				AvGadget.instance().sendGrabEvent( this.m_nodeId, 
					null, this.m_lastHook, AvGrabEventType.LeaveHookRange );
			}

			if( newHookId )
			{
				AvGadget.instance().sendGrabEvent( this.m_nodeId, 
					null, newHookId, AvGrabEventType.EnterHookRange );
			}

			this.m_lastHook = newHookId;
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
