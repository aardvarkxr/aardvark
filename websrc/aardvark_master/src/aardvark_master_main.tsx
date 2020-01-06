import * as React from 'react';
import  * as ReactDOM from 'react-dom';
import bind from 'bind-decorator';
import { AvGadget, AvOrigin, AvTransform, AvGrabber, AvModel, AvPoker, AvPanelIntersection,
	AvLine, AvGrabButton, AvPanel, AvPanelAnchor, AvGadgetSeed, AvStandardBoxHook } 
	from '@aardvarkxr/aardvark-react';

import { Av, EndpointAddr, AvColor, AvGadgetManifest, EHand, GrabberHighlight, g_builtinModelSphere, g_builtinModelBackfacedSphere, g_builtinModelToolbox, EAction } from '@aardvarkxr/aardvark-shared'

interface DefaultHandProps
{
	hand: EHand;
}

interface DefaultHandState
{
	grabberHighlight: GrabberHighlight;
	pokerHighlight: boolean;
	currentPanel: EndpointAddr;
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

	public render()
	{
		let modelColor = "#222288FF";
		let highlightColor = "#FF0000FF";
		switch( this.state.grabberHighlight )
		{
			case GrabberHighlight.NearHook:
			case GrabberHighlight.Grabbed:
			case GrabberHighlight.WaitingForConfirmation:
			case GrabberHighlight.InRange:
					modelColor = highlightColor;
					break;
		}

		// poker highlight takes priority
		if( this.state.pokerHighlight )
		{
			modelColor = highlightColor;
		}

		let originPath:string;
		let hookName:string;
		switch( this.props.hand )
		{
		case EHand.Left:
			originPath = "/user/hand/left";
			hookName = "left_hand";
			break;
		case EHand.Right:
			originPath = "/user/hand/right";
			hookName = "right_hand";
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
					radius={ 0.001 } />
				<AvStandardBoxHook persistentName={ hookName } hand={ this.props.hand }
					xMin={-0.3} xMax={0.3}
					yMin={-0.3} yMax={0.5}
					zMin={-0.3} zMax={0.3}
					/>
			</AvOrigin>
		);
	}
}

class MasterControls extends React.Component< {}, {} >
{
	constructor( props: any )
	{
		super( props );
	}

	public render()
	{
		return (
			<div className="FullPage">
				<DefaultHand hand={ EHand.Left } />
				<DefaultHand hand={ EHand.Right } />
				<AvOrigin path="/user/head">
					<AvTransform translateY={ 0.2 }>
						<AvStandardBoxHook
							xMin={-0.3} xMax={0.3}
							yMin={-0.6} yMax={0.2}
							zMin={-0.3} zMax={0.3}
							outerVolumeScale={ 2.0 }
							persistentName="head"/>
					</AvTransform>
				</AvOrigin>
			</div>
		);
	}
}

ReactDOM.render( <MasterControls/>, document.getElementById( "root" ) );

// always start the renderer
Av().startGadget( "http://localhost:23842/gadgets/aardvark_renderer", "", "", null );

