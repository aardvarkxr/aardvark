import { EndpointAddr, indexOfEndpointAddrs, endpointAddrsMatch, MsgGrabberState } from 'common/aardvark-react/aardvark_protocol';
import { AvGrabEvent, AvGrabEventType, GrabberHighlight } from './../aardvark';
import { assert } from './aardvark_utils';


interface GrabContext
{
	sendGrabEvent( event: AvGrabEvent ): void;
	grabberEpa: EndpointAddr;
}

export class CGrabStateProcessor
{
	m_lastHighlight = GrabberHighlight.None;
	m_lastGrabbable:EndpointAddr = null;
	m_grabStartTime: DOMHighResTimeStamp = null;
	m_lastHook: EndpointAddr = null;
	m_grabRequestId = 1;
	m_context: GrabContext;

	constructor( context: GrabContext )
	{
		this.m_context = context;
	}

	public onGrabEvent( evt: AvGrabEvent )
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
					if( !endpointAddrsMatch( evt.grabbableId, this.m_lastGrabbable ) )
					{
						this.m_context.sendGrabEvent( 
							{
								type: AvGrabEventType.LeaveRange,
								senderId: this.m_context.grabberEpa.nodeId,
								grabberId: this.m_context.grabberEpa,
								grabbableId: this.m_lastGrabbable
							});
							this.m_context.sendGrabEvent( 
							{
								type: AvGrabEventType.EnterRange,
								senderId: this.m_context.grabberEpa.nodeId,
								grabberId: this.m_context.grabberEpa,
								grabbableId: evt.grabbableId,
							});
						this.m_lastGrabbable = evt.grabbableId;
						useIdentityTransform = true;
					}

