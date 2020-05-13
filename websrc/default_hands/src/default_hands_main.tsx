import * as React from 'react';
import  * as ReactDOM from 'react-dom';
import bind from 'bind-decorator';
import { AvGadget,AvOrigin, AvTransform, AvGrabber, AvModel, AvPoker, AvPanelIntersection,
	AvLine,	AvStandardBoxHook, InterfaceEntityProcessor, ActiveInterface, AvInterfaceEntity, AvEntityChild, SimpleContainerComponent, AvComposedEntity, GrabRequest, GrabRequestType, PrimitiveType, AvPrimitive } 
	from '@aardvarkxr/aardvark-react';
import { Av, EndpointAddr, EHand, GrabberHighlight, g_builtinModelSphere, EAction, g_builtinModelHead,
	g_builtinModelHandRight, g_builtinModelHandLeft, Permission, EVolumeType, AvNodeTransform, endpointAddrToString, endpointAddrsMatch, AvVolume } from '@aardvarkxr/aardvark-shared'

interface DefaultHandProps
{
	hand: EHand;
}

interface DefaultHandState
{
	grabberHighlight: GrabberHighlight;
	pokerHighlight: boolean;
	currentPanel: EndpointAddr;
	activeInterface: ActiveInterface;
	grabberFromGrabbable?: AvNodeTransform;
	grabButtonDown: boolean;
	lostGrab: boolean;
	waitingForDropComplete: boolean;
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
			grabberHighlight: GrabberHighlight.None,
			pokerHighlight: false,
			currentPanel: null,
			activeInterface: null,
			grabButtonDown: false,
			lostGrab: false,
			waitingForDropComplete: false,
		};

		this.actionListenerHandle = AvGadget.instance().listenForActionStateWithComponent( this.props.hand, 
			EAction.B, this );
	}

	@bind updateGrabberHighlight( newHighlight: GrabberHighlight )
	{
		this.setState( { grabberHighlight: newHighlight } );
	}

	@bind updatePokerHighlight( newHighlight: boolean, newPanel: EndpointAddr )
	{
		this.setState( { pokerHighlight: newHighlight, currentPanel: newPanel } );
	}

	componentWillUnmount()
	{
		AvGadget.instance().unlistenForActionState( this.actionListenerHandle );
	}

	@bind
	private onGrabStart( activeInterface: ActiveInterface )
	{
		AvGadget.instance().sendHapticEvent(activeInterface.self, 0.7, 1, 0 );
		let listenHandle = AvGadget.instance().listenForActionState( EAction.A, this.props.hand, 
			async () =>
			{
				this.setState( { grabButtonDown: true } );
				// A was pressed
				await activeInterface.lock();
				activeInterface.sendEvent( { type: GrabRequestType.SetGrabber } as GrabRequest );
				this.setState( { grabberFromGrabbable: activeInterface.selfFromPeer } );
			},
			async () =>
			{
				// A was released
				if( !this.state.lostGrab )
				{
					// we need to wait here to make sure the moveable on the other 
					// end has a good transform relative to its new container when 
					// we unlock below.
					await activeInterface.sendEvent( { type: GrabRequestType.DropYourself } as GrabRequest );
					this.setState( { waitingForDropComplete: true } );
				}
				else
				{
					AvGadget.instance().unlistenForActionState( listenHandle );
					this.setState( { activeInterface: null } );	
					activeInterface.unlock();	
					this.setState( { grabberFromGrabbable: null, grabButtonDown: false, lostGrab: false } );
				}
			} );

		activeInterface.onEvent( 
			( event: GrabRequest ) =>
			{
				switch( event.type )
				{
					case GrabRequestType.DropComplete:
					{
						activeInterface.unlock();	
						this.setState( { grabberFromGrabbable: null, grabButtonDown: false, lostGrab: false, 
							waitingForDropComplete: false } );	
					}
					break;
				}
			} );

		activeInterface.onEnded( () =>
		{
			if( this.state.grabButtonDown )
			{
				this.setState( { lostGrab: true } );
			}
			else
			{
				AvGadget.instance().unlistenForActionState( listenHandle );
				this.setState( { activeInterface: null } );	
				AvGadget.instance().sendHapticEvent(activeInterface.self, 0.3, 1, 0 );
			}
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

		// poker highlight takes priority
		if( this.state.pokerHighlight )
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



