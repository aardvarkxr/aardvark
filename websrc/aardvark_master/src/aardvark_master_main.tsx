import * as React from 'react';
import  * as ReactDOM from 'react-dom';
import bind from 'bind-decorator';
import { AvGadget,AvOrigin, AvTransform, AvGrabber, AvModel, AvPoker, 
	AvStandardHook, Av, AvGrabButton, AvPanel, AvPanelAnchor, AvGadgetSeed,
	 EndpointAddr, EHand, GrabberHighlight } 
	from 'aardvark-react';


interface DefaultHandProps
{
	hand: EHand;
}

interface DefaultHandState
{
	grabberHighlight: GrabberHighlight;
	pokerHighlight: boolean;
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
		};

		this.m_editModeHandle = AvGadget.instance().listenForEditModeWithComponent( this )
	}

	@bind updateGrabberHighlight( newHighlight: GrabberHighlight )
	{
		this.setState( { grabberHighlight: newHighlight } );
	}

	@bind updatePokerHighlight( newHighlight: boolean )
	{
		this.setState( { pokerHighlight: newHighlight } );
	}

	componentWillUnmount()
	{
		AvGadget.instance().unlistenForEditMode( this.m_editModeHandle );
	}
	public render()
	{
		let modelColor = "#222288FF";
		let highlightColor = "#FF0000FF";
		let modelUri = "https://aardvark.install/models/sphere/sphere.glb";
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
					<AvModel uri={ modelUri } color={ modelColor }/>
				</AvTransform>

				<AvPoker updateHighlight = { this.updatePokerHighlight } />
				<AvGrabber updateHighlight = { this.updateGrabberHighlight }
					radius={0.001} />
				<AvStandardHook persistentName={ hookName } hand={ this.props.hand }/>
				{ AvGadget.instance().getEditModeForHand( this.props.hand ) && <ControlPanel />}
			</AvOrigin>
		);
	}
}

interface ControlPanelState
{
	active: boolean;
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
	}

	@bind onActivateControlPanel()
	{
		this.setState( { active: !this.state.active } );
	}

	private renderGadgetSeed( uri: string )
	{
		return <div className="GadgetSeed">
			<AvPanelAnchor>
				<AvGadgetSeed uri={ uri } />
			</AvPanelAnchor>
		</div>;
	}

	private renderGadgetSeedList()
	{
		return <div className="GadgetSeedContainer">
			{ this.renderGadgetSeed( "https://aardvark.install/gadgets/test_panel") }
			{ this.renderGadgetSeed( "https://aardvark.install/gadgets/charm_bracelet") }
			{ this.renderGadgetSeed( "https://aardvark.install/gadgets/control_test") }
		</div>;
	}

	public renderPanel()
	{
		if( !this.state.active )
			return null;

		return <AvTransform rotateX={ 45 } translateZ={ -0.1 }>
				<AvTransform uniformScale={0.25}>
					<AvTransform translateZ={ -0.55 }>
						<AvPanel interactive={true}>
							<div className="FullPage" >
								<h1>This is the control panel</h1>
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
					<AvGrabButton modelUri="https://aardvark.install/models/gear.glb" 
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
			<div>
				<DefaultHand hand={ EHand.Left } />
				<DefaultHand hand={ EHand.Right } />
				<ControlPanel />
			</div>
		);
	}
}

ReactDOM.render( <MasterControls/>, document.getElementById( "root" ) );

// always start the renderer
Av().startGadget( "http://aardvark.install/gadgets/aardvark_renderer", "", "", null );

