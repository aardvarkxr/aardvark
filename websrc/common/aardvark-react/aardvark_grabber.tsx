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
	WaitingForGrabToStart = 3,
	Grabbed = 4,
	NearHook = 5,
	WaitingForReleaseAfterRejection = 6,
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
	m_grabRequestId = 1;
	
	public startNode( context:AvSceneContext )
	{
		context.startNode( this.m_nodeId, "grabber" + this.m_nodeId, AvNodeType.Grabber );
		context.setSphereVolume( this.props.radius );

		AvGadget.instance().setGrabberProcessor( this.m_nodeId, this.onGrabberIntersections );
		AvGadget.instance().setGrabEventProcessor( this.m_nodeId, this.onGrabEvent );
	}

	@bind private onGrabEvent( evt: AvGrabEvent )
	{
		let prevHighlight = this.m_lastHighlight;
		switch( evt.type )
		{
			case AvGrabEventType.CancelGrab:
				break;

			case AvGrabEventType.RequestGrabResponse:
				assert( this.m_lastHighlight == GrabberHighlight.WaitingForConfirmation );
				assert( this.m_grabRequestId == evt.requestId );
				if( evt.allowed )
				{
					// switch to the grabbable specified by the response
					let useIdentityTransform = false;
					if( evt.grabbableId != this.m_lastGrabbable )
					{
						AvGadget.instance().sendGrabEvent( 
							{
								type: AvGrabEventType.LeaveRange,
								senderId: this.m_nodeId,
								grabbableId: this.m_lastGrabbable
							});
						AvGadget.instance().sendGrabEvent( 
							{
								type: AvGrabEventType.EnterRange,
								senderId: this.m_nodeId,
								grabbableId: evt.grabbableId,
							});
						this.m_lastGrabbable = evt.grabbableId;
						useIdentityTransform = true;
					}

					AvGadget.instance().sendGrabEvent( 
						{
							type: AvGrabEventType.StartGrab,
							senderId: this.m_nodeId,
							grabbableId: this.m_lastGrabbable,
							useIdentityTransform,
						});
					this.m_lastHighlight = GrabberHighlight.WaitingForGrabToStart;
				}
				else
				{
					this.m_lastHighlight = GrabberHighlight.WaitingForReleaseAfterRejection;
				}
				break;

			case AvGrabEventType.GrabStarted:
				console.log( "GrabStarted event received for " + evt.grabbableId + " being grabbed by " + evt.grabberId );
				assert( this.m_lastHighlight == GrabberHighlight.WaitingForGrabToStart );
				this.m_lastHighlight = GrabberHighlight.Grabbed;
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
				
				AvGadget.instance().sendGrabEvent( 
					{
						type: AvGrabEventType.EnterRange,
						senderId: this.m_nodeId,
						grabbableId: this.m_lastGrabbable
					});

				// FALL THROUGH (in case we also pressed on the same frame)

			case GrabberHighlight.InRange:
				assert( this.m_lastGrabbable != null );
				if( -1 == grabbableIds.indexOf( this.m_lastGrabbable ) )
				{
					// stop being in range.
					AvGadget.instance().sendGrabEvent( 
						{
							type: AvGrabEventType.LeaveRange,
							senderId: this.m_nodeId,
							grabbableId: this.m_lastGrabbable
						});
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
				this.m_grabRequestId++;
				AvGadget.instance().sendGrabEvent( 
					{
						type: AvGrabEventType.RequestGrab,
						senderId: this.m_nodeId,
						grabbableId: this.m_lastGrabbable,
						requestId: this.m_grabRequestId,
					});
				this.m_lastHighlight = GrabberHighlight.WaitingForConfirmation;
				break;

			case GrabberHighlight.WaitingForConfirmation:
				// nothing to do here until we hear from the thing we sent a grab request to
				break;

			case GrabberHighlight.WaitingForGrabToStart:
				// nothing to do here until we hear back from the renderer that our grab has 
				// started.
				break;

			case GrabberHighlight.WaitingForReleaseAfterRejection:
				// when the button gets released, go back to in range
				if( !isPressed )
				{
					this.m_lastHighlight = GrabberHighlight.InRange;
				}
				break;
				
			case GrabberHighlight.Grabbed:
				if( -1 == grabbableIds.indexOf( this.m_lastGrabbable ) )
				{
					// cancel grabbing
					console.log( "Ending grab of " + this.m_lastGrabbable + " because it wasn't in the grabbable list")
					AvGadget.instance().sendGrabEvent( 
						{
							type: AvGrabEventType.EndGrab,
							senderId: this.m_nodeId,
							grabbableId: this.m_lastGrabbable
						});
					this.m_lastHighlight = GrabberHighlight.InRange;
					break;
				}

				if( hookIds.length > 0 )
				{
					// we handle hooks before dropping in case we got the
					// unpress and the hook in the same update
					this.m_lastHook = hookIds[0];
					AvGadget.instance().sendGrabEvent( 
						{
							type: AvGrabEventType.EnterHookRange,
							senderId: this.m_nodeId,
							grabbableId: this.m_lastGrabbable,
							hookId: this.m_lastHook,
						});
					this.m_lastHighlight = GrabberHighlight.NearHook;
					break;
				}

				if( !isPressed )
				{
					// drop not on a hook
					AvGadget.instance().sendGrabEvent( 
						{
							type: AvGrabEventType.EndGrab,
							senderId: this.m_nodeId,
							grabbableId: this.m_lastGrabbable
						});
					this.m_lastHighlight = GrabberHighlight.InRange;
					break;
				}
				break;

			case GrabberHighlight.NearHook:
				if( -1 == hookIds.indexOf( this.m_lastHook ) || -1 == grabbableIds.indexOf( this.m_lastGrabbable ) )
				{
					// losing our hook or grabbable both kick us back to Grabbed. The next update will change our
					// phase from there. 
					AvGadget.instance().sendGrabEvent( 
						{
							type: AvGrabEventType.LeaveHookRange,
							senderId: this.m_nodeId,
							grabbableId: this.m_lastGrabbable,
							hookId: this.m_lastHook,
						});
					this.m_lastHook = null;
					this.m_lastHighlight = GrabberHighlight.Grabbed;
					break;
				}

				if( !isPressed )
				{
					// a drop on a hook
					AvGadget.instance().sendGrabEvent( 
						{
							type: AvGrabEventType.LeaveHookRange,
							senderId: this.m_nodeId,
							grabbableId: this.m_lastGrabbable,
							hookId: this.m_lastHook,
						});
					AvGadget.instance().sendGrabEvent( 
						{
							type: AvGrabEventType.EndGrab,
							senderId: this.m_nodeId,
							grabbableId: this.m_lastGrabbable,
							hookId: this.m_lastHook,
						});
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
