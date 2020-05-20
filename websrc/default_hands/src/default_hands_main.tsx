import { ActiveInterface, AvComposedEntity, AvEntityChild, AvGadget, AvInterfaceEntity, AvOrigin, AvPrimitive, AvTransform, GrabRequest, GrabRequestType, PanelRequest, PanelRequestType, PrimitiveType, SimpleContainerComponent, multiplyTransforms } from '@aardvarkxr/aardvark-react';
import { AvNodeTransform, AvVolume, EAction, EHand, EVolumeType, g_builtinModelHandLeft, g_builtinModelHandRight, InterfaceLockResult, EndpointAddr, endpointAddrsMatch, endpointAddrToString } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

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
	WaitingForDropComplete,
	WaitingForRegrab,
	WaitingForRegrabDropComplete,
	WaitingForRegrabNewMoveable,
	RegrabFailed,
	GrabFailed,
}

interface DefaultHandState
{
	activeInterface: ActiveInterface;
	grabberFromGrabbable?: AvNodeTransform;
	state: GrabberState;
	regrabTarget?: EndpointAddr;
	grabberFromRegrabTarget?: AvNodeTransform;
}


class DefaultHand extends React.Component< DefaultHandProps, DefaultHandState >
{
	private actionListenerHandle = 0;
	private containerComponent = new SimpleContainerComponent();

	constructor( props: any )
	{
		super( props );

		this.state = 
		{ 
			activeInterface: null,
			state: GrabberState.Idle,
		};

		this.actionListenerHandle = AvGadget.instance().listenForActionStateWithComponent( this.props.hand, 
			EAction.B, this );
	}

	componentWillUnmount()
	{
		AvGadget.instance().unlistenForActionState( this.actionListenerHandle );
	}

