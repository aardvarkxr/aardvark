import { ActiveInterface, AvComposedEntity, AvEntityChild, AvGadget, AvInterfaceEntity, AvOrigin, AvPrimitive, AvTransform, GrabRequest, GrabRequestType, PanelRequest, PanelRequestType, PrimitiveType, SimpleContainerComponent, AvPanel, AvGrabButton, AvModel, PrimitiveYOrigin } from '@aardvarkxr/aardvark-react';
import {g_builtinModelDropAttract,  AvNodeTransform, AvVolume, EAction, EHand, EVolumeType, multiplyTransforms, g_builtinModelHandLeft, g_builtinModelHandRight, InterfaceLockResult, EndpointAddr, endpointAddrsMatch, endpointAddrToString, EVolumeContext, g_builtinModelGear, emptyVolume, rayVolume, AvVector, AvQuaternion } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { makeEmpty } from 'aardvark_renderer/src/volume_test_utils';
import { InterfaceEntity } from 'aardvark_renderer/src/interface_processor';
import { vec3 } from '@tlaukkan/tsm';
import { initSentryForBrowser } from 'common/sentry_utils';

initSentryForBrowser();

const k_gadgetRegistryUI = "aardvark-gadget-registry@1";

interface DefaultHandProps
{
	hand: EHand;
}

enum GrabberState
{
	Idle,
	Highlight,
	Grabbing,
	LostGrab,
	GrabReleased,
	WaitingForDropComplete,
	WaitingForRegrab,
	WaitingForRegrabDropComplete,
	WaitingForRegrabNewMoveable,
	GrabFailed,
}

interface DefaultHandState
{
	activeGrab: ActiveInterface;
	activePanel: ActiveInterface;
	grabberFromGrabbableOverride?: AvNodeTransform;
	grabberFromGrabbableDirection?: vec3;
	grabberFromGrabbableRange?: number;
	grabberFromGrabbableRotation?: AvQuaternion;
	state: GrabberState;
	regrabTarget?: EndpointAddr;
	grabberFromRegrabTarget?: AvNodeTransform;
	showRay?: boolean;
	wasShowingRay?: boolean;
}


class DefaultHand extends React.Component< DefaultHandProps, DefaultHandState >
{
	private grabListenerHandle = 0;
	private containerComponent = new SimpleContainerComponent();
	private grabPressed = false;
	private grabRayHandler = 0;
	private grabMoveHandler = 0;
	private lastMoveTime = 0;

	constructor( props: any )
	{
		super( props );

		this.state = 
		{ 
			activeGrab: null,
			activePanel: null,
			state: GrabberState.Idle,
		};

		this.grabListenerHandle = AvGadget.instance().listenForActionState( EAction.Grab, this.props.hand, 
			this.onGrabPressed, this.onGrabReleased );
		this.grabRayHandler = AvGadget.instance().listenForActionState( EAction.GrabShowRay, this.props.hand, 
			this.onGrabShowRay, this.onGrabHideRay );

		this.containerComponent.onItemChanged( () => this.forceUpdate() );
	}

	componentWillUnmount()
	{
		AvGadget.instance().unlistenForActionState( this.grabListenerHandle );
		AvGadget.instance().unlistenForActionState( this.grabRayHandler );
	}

	@bind
	private onGrabMove( newValue: [ number, number ] )
	{
		const k_moveSpeed = 2.0; // meters per second

		let now = performance.now();
		let elapsedSeconds = Math.max( 0, ( now - this.lastMoveTime ) / 1000 );
		this.lastMoveTime = now;

		this.setState( (prevState: DefaultHandState ) =>
		{
			return { grabberFromGrabbableRange: prevState.grabberFromGrabbableRange 
				+ elapsedSeconds * k_moveSpeed * newValue[ 1 ] };
		} );
	}

	private startGrabMove()
	{
		this.grabMoveHandler = AvGadget.instance().listenForVector2ActionState( 
			EAction.GrabMove, this.props.hand, this.onGrabMove );
		this.lastMoveTime = performance.now();
	}

	private stopGrabMove()
	{
		AvGadget.instance().unlistenForActionState( this.grabMoveHandler );
	}

	@bind
	private onGrabShowRay()
	{
		this.setState( 
			{ 
				showRay: true
			} );
	}

	@bind
	private onGrabHideRay()
	{
		this.setState( 
			{ 
				showRay: false
			} );
	}

