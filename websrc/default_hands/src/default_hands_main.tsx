import * as React from 'react';
import  * as ReactDOM from 'react-dom';
import bind from 'bind-decorator';
import { AvGadget,AvOrigin, AvTransform, AvGrabber, AvModel, AvPoker, AvPanelIntersection,
	AvLine,	AvStandardBoxHook, InterfaceEntityProcessor, ActiveInterface, AvInterfaceEntity, AvEntityChild } 
	from '@aardvarkxr/aardvark-react';
import { Av, EndpointAddr, EHand, GrabberHighlight, g_builtinModelSphere, EAction, g_builtinModelHead,
	g_builtinModelHandRight, g_builtinModelHandLeft, Permission, EVolumeType, AvNodeTransform, endpointAddrToString, endpointAddrsMatch } from '@aardvarkxr/aardvark-shared'

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
}


class DefaultHand extends React.Component< DefaultHandProps, DefaultHandState >
{
	private m_actionListenerHandle = 0;

	constructor( props: any )
	{
		super( props );

		this.state = 
		{ 
			grabberHighlight: GrabberHighlight.None,
			pokerHighlight: false,
			currentPanel: null,
			activeInterface: null,
		};

		this.m_actionListenerHandle = AvGadget.instance().listenForActionStateWithComponent( this.props.hand, 
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
		AvGadget.instance().unlistenForActionState( this.m_actionListenerHandle );
	}

	@bind
	private onGrabStart( activeInterface: ActiveInterface )
	{
		let listenHandle = AvGadget.instance().listenForActionState(EAction.A, this.props.hand, 
			async () =>
			{
				// A was pressed
				await activeInterface.lock();
				activeInterface.sendEvent( { type: "SetGrabber" } );
				this.setState( { grabberFromGrabbable: activeInterface.selfFromPeer } );
			},
			() =>
			{
				// A was released
				activeInterface.sendEvent( { type: "DropYourself" } );
				activeInterface.unlock();
				this.setState( { grabberFromGrabbable: null } );
			} );

		activeInterface.onEvent( 
			( event: object ) =>
			{

			} );

		activeInterface.onEnded( () =>
		{
			AvGadget.instance().unlistenForActionState( listenHandle );
			this.setState( { activeInterface: null } );
		} );

		this.setState( { activeInterface } );
	}

	public render()
	{
		let modelColor = "#222288FF";
		let highlightColor = "#FF0000FF";
		// switch( this.state.grabberHighlight )
		// {
		// 	case GrabberHighlight.NearHook:
		// 	case GrabberHighlight.Grabbed:
		// 	case GrabberHighlight.WaitingForConfirmation:
		// 	case GrabberHighlight.InRange:
		// 			modelColor = highlightColor;
		// 			break;
		// }

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

		return (
			<AvOrigin path={ originPath }>
				<AvTransform uniformScale= { 0.01 } >
					<AvModel uri={ g_builtinModelSphere } color={ modelColor }/>
				</AvTransform>

				<AvPoker updateHighlight = { this.updatePokerHighlight } >
					{ this.state.pokerHighlight && 
						<>
							<AvPanelIntersection id="panel_highlight" panelId={ this.state.currentPanel }/>
							<AvLine endId="panel_highlight" color="yellow"/>
						</>
					}
				</AvPoker>
				<AvGrabber updateHighlight = { this.updateGrabberHighlight }
					radius={ 0.001 } persistentName={ grabberName }/>
				<AvStandardBoxHook persistentName={ hookName } hand={ this.props.hand }
					dropIconUri={ dropIcon }
					outerVolumeScale={ 2 }
					xMin={-0.15} xMax={0.15}
					yMin={-0.15} yMax={0.25}
					zMin={-0.15} zMax={0.15}
					/>
				<AvInterfaceEntity transmits={
					{ 
						"aardvark-grab@1": this.onGrabStart }
					} 
					volume={ { type: EVolumeType.Sphere, radius: 0.01 } } >
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

interface ContainerItem
{
	epa: EndpointAddr;
	containerFromEntity: AvNodeTransform;
	state: "Moving" | "Resting";
}

class DefaultHands extends React.Component< {}, {} >
{
	private contents: ContainerItem[] = [];

	@bind
	private onContainerStart( activeContainer: ActiveInterface )
	{
		let myItem: ContainerItem =
		{
			epa: activeContainer.peer,
			containerFromEntity: activeContainer.selfFromPeer,
			state: "Moving",
		};
		this.contents.push( myItem );

		activeContainer.onEvent( 
			( event: any ) =>
			{
				myItem.state = event.state;
				myItem.containerFromEntity = activeContainer.selfFromPeer;
				this.forceUpdate();
			}
		)

		activeContainer.onEnded( 
			() =>
			{
				let i = this.contents.indexOf( myItem );
				if( i != -1 )
				{
					this.contents.splice( i, 1 );
				}
				this.forceUpdate();
			} );
	}

	public render()
	{
		let contents: JSX.Element[] = [];
		for( let item of this.contents )
		{
			if( item.state == "Resting" )
			{
				contents.push( 
					<AvTransform transform={ item.containerFromEntity } key={ endpointAddrToString( item.epa ) }>
						<AvEntityChild child={ item.epa } />
					</AvTransform> );
			}
		}

		return (
			<>
				<DefaultHand hand={ EHand.Left } />
				<DefaultHand hand={ EHand.Right } />
				<AvOrigin path="/user/head">
					<AvTransform translateY={ 0.2 }>
						<AvStandardBoxHook
							dropIconUri={ g_builtinModelHead }
							xMin={-0.3} xMax={0.3}
							yMin={-0.6} yMax={0.2}
							zMin={-0.3} zMax={0.3}
							outerVolumeScale={ 2.0 }
							persistentName="head"/>
					</AvTransform>
				</AvOrigin>
				<AvOrigin path="/space/stage">
					<AvInterfaceEntity receives={ { "aardvark-container@1": this.onContainerStart } }
						volume={ { type: EVolumeType.Infinite } }>
						{ contents }
					</AvInterfaceEntity>
				</AvOrigin>
			</>
		);
	}
}

ReactDOM.render( <DefaultHands/>, document.getElementById( "root" ) );