	@bind
	private onGrabStart( activeInterface: ActiveInterface )
	{
		if( this.state.state == GrabberState.WaitingForRegrabNewMoveable )
		{
			if( !endpointAddrsMatch( activeInterface.peer, this.state.regrabTarget ) )
			{
				console.log( `Regrab target mismatch. Expected: ${ endpointAddrToString( this.state.regrabTarget )} `
					+ `Received: ${ endpointAddrToString( activeInterface.peer ) }` );
			}

			this.setState( 
				{ 
					state: GrabberState.Grabbing, 
					grabberFromGrabbable: this.state.grabberFromRegrabTarget ?? activeInterface.selfFromPeer, 
					grabberFromRegrabTarget: null,
					regrabTarget: null,
				} );
			activeInterface.sendEvent( { type: GrabRequestType.SetGrabber } as GrabRequest );
		}
		else
		{
			AvGadget.instance().sendHapticEvent(activeInterface.self, 0.7, 1, 0 );
		}

		let listenHandle = AvGadget.instance().listenForActionState( EAction.Grab, this.props.hand, 
			async () =>
			{
				this.setState( { state: GrabberState.Grabbing } );
				// A was pressed
				await activeInterface.lock();
				activeInterface.sendEvent( { type: GrabRequestType.SetGrabber } as GrabRequest );
				this.setState( { grabberFromGrabbable: activeInterface.selfFromPeer } );
			},
			async () =>
			{
				// A was released
				switch( this.state.state )
				{
					case GrabberState.GrabFailed:
						if( this.state.activeInterface )
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
						await activeInterface.sendEvent( { type: GrabRequestType.DropYourself } as GrabRequest );
						this.setState( { state: GrabberState.WaitingForDropComplete } );
						break;

					case GrabberState.LostGrab:
						AvGadget.instance().unlistenForActionState( listenHandle );
						activeInterface.unlock();	
						this.setState( { grabberFromGrabbable: null, state: GrabberState.Idle } );
						break;

					case GrabberState.WaitingForRegrab:
						this.setState( { state: GrabberState.RegrabFailed } );
						break;

					default:
						// other states shouldn't get here
						console.log( `Unexpected grabber state ${ GrabberState[ this.state.state ] } on grab release` );
				}
			} );

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
								this.setState( { state: GrabberState.Highlight } );		
								break;

							case GrabberState.WaitingForRegrabDropComplete:
								let resPromise = activeInterface.relock( this.state.regrabTarget );
								this.setState( { state: GrabberState.WaitingForRegrab } );
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
				}
			} );

		activeInterface.onEnded( () =>
		{
			switch( this.state.state )
			{
				case GrabberState.Grabbing:
					this.setState( { state: GrabberState.LostGrab } );
					break;

				case GrabberState.Highlight:
					this.setState( { state: GrabberState.Idle } );
					AvGadget.instance().unlistenForActionState( listenHandle );
					AvGadget.instance().sendHapticEvent(activeInterface.self, 0.3, 1, 0 );
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

			this.setState( { activeInterface: null } );	
		} );

		this.setState( { activeInterface } );
	}

	@bind
	private onPanelStart( activeInterface: ActiveInterface )
	{
		AvGadget.instance().sendHapticEvent( activeInterface.self, 0.7, 1, 0 );
		
		let listenHandle = AvGadget.instance().listenForActionState( EAction.Grab, this.props.hand, 
			async () =>
			{
				// Grab was pressed
				await activeInterface.lock();
				activeInterface.sendEvent( { type: PanelRequestType.Down } as PanelRequest );
			},
			async () =>
			{
				// Grab was released
				activeInterface.sendEvent( { type: PanelRequestType.Up } as PanelRequest );
				activeInterface.unlock();	
			} );

		activeInterface.onEnded( () =>
		{
			AvGadget.instance().unlistenForActionState( listenHandle );
			this.setState( { activeInterface: null } );	
			AvGadget.instance().sendHapticEvent(activeInterface.self, 0.3, 1, 0 );
		} );

		this.setState( { activeInterface } );
	}

	public render()
	{
		let modelColor = "#222288FF";
		let highlightColor = "#FF0000FF";
		if( this.state.activeInterface )
		{
			modelColor = highlightColor;
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

		const k_containerVolume: AvVolume =
		{
			type: EVolumeType.AABB,
			aabb:
			{
				xMin: -0.15, xMax: 0.15,
				yMin: -0.15, yMax: 0.25,
				zMin: -0.15, zMax: 0.15,
			}
		};

		const k_grabberVolume: AvVolume =
		{ 
			type: EVolumeType.Sphere, 
			radius: 0.01,
		};

		return (
			<AvOrigin path={ originPath }>
				<AvPrimitive radius={ 0.01 } type={ PrimitiveType.Sphere } color={ modelColor }/>
				{/* <AvComposedEntity components={ [ this.containerComponent ]} volume={ k_containerVolume }
					priority={ 100 }/> */}
				<AvInterfaceEntity transmits={
					[ 
						{ iface: "aardvark-panel@1", processor: this.onPanelStart },
						{ iface: "aardvark-grab@1", processor: this.onGrabStart },
					] }
					volume={ k_grabberVolume } >
						{
							this.state.activeInterface && this.state.grabberFromGrabbable 
							&& <AvTransform transform={ this.state.grabberFromGrabbable }>
								<AvEntityChild child={ this.state.activeInterface.peer }/>
							</AvTransform>
						}
				</AvInterfaceEntity>
			</AvOrigin>
		);
	}
}

class DefaultHands extends React.Component< {}, {} >
{
	private containerComponent = new SimpleContainerComponent();

	public render()
	{
		const k_containerVolume: AvVolume =
		{
			type: EVolumeType.AABB,
			aabb:
			{
				xMin: -0.3, xMax: 0.3,
				yMin: -0.6, yMax: 0.2,
				zMin: -0.3, zMax: 0.3,
			}
		};

		return (
			<>
				<DefaultHand hand={ EHand.Left } />
				<DefaultHand hand={ EHand.Right } />
				{/* <AvOrigin path="/user/head">
					<AvComposedEntity components={ [ this.containerComponent ]} volume={ k_containerVolume }
						priority={ 90 }/>
				</AvOrigin> */}
				<AvOrigin path="/space/stage">
					<AvComposedEntity components={ [this.containerComponent ] }
						volume={ { type: EVolumeType.Infinite } }>
					</AvComposedEntity>
				</AvOrigin>
			</>
		);
	}
}

ReactDOM.render( <DefaultHands/>, document.getElementById( "root" ) );