	@bind
	private async onGrabPressed()
	{
		if( this.grabPressed )
		{
			console.log( "DUPLICATE GRAB PRESSED!" );
			return;
		}

		this.grabPressed = true;

		if( this.state.activeGrab )
		{
			this.setState( { state: GrabberState.Grabbing } );
			let res = await this.state.activeGrab.lock();
			if( res != InterfaceLockResult.Success )
			{
				console.log( `Fail to lock when grabbing ${ InterfaceLockResult[ res ] }` );
			}

			// check active interface again again because we might have lost it while awaiting
			if( this.state.activeGrab )
			{
				this.state.activeGrab.sendEvent( { type: GrabRequestType.SetGrabber } as GrabRequest );
				let grabberFromGrabbable = this.state.activeGrab.selfFromPeer;
				let grabberFromGrabbableDirection = new vec3( [ 
					grabberFromGrabbable.position?.x ?? 0,
					grabberFromGrabbable.position?.y ?? 0,
					grabberFromGrabbable.position?.z ?? 0 ] );
				let grabberFromGrabbableRange = grabberFromGrabbableDirection.length();
				grabberFromGrabbableDirection.normalize();
				
				this.setState( 
					{ 
						grabberFromGrabbableOverride: null,
						grabberFromGrabbableDirection,
						grabberFromGrabbableRange,
						grabberFromGrabbableRotation: grabberFromGrabbable.rotation,
					} );

				this.startGrabMove();
			}
		}
		else if( this.state.activePanel )
		{
			await this.state.activePanel.lock();
			this.state.activePanel?.sendEvent( { type: PanelRequestType.Down } as PanelRequest );
		}
	}

	@bind
	private async onGrabReleased()
	{
		if( !this.grabPressed )
		{
			console.log( "DUPLICATE GRAB RELEASED!" );
		}

		this.grabPressed = false;
		this.stopGrabMove();

		if( this.state.activeGrab )
		{
			switch( this.state.state )
			{
				case GrabberState.GrabFailed:
					if( this.state.activeGrab )
					{
						this.setState( { state: GrabberState.Highlight } );
					}
					else
					{
						this.setState( { state: GrabberState.Idle } );
					}
					break;
	
				case GrabberState.Grabbing:
					// we need to wait here to make sure the moveable on the other 
					// end has a good transform relative to its new container when 
					// we unlock below.
					await this.state.activeGrab.sendEvent( { type: GrabRequestType.DropYourself } as GrabRequest );
					this.setState( { state: GrabberState.WaitingForDropComplete } );
					break;
	
				case GrabberState.LostGrab:
					this.state.activeGrab.unlock();	
					this.setState( 
						{ 
							grabberFromGrabbableDirection: null, 
							grabberFromGrabbableRange: null, 
							grabberFromGrabbableRotation: null, 
							state: GrabberState.Idle } );
					break;
	
				case GrabberState.WaitingForRegrab:
					// The user let the grab go mid-regrab. We'll just drop when the new moveable comes in
					break;
	
				case GrabberState.GrabReleased:
					this.state.activeGrab.unlock();
					this.setState( { state: GrabberState.Highlight } );
					break;
	
				default:
					// other states shouldn't get here
					console.log( `Unexpected grabber state ${ GrabberState[ this.state.state ] } on grab release` );
			}
		}
		else if( this.state.activePanel )
		{
			this.state.activePanel.sendEvent( { type: PanelRequestType.Up } as PanelRequest );
			this.state.activePanel.unlock();	
		}
	}
	