					// console.log( `sending grab by ${ endpointAddrToString( this.m_context.grabberEpa )}`
					// 	+ ` of ${ endpointAddrToString( this.m_lastGrabbable ) }` );
					this.m_context.sendGrabEvent( 
						{
							type: AvGrabEventType.StartGrab,
							senderId: this.m_context.grabberEpa.nodeId,
							grabberId: this.m_context.grabberEpa,
							grabbableId: this.m_lastGrabbable,
							useIdentityTransform,
						});
					this.m_grabStartTime = performance.now();
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
			this.m_context.sendGrabEvent( 
				{ 
					type: AvGrabEventType.UpdateGrabberHighlight, 
					grabberId: this.m_context.grabberEpa,
					highlight: this.m_lastHighlight,
				} );
		}
	}

	public onGrabberIntersections( state: MsgGrabberState )
	{
		if( this.m_lastGrabbable && this.m_lastHighlight == GrabberHighlight.Grabbed
			&& -1 == indexOfEndpointAddrs( state.grabbables, this.m_lastGrabbable ) 
			&& state.isPressed )
		{
			// The thing we think we're grabbing isn't in the grabbable list.
			// This can happen if grabber intersections are in flight when the grab starts,
			// or if the grabbable is a new thing that is slow to send its first scene graph.
			
			// just ignore grabber intersections that arrive in the first second of a grab
			// if they don't include the thing they ought to include.
			if( ( this.m_grabStartTime - performance.now() ) < 1000 )
				return;
		}

		//console.log( `grabberIntersections for ${ endpointAddrToString( this.m_context.grabberEpa )}` );
		let prevHighlight = this.m_lastHighlight;
		switch( this.m_lastHighlight )
		{
			case GrabberHighlight.None:
				assert( this.m_lastGrabbable == null );

				// if we have no grabbables, we have nothing to do
				if( !state.grabbables || state.grabbables.length == 0 )
					break;

				this.m_lastGrabbable = state.grabbables[0];
				this.m_lastHighlight = GrabberHighlight.InRange;
				
				this.m_context.sendGrabEvent( 
					{
						type: AvGrabEventType.EnterRange,
						senderId: this.m_context.grabberEpa.nodeId,
						grabberId: this.m_context.grabberEpa,
						grabbableId: this.m_lastGrabbable
					});

				// FALL THROUGH (in case we also pressed on the same frame)

			case GrabberHighlight.InRange:
				assert( this.m_lastGrabbable != null );
				if( -1 == indexOfEndpointAddrs( state.grabbables, this.m_lastGrabbable ) )
				{
					// stop being in range.
					this.m_context.sendGrabEvent( 
						{
							type: AvGrabEventType.LeaveRange,
							senderId: this.m_context.grabberEpa.nodeId,
							grabberId: this.m_context.grabberEpa,
							grabbableId: this.m_lastGrabbable
						});
					this.m_lastGrabbable = null;
					this.m_lastHighlight = GrabberHighlight.None;
					break;
				}

				if( !state.isPressed )
				{
					// if the user didn't press grab we have nothing else to do
					break;
				}

				// we were in range and pressed the grab button. Ask the
				// grabbable if we can grab them.
				this.m_grabRequestId++;
				this.m_context.sendGrabEvent( 
					{
						type: AvGrabEventType.RequestGrab,
						senderId: this.m_context.grabberEpa.nodeId,
						grabberId: this.m_context.grabberEpa,
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
				if( !state.isPressed )
				{
					this.m_lastHighlight = GrabberHighlight.InRange;
				}
				break;
				
			case GrabberHighlight.Grabbed:
				if( -1 == indexOfEndpointAddrs( state.grabbables, this.m_lastGrabbable ) )
				{
					// cancel grabbing
					console.log( "Ending grab of " + this.m_lastGrabbable 
						+ " because it wasn't in the grabbable list");
					this.m_context.sendGrabEvent( 
						{
							type: AvGrabEventType.EndGrab,
							senderId: this.m_context.grabberEpa.nodeId,
							grabberId: this.m_context.grabberEpa,
							grabbableId: this.m_lastGrabbable
						});
					this.m_lastHighlight = GrabberHighlight.InRange;
					break;
				}

				if( state.hooks && state.hooks.length > 0 )
				{
					// we handle hooks before dropping in case we got the
					// unpress and the hook in the same update
					this.m_lastHook = state.hooks[0];
					this.m_context.sendGrabEvent( 
						{
							type: AvGrabEventType.EnterHookRange,
							senderId: this.m_context.grabberEpa.nodeId,
							grabberId: this.m_context.grabberEpa,
							grabbableId: this.m_lastGrabbable,
							hookId: this.m_lastHook,
						});
					this.m_lastHighlight = GrabberHighlight.NearHook;
					break;
				}

				if( !state.isPressed )
				{
					// drop not on a hook
					this.m_context.sendGrabEvent( 
						{
							type: AvGrabEventType.EndGrab,
							senderId: this.m_context.grabberEpa.nodeId,
							grabberId: this.m_context.grabberEpa,
							grabbableId: this.m_lastGrabbable
						});
					this.m_lastHighlight = GrabberHighlight.InRange;
					break;
				}
				break;

			case GrabberHighlight.NearHook:
				if( -1 == indexOfEndpointAddrs( state.hooks, this.m_lastHook ) 
					|| -1 == indexOfEndpointAddrs( state.grabbables, this.m_lastGrabbable ) )
				{
					// losing our hook or grabbable both kick us back to Grabbed. The 
					// next update will change our phase from there. 
					this.m_context.sendGrabEvent( 
						{
							type: AvGrabEventType.LeaveHookRange,
							senderId: this.m_context.grabberEpa.nodeId,
							grabberId: this.m_context.grabberEpa,
							grabbableId: this.m_lastGrabbable,
							hookId: this.m_lastHook,
						});
					this.m_lastHook = null;
					this.m_lastHighlight = GrabberHighlight.Grabbed;
					break;
				}

				if( !state.isPressed )
				{
					// a drop on a hook
					this.m_context.sendGrabEvent( 
						{
							type: AvGrabEventType.LeaveHookRange,
							senderId: this.m_context.grabberEpa.nodeId,
							grabberId: this.m_context.grabberEpa,
							grabbableId: this.m_lastGrabbable,
							hookId: this.m_lastHook,
						});
					this.m_context.sendGrabEvent( 
						{
							type: AvGrabEventType.EndGrab,
							senderId: this.m_context.grabberEpa.nodeId,
							grabberId: this.m_context.grabberEpa,
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
			this.m_context.sendGrabEvent( 
				{ 
					type: AvGrabEventType.UpdateGrabberHighlight, 
					grabberId: this.m_context.grabberEpa,
					highlight: this.m_lastHighlight,
				} );
		}
	}
}

