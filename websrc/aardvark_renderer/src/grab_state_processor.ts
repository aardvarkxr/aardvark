import { EndpointAddr, indexOfEndpointAddrs, endpointAddrsMatch, MsgGrabberState,
	AvGrabEvent, AvGrabEventType, GrabberHighlight, AvGrabbableCollision, ENodeFlags, EAction, EHand, GrabberHookState, EHookVolume } 
	from '@aardvarkxr/aardvark-shared';
import { assert } from '@aardvarkxr/aardvark-react';
import { mat4 } from '@tlaukkan/tsm';
import { nodeTransformFromMat4 } from './traverser_utils';


interface GrabContext
{
	sendGrabEvent( event: AvGrabEvent ): void;
	getUniverseFromNode( nodeAddr: EndpointAddr ): mat4;
	getActionState( hand: EHand, action: EAction ): boolean;
	getCurrentGrabber( grabbableAddr: EndpointAddr ): EndpointAddr;
	grabberEpa: EndpointAddr;
}

function indexOfGrabbable( grabbables: AvGrabbableCollision[], grabbableId: EndpointAddr ):number
{
	for( let n = 0; grabbables && n < grabbables.length; n++ )
	{
		if( endpointAddrsMatch( grabbables[n].grabbableId, grabbableId ) )
		{
			return n;
		}
	}
	return -1;
}

function isProximityOnly( handle: AvGrabbableCollision ): boolean
{
	return 0 != ( handle.handleFlags & ENodeFlags.NotifyProximityWithoutGrab );
}

function findBestHook( hooks: GrabberHookState[], allowOuter: boolean ): GrabberHookState
{
	if( !hooks )
		return null;

	for( let hook of hooks )
	{
		if( allowOuter || hook.whichVolume == EHookVolume.Inner )
		{
			return hook
		}
	}

	return null;
}


function findHook( hooks: GrabberHookState[], hookId: EndpointAddr ): GrabberHookState
{
	if( !hooks )
		return null;

	for( let hook of hooks )
	{
		if( endpointAddrsMatch( hook.hookId, hookId ) )
		{
			return hook
		}
	}

	return null;
}


export class CGrabStateProcessor
{
	m_lastHighlight = GrabberHighlight.None;
	m_lastGrabbable:EndpointAddr = null;
	m_lastGrabbableFlags: number = 0;
	m_lastHandle: EndpointAddr = null;
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
		let prevGrabbable = this.m_lastGrabbable;
		let prevGrabbableFlags = this.m_lastGrabbableFlags;
		let prevHook = this.m_lastHook;
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
					let useIdentityTransform = !!evt.useIdentityTransform;
					if( !endpointAddrsMatch( evt.grabbableId, this.m_lastGrabbable ) )
					{
						this.m_context.sendGrabEvent( 
							{
								type: AvGrabEventType.LeaveRange,
								senderId: this.m_context.grabberEpa.nodeId,
								grabberId: this.m_context.grabberEpa,
								grabbableId: this.m_lastGrabbable,
								handleId: this.m_lastHandle,
							});
							this.m_context.sendGrabEvent( 
							{
								type: AvGrabEventType.EnterRange,
								senderId: this.m_context.grabberEpa.nodeId,
								grabberId: this.m_context.grabberEpa,
								grabbableId: evt.grabbableId,
								handleId: this.m_lastHandle,
							});
						this.m_lastGrabbable = evt.grabbableId;
						this.m_lastGrabbableFlags = evt.grabbableFlags;
						this.m_lastHandle = evt.handleId;
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
							handleId: this.m_lastHandle,
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

		if( prevHighlight != this.m_lastHighlight || prevGrabbable != this.m_lastGrabbable
			|| prevGrabbableFlags != this.m_lastGrabbableFlags || prevHook != this.m_lastHook )
		{
			//console.log( "Sending grabbableflags ", this.m_lastGrabbableFlags, this.m_context.grabberEpa );
			this.m_context.sendGrabEvent( 
				{ 
					type: AvGrabEventType.UpdateGrabberHighlight, 
					grabberId: this.m_context.grabberEpa,
					grabbableFlags: this.m_lastGrabbableFlags,
					hookId: this.m_lastHook,
					highlight: this.m_lastHighlight,
				} );
		}
	}

	private findBestGrabbable( state: MsgGrabberState ): AvGrabbableCollision
	{
		if( !state.grabbables )
		{
			return null;
		}
		
		let last: AvGrabbableCollision = null;
		let best: AvGrabbableCollision = null;
		for( let coll of state.grabbables )
		{
			let currentGrabber = this.m_context.getCurrentGrabber( coll.grabbableId );
			if( currentGrabber && !endpointAddrsMatch( currentGrabber, state.grabberId ) )
			{
				// somebody is grabbing this one already
				continue;
			}

			if( endpointAddrsMatch( coll.handleId, this.m_lastHandle ) )
			{
				last = coll;
			}

			if( !best || isProximityOnly( best ) && !isProximityOnly( coll ) )
			{
				best = coll;
			}
		}

		if( !last || isProximityOnly( last ) && !isProximityOnly( best ) )
		{
			return best;
		}
		else
		{
			return last;
		}
	}
	