	@bind
	private async onGrabStart( activeInterface: ActiveInterface )
	{
		if( this.state.state == GrabberState.WaitingForRegrabNewMoveable )
		{
			if( !endpointAddrsMatch( activeInterface.peer, this.state.regrabTarget ) )
			{
				console.log( `Regrab target mismatch. Expected: ${ endpointAddrToString( this.state.regrabTarget )} `
					+ `Received: ${ endpointAddrToString( activeInterface.peer ) }` );
			}

			let grabberFromGrabbable = this.state.grabberFromRegrabTarget ?? activeInterface.selfFromPeer;
			let grabberFromGrabbableDirection = new vec3( [ 
				grabberFromGrabbable.position?.x ?? 0,
				grabberFromGrabbable.position?.y ?? 0,
				grabberFromGrabbable.position?.z ?? 0 ] );
			let grabberFromGrabbableRange = grabberFromGrabbableDirection.length();
			grabberFromGrabbableDirection.normalize();

			this.setState( 
				{ 
					state: GrabberState.Grabbing, 
					grabberFromGrabbableOverride: null,
					grabberFromGrabbableDirection,
					grabberFromGrabbableRange,
					grabberFromGrabbableRotation: grabberFromGrabbable.rotation,
					grabberFromRegrabTarget: null,
					regrabTarget: null,
				} );

			this.startGrabMove();

			let res = await activeInterface.lock();
			if( res != InterfaceLockResult.AlreadyLocked )
			{
				console.log( "How did we get here without having the new thing locked?" );
			}

			activeInterface.sendEvent( { type: GrabRequestType.SetGrabber } as GrabRequest );

			if( !this.grabPressed )
			{
				// the user released the grab while we were acquiring our new moveable. So we need to 
				// drop it immediately.
				await activeInterface.sendEvent( { type: GrabRequestType.DropYourself } as GrabRequest );
				this.setState( { state: GrabberState.WaitingForDropComplete } );
			}
		}
		else
		{
			AvGadget.instance().sendHapticEvent(activeInterface.self, 0.7, 1, 0 );
			this.setState( { state: GrabberState.Highlight } );
		}
		console.log( `setting activeInterface to ${ endpointAddrToString( activeInterface.peer ) }`)
		this.setState( { activeGrab: activeInterface, wasShowingRay: this.state.showRay } );


		activeInterface.onEvent( 
			async ( event: GrabRequest ) =>
			{
				switch( event.type )
				{
					case GrabRequestType.DropComplete:
					{
						switch( this.state.state )
						{
							case GrabberState.WaitingForDropComplete:
								activeInterface.unlock();	
								this.setState( { state: GrabberState.Highlight,
									grabberFromGrabbableOverride: null,
									grabberFromGrabbableDirection: null, 
									grabberFromGrabbableRange: null, 
									grabberFromGrabbableRotation: null } );		
								break;

							case GrabberState.WaitingForRegrabDropComplete:
								let resPromise = activeInterface.relock( this.state.regrabTarget );
								this.setState( { state: GrabberState.WaitingForRegrab,
									grabberFromGrabbableOverride: null,
									grabberFromGrabbableDirection: null, 
									grabberFromGrabbableRange: null, 
									grabberFromGrabbableRotation: null, } );
								let res = await resPromise;
								if( res != InterfaceLockResult.Success )
								{
									console.log( `Regrab failed with ${ InterfaceLockResult[ res ] }` );
									// @ts-ignore: Bogus always false error after await and setState
									if( this.state.state == GrabberState.WaitingForRegrab )
									{
										this.setState( { state: GrabberState.Grabbing } );
									}
								}
								break;

							default:
								// other states shouldn't get here
								console.log( `Unexpected grabber state ${ GrabberState[ this.state.state ] } on DropComplete event` );
								break;
						}
					}
					break;

					case GrabRequestType.RequestRegrab:
					{
						if( this.state.state == GrabberState.Grabbing )
						{

							// we need to wait here to make sure the old moveable on the other 
							// end has a good transform relative to its new container when 
							// we relock below.
							await activeInterface.sendEvent( { type: GrabRequestType.DropYourself } as GrabRequest );
							this.setState( 
								{ 
									state: GrabberState.WaitingForRegrabDropComplete, 
									regrabTarget: event.newMoveable,
									grabberFromRegrabTarget: multiplyTransforms( activeInterface.selfFromPeer, 
										event.oldMoveableFromNewMoveable ),
								} );
						}
					}
					break;

					case GrabRequestType.ReleaseMe:
					{
						if( this.state.state == GrabberState.Grabbing )
						{
							this.setState( { state: GrabberState.GrabReleased, 
								grabberFromGrabbableOverride: null,
								grabberFromGrabbableDirection: null, 
								grabberFromGrabbableRange: null, 
								grabberFromGrabbableRotation: null, } );
						}
					}
					break;

					case GrabRequestType.OverrideTransform:
					{
						this.setState( { grabberFromGrabbableOverride: event.grabberFromGrabbable } );
					}
					break;
				}
			} );

		activeInterface.onEnded( () =>
		{
			switch( this.state.state )
			{
				case GrabberState.GrabReleased:
				case GrabberState.Grabbing:
					this.setState( { state: GrabberState.LostGrab } );
					break;

				case GrabberState.Highlight:
					this.setState( { state: GrabberState.Idle } );
					AvGadget.instance().sendHapticEvent( activeInterface.self, 0.3, 1, 0 );
					break;

				case GrabberState.WaitingForRegrab:
					// This is the old endpoint leaving. We should get a new interface for the new 
					// target soon.
					this.setState( { state: GrabberState.WaitingForRegrabNewMoveable })
					break;

				default:
					// other states shouldn't get here
					console.log( `Unexpected grabber state ${ GrabberState[ this.state.state ] } on interface end` );
			}

			console.log( `unsetting activeInterface from ${ endpointAddrToString( this.state.activeGrab?.peer ) }`)

			this.setState( { activeGrab: null, wasShowingRay: false } );	
		} );

	}

