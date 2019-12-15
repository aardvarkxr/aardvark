import * as React from 'react';
import  * as ReactDOM from 'react-dom';
import bind from 'bind-decorator';
import { AvGadget, AvOrigin, AvTransform, AvGrabber, AvModel, AvPoker, AvPanelIntersection,
	AvLine, AvGrabButton, AvPanel, AvPanelAnchor, AvGadgetSeed, AvStandardBoxHook } 
	from '@aardvarkxr/aardvark-react';

import { Av, EndpointAddr, EHand, GrabberHighlight, g_builtinModelSphere, g_builtinModelGear, g_builtinModelBackfacedSphere } from '@aardvarkxr/aardvark-shared'

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
	private m_editModeHandle = 0;

	constructor( props: any )
	{
		super( props );

		this.state = 
		{ 
			grabberHighlight: GrabberHighlight.None,
			pokerHighlight: false,
			currentPanel: null,
		};

		this.m_editModeHandle = AvGadget.instance().listenForEditModeWithComponent( this )
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
		AvGadget.instance().unlistenForEditMode( this.m_editModeHandle );
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
					radius={0.0} />
					{this.props.hand == EHand.Left && 
				<AvStandardBoxHook persistentName={ hookName } hand={ this.props.hand }
					xMin={-0.3} xMax={0.3}
					yMin={-0.3} yMax={0.5}
					zMin={-0.3} zMax={0.3}
					/>}
				{ AvGadget.instance().getEditModeForHand( this.props.hand ) && <ControlPanel />}
			</AvOrigin>
		);
	}
}

interface ControlPanelState
{
	active: boolean;
	installedGadgets?: string[];
}

class ControlPanel extends React.Component< {}, ControlPanelState >
{
	private m_panelId: EndpointAddr;

	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
			active: false,
		};

		AvGadget.instance().getInstalledGadgets()
		.then( ( installedGadgets: string[] ) =>
		{
			this.setState( { installedGadgets } );
		} );
	}

	@bind onActivateControlPanel()
	{
		this.setState( { active: !this.state.active } );
	}

	private renderGadgetSeedList()
	{
		if( !this.state.installedGadgets )
		{
			return <div>No Gadgets installed.</div>;
		}
		else
		{
			let seeds: JSX.Element[] = [];
			for( let gadget of this.state.installedGadgets )
			{
				seeds.push( 
					<div className="GadgetSeed">
						<AvPanelAnchor>
							<AvModel uri={ g_builtinModelBackfacedSphere } scaleToFit={{x: 0.125, y: 0.125, z: 0.125}}>
								<AvGadgetSeed key="gadget" uri={ gadget } 
									radius={ 0.07 }/>
							</AvModel>
						</AvPanelAnchor>
					</div> );
			}
			return <div className="GadgetSeedContainer">{ seeds }</div>;
		}
	}

	public renderPanel()
	{
		if( !this.state.active )
			return null;

		return <AvTransform rotateX={ 45 } translateZ={ -0.1 }>
				<AvTransform uniformScale={ 0.25 }>
					<AvTransform translateZ={ -0.55 }>
						<AvPanel interactive={false}>
							<div className="FullPage" >
								{ this.renderGadgetSeedList() }
							</div>;
						</AvPanel>
					</AvTransform>
				</AvTransform>
			</AvTransform>;
	}

	public render()
	{
		return (
			<AvTransform>
				<AvTransform translateZ={-0.1} rotateX={ 45 }>
					<AvGrabButton modelUri={ g_builtinModelGear } 
						onTrigger={ this.onActivateControlPanel } />
				</AvTransform>;
				{ this.renderPanel() }
			</AvTransform>	);
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
				<ControlPanel />
			</div>
		);
	}
}

ReactDOM.render( <MasterControls/>, document.getElementById( "root" ) );

// always start the renderer
Av().startGadget( "http://localhost:23842/gadgets/aardvark_renderer", "", "", null );

