import * as React from 'react';

import { AvGadget } from './aardvark_gadget';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvSceneContext, AvNodeType, AvGrabEventType, AvGrabEvent } from 'common/aardvark';
import bind from 'bind-decorator';

function assert( expr: boolean, msg?: string )
{
	if( !expr )
	{
		if( msg )
		{
			throw msg;
		}
		else
		{
			throw "assertion failed";
		}
	}
}

export enum GrabberHighlight
{
	None = 0,
	InRange = 1,
	WaitingForConfirmation = 2,
	Grabbed = 3,
	NearHook = 4,
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

	@bind private onGrabEvent( evt: AvGrabEvent )
	{
		switch( evt.type )
		{
			case AvGrabEventType.CancelGrab:
				break;

			case AvGrabEventType.RequestGrabResponse:
				break;

			default:
				throw "Unexpected grab event in grabber";
		}
	}

	@bind private onGrabberIntersections( isPressed: boolean, grabbableIds: string[], hookIds: string[] )
	{
		let prevHighlight = this.m_lastHighlight;
		switch( this.m_lastHighlight )
		{
			case GrabberHighlight.None:
				assert( this.m_lastGrabbable == null );

				// if we have no grabbables, we have nothing to do
				if( grabbableIds.length == 0 )
					break;

				this.m_lastGrabbable = grabbableIds[0];
				this.m_lastHighlight = GrabberHighlight.InRange;
				
				AvGadget.instance().sendGrabEvent( this.m_nodeId,
					this.m_lastGrabbable, null, AvGrabEventType.EnterRange );

				// FALL THROUGH (in case we also pressed on the same frame)

			case GrabberHighlight.InRange:
				if( -1 == grabbableIds.indexOf( this.m_lastGrabbable ) )
				{
					// stop being in range.
					AvGadget.instance().sendGrabEvent( this.m_nodeId,
						this.m_lastGrabbable, null, AvGrabEventType.LeaveRange );
					this.m_lastGrabbable = null;
					this.m_lastHighlight = GrabberHighlight.None;
					break;
				}

				if( !isPressed )
				{
					// if the user didn't press grab we have nothing else to do
					break;
				}

				// we were in range and pressed the grab button. Ask the
				// grabbable if we can grab them.
				AvGadget.instance().sendGrabEvent( this.m_nodeId,
					this.m_lastGrabbable, null, AvGrabEventType.StartGrab );
				this.m_lastHighlight = GrabberHighlight.Grabbed;

				// FALL THROUGH ( in case we're also near a hook )

			case GrabberHighlight.Grabbed:
				if( -1 == grabbableIds.indexOf( this.m_lastGrabbable ) )
				{
					// cancel grabbing
					AvGadget.instance().sendGrabEvent( this.m_nodeId,
						this.m_lastGrabbable, null, AvGrabEventType.EndGrab );
					this.m_lastHighlight = GrabberHighlight.InRange;
					break;
				}

				if( hookIds.length > 0 )
				{
					// we handle hooks before dropping in case we got the
					// unpress and the hook in the same update
					this.m_lastHook = hookIds[0];
					AvGadget.instance().sendGrabEvent( this.m_nodeId,
						this.m_lastGrabbable, this.m_lastHook, AvGrabEventType.EnterHookRange );
					this.m_lastHighlight = GrabberHighlight.NearHook;
					break;
				}

				if( !isPressed )
				{
					// drop not on a hook
					AvGadget.instance().sendGrabEvent( this.m_nodeId,
						this.m_lastGrabbable, null, AvGrabEventType.EndGrab );
					this.m_lastHighlight = GrabberHighlight.InRange;
					break;
				}
				break;

			case GrabberHighlight.NearHook:
				if( -1 == hookIds.indexOf( this.m_lastHook ) || -1 == grabbableIds.indexOf( this.m_lastGrabbable ) )
				{
					// losing our hook or grabbable both kick us back to Grabbed. The next update will change our
					// phase from there. 
					AvGadget.instance().sendGrabEvent( this.m_nodeId,
						this.m_lastGrabbable, this.m_lastHook, AvGrabEventType.LeaveHookRange );
					this.m_lastHook = null;
					this.m_lastHighlight = GrabberHighlight.Grabbed;
					break;
				}

				if( !isPressed )
				{
					// a drop on a hook
					AvGadget.instance().sendGrabEvent( this.m_nodeId,
						this.m_lastGrabbable, this.m_lastHook, AvGrabEventType.LeaveHookRange );
					AvGadget.instance().sendGrabEvent( this.m_nodeId,
						this.m_lastGrabbable, this.m_lastHook, AvGrabEventType.EndGrab );
					this.m_lastHighlight = GrabberHighlight.InRange;
					break;
				}
				break;
		}

		if( prevHighlight != this.m_lastHighlight )
		{
			if( this.props.updateHighlight )
			{
				this.props.updateHighlight( this.m_lastHighlight );
			}
		}
	}
}