	@bind
	private onPanelStart( activeInterface: ActiveInterface )
	{
		AvGadget.instance().sendHapticEvent( activeInterface.self, 0.7, 1, 0 );
		
		activeInterface.onEnded( () =>
		{
			if( this.grabPressed )
			{
				activeInterface.unlock();
			}

			this.setState( { activePanel: null } );	
			AvGadget.instance().sendHapticEvent(activeInterface.self, 0.3, 1, 0 );
		} );

		this.setState( { activePanel: activeInterface } );
	}

	public renderDebug()
	{
		return <div>
			<div>{ GrabberState[ this.state.state ] }</div>
			<div>ActiveInterface: { this.state.activeGrab ? endpointAddrToString( this.state.activeGrab.peer ): "none" }</div>
			{/* <div>Transform: { this.state.grabberFromGrabbable ? JSON.stringify( this.state.grabberFromGrabbable ): "none" }</div> */}
		</div>
	}

	public render()
	{
		let modelColor = "lightblue";
		const k_grabColor = "red";
		const k_dropColor = "green";
		if( this.state.activeGrab )
		{
			modelColor = k_grabColor;
		}
		else if( this.containerComponent.hasPotentialDrop )
		{
			modelColor = k_dropColor;
		}


		let originPath:string;
		let hookName:string;
		let grabberName:string;
		let dropIcon: string;
		switch( this.props.hand )
		{
		case EHand.Left:
			originPath = "/user/hand/left";
			hookName = "left_hand";
			grabberName = "left_hand_grabber";
			dropIcon = g_builtinModelHandLeft;
			break;
		case EHand.Right:
			originPath = "/user/hand/right";
			hookName = "right_hand";
			grabberName = "right_hand_grabber";
			dropIcon = g_builtinModelHandRight;
			break;
		}

		const k_containerOuterVolume: AvVolume =
		{
			type: EVolumeType.AABB,
			context: EVolumeContext.ContinueOnly,
			aabb:
			{
				xMin: -0.15, xMax: 0.15,
				yMin: -0.15, yMax: 0.25,
				zMin: -0.15, zMax: 0.15,
			}
		};
		const k_containerInnerVolume: AvVolume =
		{
			type: EVolumeType.Sphere,
			radius: 0.03,
		};

		const k_grabberBallVolume: AvVolume =
		{ 
			type: EVolumeType.Sphere, 
			radius: 0.01,
		};

		let grabberVolumes = [ k_grabberBallVolume ];

		let ray: JSX.Element = null;
		if( this.state.showRay &&
			( this.state.state == GrabberState.Idle || this.state.wasShowingRay ) )
		{
			grabberVolumes.push( rayVolume( new vec3( [ 0, 0, 0 ] ), new vec3( [ 0, 0, -1 ] ) ) );
			if( this.state.state == GrabberState.Idle ||
				this.state.state == GrabberState.Highlight )
			{
				ray = <AvTransform rotateX={ -90 }>
				<AvPrimitive radius={ 0.005 } height={ 4 } type={ PrimitiveType.Cylinder }
					color="lightgrey" originY={ PrimitiveYOrigin.Bottom } />
				</AvTransform>;
			}
		}

		let grabberFromGrabbable: AvNodeTransform = null;
		if( this.state.grabberFromGrabbableOverride )
		{
			grabberFromGrabbable = this.state.grabberFromGrabbableOverride;
		}
		else if( this.state.grabberFromGrabbableDirection )
		{
			grabberFromGrabbable =
			{
				position: 
				{
					x: this.state.grabberFromGrabbableDirection.x * this.state.grabberFromGrabbableRange,
					y: this.state.grabberFromGrabbableDirection.y * this.state.grabberFromGrabbableRange,
					z: this.state.grabberFromGrabbableDirection.z * this.state.grabberFromGrabbableRange,
				},
				rotation: this.state.grabberFromGrabbableRotation,
			};
		}

		let child: EndpointAddr = null;
		if( this.state.activeGrab && grabberFromGrabbable
			&& this.state.state != GrabberState.GrabReleased )
		{
			child = this.state.activeGrab.peer;
		}

		return (
			<>
			<AvOrigin path={ originPath }>
				<AvPrimitive radius={ 0.01 } type={ PrimitiveType.Sphere } color={ modelColor }/>
				{ ray }
				<AvComposedEntity components={ [ this.containerComponent ]} 
					volume={ [ k_containerInnerVolume, k_containerOuterVolume ] }
					priority={ 100 }/>
				<AvInterfaceEntity transmits={
					[ 
						{ iface: "aardvark-panel@1", processor: this.onPanelStart },
						{ iface: "aardvark-grab@1", processor: this.onGrabStart },
					] }
					volume={ grabberVolumes } >
						{
							child
							&& <AvTransform transform={ grabberFromGrabbable }>
								<AvEntityChild child={ child }/>
							</AvTransform>
						}
				</AvInterfaceEntity>
			</AvOrigin>
			{ this.renderDebug() }
			</>
		);
	}
}