	public onGrabberIntersections( state: MsgGrabberState )
	{
		let bestGrabbable = this.findBestGrabbable( state );
		if( this.m_lastGrabbable && this.m_lastHighlight == GrabberHighlight.Grabbed
			&& ( !bestGrabbable || !endpointAddrsMatch( this.m_lastGrabbable, bestGrabbable.grabbableId ) )
			&& this.m_context.getActionState( state.hand, EAction.Grab ) )
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
		let lastGrabbableIndex = indexOfGrabbable( state.grabbables, this.m_lastGrabbable );
		let prevGrabbable = this.m_lastGrabbable;
		let prevGrabbableFlags = this.m_lastGrabbableFlags;
		let prevHook = this.m_lastHook;
		let prevHighlight = this.m_lastHighlight;
		switch( this.m_lastHighlight )
		{
			case GrabberHighlight.None:
				assert( this.m_lastGrabbable == null );

				// if we have no eligible grabbables, we have nothing to do
				if( !bestGrabbable )
					break;

				this.m_lastGrabbable = bestGrabbable.grabbableId;
				this.m_lastGrabbableFlags = bestGrabbable.grabbableFlags;
				this.m_lastHandle = bestGrabbable.handleId
				this.m_lastHighlight = GrabberHighlight.InRange;
				this.m_lastHook = bestGrabbable.currentHook;
				
				this.m_context.sendGrabEvent( 
					{
						type: AvGrabEventType.EnterRange,
						senderId: this.m_context.grabberEpa.nodeId,
						grabberId: this.m_context.grabberEpa,
						grabbableId: this.m_lastGrabbable,
						handleId: this.m_lastHandle,
					});

				// FALL THROUGH (in case we also pressed on the same frame)

			case GrabberHighlight.InRange:
				assert( this.m_lastGrabbable != null );

				if( !bestGrabbable || !endpointAddrsMatch( this.m_lastHandle, bestGrabbable.handleId ) )
				{
					// stop being in range.
					// if we actually have mismatched grabbables, the new best will be picked next frame
					this.m_context.sendGrabEvent( 
						{
							type: AvGrabEventType.LeaveRange,
							senderId: this.m_context.grabberEpa.nodeId,
							grabberId: this.m_context.grabberEpa,
							grabbableId: this.m_lastGrabbable,
							handleId: this.m_lastHandle,
						});
					this.m_lastGrabbableFlags = 0;
					this.m_lastGrabbable = null;
					this.m_lastHandle = null;
					this.m_lastHighlight = GrabberHighlight.None;
					break;
				}

				if( !this.m_context.getActionState( state.hand, EAction.Grab ) 
					|| isProximityOnly( bestGrabbable ) )
				{
					// if the user didn't press grab we have nothing else to do.
					// proximityOnly handles can't get grabbed, so wait until we
					// get here with a "real" handle before moving on.
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
						handleId: this.m_lastHandle,
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
				if( !this.m_context.getActionState( state.hand, EAction.Grab ) )
				{
					this.m_lastHighlight = GrabberHighlight.InRange;
				}
				break;
				
			case GrabberHighlight.Grabbed:
				if( -1 == lastGrabbableIndex )
				{
					// cancel grabbing
					console.log( "Ending grab of " + this.m_lastGrabbable 
						+ " because it wasn't in the grabbable list");
					this.m_context.sendGrabEvent( 
						{
							type: AvGrabEventType.EndGrab,
							senderId: this.m_context.grabberEpa.nodeId,
							grabberId: this.m_context.grabberEpa,
							grabbableId: this.m_lastGrabbable,
							handleId: this.m_lastHandle,
						});
					this.m_lastHighlight = GrabberHighlight.InRange;
					this.m_lastGrabbableFlags = 0;
					break;
				}

				let lastGrabbableCollision = state.grabbables[ lastGrabbableIndex ];
				this.m_lastGrabbableFlags = lastGrabbableCollision.grabbableFlags;
				if( 0 != ( lastGrabbableCollision.grabbableFlags & ENodeFlags.Tethered ) )
				{
					// see if we want to untether
					if( this.m_context.getActionState( state.hand, EAction.Detach ) )
					{
						this.m_context.sendGrabEvent( 
							{
								type: AvGrabEventType.Detach,
								senderId: this.m_context.grabberEpa.nodeId,
								grabberId: this.m_context.grabberEpa,
								grabbableId: this.m_lastGrabbable,
								grabbableFlags: lastGrabbableCollision.grabbableFlags,
								handleId: this.m_lastHandle,
							});
					}
				}

				if( 0 == ( lastGrabbableCollision.grabbableFlags & ENodeFlags.Tethered ) )
				{
					let bestHook = findBestHook( state.hooks, false );
					if( bestHook 
						&& 0 != ( lastGrabbableCollision.grabbableFlags & ENodeFlags.AllowDropOnHooks ) )
					{
						// we handle hooks before dropping in case we got the
						// unpress and the hook in the same update
						this.m_lastHook = bestHook.hookId;
						this.m_context.sendGrabEvent( 
							{
								type: AvGrabEventType.EnterHookRange,
								senderId: this.m_context.grabberEpa.nodeId,
								grabberId: this.m_context.grabberEpa,
								grabbableId: this.m_lastGrabbable,
								grabbableFlags: lastGrabbableCollision.grabbableFlags,
								handleId: this.m_lastHandle,
								hookId: this.m_lastHook,
							});
						this.m_lastHighlight = GrabberHighlight.NearHook;
						break;
					}
				}

				if( !this.m_context.getActionState( state.hand, EAction.Grab ) )
				{
					// drop not on a hook
					this.m_context.sendGrabEvent( 
						{
							type: AvGrabEventType.EndGrab,
							senderId: this.m_context.grabberEpa.nodeId,
							grabberId: this.m_context.grabberEpa,
							grabbableId: this.m_lastGrabbable,
							grabbableFlags: lastGrabbableCollision.grabbableFlags,
							handleId: this.m_lastHandle,
						});
					this.m_lastHighlight = GrabberHighlight.InRange;
					break;
				}
				break;

			case GrabberHighlight.NearHook:
				let oldHookState = findHook( state.hooks, this.m_lastHook)
				if( !oldHookState || -1 == lastGrabbableIndex )
				{
					// losing our hook or grabbable both kick us back to Grabbed. The 
					// next update will change our phase from there. 
					this.m_context.sendGrabEvent( 
						{
							type: AvGrabEventType.LeaveHookRange,
							senderId: this.m_context.grabberEpa.nodeId,
							grabberId: this.m_context.grabberEpa,
							grabbableId: this.m_lastGrabbable,
							grabbableFlags: this.m_lastGrabbableFlags,
							handleId: this.m_lastHandle,
							hookId: this.m_lastHook,
						});
					this.m_lastHook = null;
					this.m_lastHighlight = GrabberHighlight.Grabbed;
					break;
				}

				let grabberCollision = state.grabbables[ lastGrabbableIndex ];
				this.m_lastGrabbableFlags = grabberCollision.grabbableFlags;
				if( !this.m_context.getActionState( state.hand, EAction.Grab ) )
				{
					// a drop on a hook
					this.m_context.sendGrabEvent( 
						{
							type: AvGrabEventType.LeaveHookRange,
							senderId: this.m_context.grabberEpa.nodeId,
							grabberId: this.m_context.grabberEpa,
							grabbableId: this.m_lastGrabbable,
							grabbableFlags: this.m_lastGrabbableFlags,
							handleId: this.m_lastHandle,
							hookId: this.m_lastHook,
						});

					let universeFromGrabbable = this.m_context.getUniverseFromNode( this.m_lastGrabbable );
					let universeFromHook = this.m_context.getUniverseFromNode( this.m_lastHook );
					let hookFromUniverse = universeFromHook.copy( new mat4( ) ).inverse();
					let hookFromGrabbable = hookFromUniverse.multiply( universeFromGrabbable );

					this.m_context.sendGrabEvent( 
						{
							type: AvGrabEventType.EndGrab,
							senderId: this.m_context.grabberEpa.nodeId,
							grabberId: this.m_context.grabberEpa,
							grabbableId: this.m_lastGrabbable,
							grabbableFlags: this.m_lastGrabbableFlags,
							handleId: this.m_lastHandle,
							hookId: this.m_lastHook,
							hookFromGrabbable: nodeTransformFromMat4( hookFromGrabbable ),
						});
					this.m_lastHighlight = GrabberHighlight.InRange;
					break;
				}
				break;
		}

		if( prevHighlight != this.m_lastHighlight || prevGrabbable != this.m_lastGrabbable
			|| prevGrabbableFlags != this.m_lastGrabbableFlags || prevHook != this.m_lastHook )
		{
			//console.log( "Sending grabbableflags ", this.m_lastGrabbableFlags, this.m_context.grabberEpa );
			this.m_context.sendGrabEvent( 
				{ 
					type: AvGrabEventType.UpdateGrabberHighlight, 
					grabberId: this.m_context.grabberEpa,
					grabbableFlags: this.m_lastGrabbableFlags,
					hookId: this.m_lastHook,
					highlight: this.m_lastHighlight,
				} );
		}
	}
}