class DefaultHands extends React.Component< {}, {} >
{
	private containerComponent = new SimpleContainerComponent();
	private leftRef = React.createRef<DefaultHand>();
	private rightRef = React.createRef<DefaultHand>();
	private gadgetRegistry: ActiveInterface = null;
	private gadgetRegistryRef = React.createRef<AvInterfaceEntity>();

	@bind
	private onGadgetRegistryUI( gadgetRegistry: ActiveInterface )
	{
		this.gadgetRegistry = gadgetRegistry;

		gadgetRegistry.onEnded( () =>
		{
			this.gadgetRegistry = null;
		} )
	}

	@bind
	private toggleGadgetMenu()
	{
		this.gadgetRegistry?.sendEvent( { type: "toggle_visibility" } );
	}

	componentDidMount()
	{
		if( !AvGadget.instance().getEndpointId() || !this.gadgetRegistryRef.current )
		{
			// this is terrible. Figure out a way to call back into the gadget when it
			// actually has an endpoint ID
			window.setTimeout( () =>
			{
				this.startGadgetMenu();
			}, 100 );
		}
		else
		{
			this.startGadgetMenu();
		}
	}

	private startGadgetMenu()
	{
		if( !AvGadget.instance().getEndpointId() || !this.gadgetRegistryRef.current )
		{
			// this is terrible. Figure out a way to call back into the gadget when it
			// actually has an endpoint ID
			window.setTimeout( () =>
			{
				this.startGadgetMenu();
			}, 100 );
			return;
		}

		// Start the gadget menu once we have an ID
		AvGadget.instance().startGadget( 
			"http://localhost:23842/gadgets/gadget_menu", 
			[ { iface: k_gadgetRegistryUI, receiver: this.gadgetRegistryRef.current.globalId } ] );
	}

	public render()
	{
		const k_containerInnerVolume: AvVolume =
		{
			type: EVolumeType.AABB,
			aabb:
			{
				xMin: -0.05, xMax: 0.05,
				yMin: -0.06, yMax: 0.02,
				zMin: -0.05, zMax: 0.05,
			}
		};

		const k_containerOuterVolume: AvVolume =
		{
			type: EVolumeType.AABB,
			context: EVolumeContext.ContinueOnly,
			aabb:
			{
				xMin: -0.3, xMax: 0.3,
				yMin: -0.6, yMax: 0.2,
				zMin: -0.3, zMax: 0.3,
			}
		};

		return (
			<>
				<DefaultHand hand={ EHand.Left } ref={ this.leftRef }/>
				<DefaultHand hand={ EHand.Right } ref={ this.rightRef } />
				<AvOrigin path={ "/user/head" } >
					<AvInterfaceEntity receives={
						[
							{ 
								iface: k_gadgetRegistryUI,
								processor: this.onGadgetRegistryUI,
							}
						]
					} volume={ emptyVolume() } ref={ this.gadgetRegistryRef } />
				</AvOrigin>
				<AvOrigin path="/user/hand/left">
					<AvTransform translateZ={ 0.04 }>
						<AvGrabButton onClick={ this.toggleGadgetMenu } 
							modelUri={ g_builtinModelGear }/>
					</AvTransform>
				</AvOrigin>
				{/* <AvOrigin path="/user/head">
					<AvComposedEntity components={ [ this.containerComponent ]} 
						volume={ [ k_containerInnerVolume, k_containerOuterVolume ] }
						priority={ 90 }/>
				</AvOrigin> */}
				<AvOrigin path="/space/stage">
					<AvComposedEntity components={ [this.containerComponent ] }
						volume={ { type: EVolumeType.Infinite } }>
					</AvComposedEntity>
				</AvOrigin>
				{/* <AvOrigin path="/user/head">
					<AvTransform translateZ={-2}>
						<AvPanel widthInMeters={1.0}>
						</AvPanel>
					</AvTransform>
				</AvOrigin> */}
			</>
		);
	}
}

ReactDOM.render( <DefaultHands/>, document.getElementById( "root" ) );



