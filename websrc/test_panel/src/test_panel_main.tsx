import * as React from 'react';
import  * as ReactDOM from 'react-dom';

import bind from 'bind-decorator';

import { AvGadget, AvTransform, AvPanel, AvGrabbable, HighlightType, GrabResponse, AvSphereHandle } from '@aardvarkxr/aardvark-react';
import { EndpointAddr, AvGrabEvent, EAction, EHand } from '@aardvarkxr/aardvark-shared';


interface TestPanelState
{
	count: number;
	grabbableHighlight: HighlightType;
	inChamber: boolean;
}

interface TestSettings
{
	count: number;
}

class TestPanel extends React.Component< {}, TestPanelState >
{
	private m_panelId: EndpointAddr;
	private m_actionListeners: number[];

	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
			count: 0,
			grabbableHighlight: HighlightType.None,
			inChamber: false,
		};

		AvGadget.instance().registerForSettings( this.onSettingsReceived );
	}

	public componentDidMount()
	{
		this.m_actionListeners = 
		[
			AvGadget.instance().listenForActionStateWithComponent( EHand.Invalid, EAction.A, this ),
			AvGadget.instance().listenForActionStateWithComponent( EHand.Invalid, EAction.B, this ),
			AvGadget.instance().listenForActionStateWithComponent( EHand.Invalid, EAction.Squeeze, this ),
			AvGadget.instance().listenForActionStateWithComponent( EHand.Invalid, EAction.Grab, this ),
			AvGadget.instance().listenForActionStateWithComponent( EHand.Invalid, EAction.Detach, this ),
		];
	}

	public componentWillUnmount()
	{
		for( let listener of this.m_actionListeners )
		{
			AvGadget.instance().unlistenForActionState( listener );
		}

		this.m_actionListeners = [];
	}

	@bind public incrementCount()
	{
		this.setState( { count: this.state.count + 1 } );

		let newSettings: TestSettings = { count: this.state.count + 1 };
		AvGadget.instance().saveSettings( newSettings );

	}

	@bind public onJoinEdward()
	{
		AvGadget.instance().joinChamber( "edward2" );
	}

	@bind public onHighlightGrabbable( highlight: HighlightType )
	{
		this.setState( { grabbableHighlight: highlight } );
	}

	@bind public onGrabRequest( grabRequest: AvGrabEvent ): Promise< GrabResponse >
	{
		// this is totally unnecessary, but a good test of the plumbing.
		let response: GrabResponse =
		{
			allowed: true,
		};
		return Promise.resolve( response );
	}

	@bind public onSettingsReceived( settings: TestSettings )
	{
		if( settings )
		{
			this.setState( { count: settings.count } );
		}
	}

	public renderActionStateLabel( action: EAction )
	{
		if( AvGadget.instance().getActionStateForHand( EHand.Invalid, action ) )
			return <div className="Label">{ EAction[ action ] }: TRUE</div>;
		else
			return <div className="Label">{ EAction[ action ] }: false</div>;
	}

	public render()
	{
		let sDivClasses:string;
		let scale = 0.1;
		switch( this.state.grabbableHighlight )
		{
			case HighlightType.None:
				sDivClasses = "FullPage NoGrabHighlight";
				break;

			case HighlightType.InRange:
				sDivClasses = "FullPage InRangeHighlight";
				break;

			case HighlightType.Grabbed:
				sDivClasses = "FullPage GrabbedHighlight";
				break;

			case HighlightType.InHookRange:
				sDivClasses = "FullPage GrabbedHighlight";
				//scale = 0.05;
				break;
		
		}

		return (
			<div className={ sDivClasses } >
				<div>
					<AvGrabbable updateHighlight={ this.onHighlightGrabbable }
						onGrabRequest={ this.onGrabRequest }
						dropOnHooks={ true }>
						<AvSphereHandle radius={0.1} />
						
						<AvTransform uniformScale={ scale }>
							<AvPanel interactive={true}
								onIdAssigned={ (id: EndpointAddr) => { this.m_panelId = id } }/>
						</AvTransform>
					</AvGrabbable>
				</div>
				<div className="Label">Count: { this.state.count }</div>
				<div className="Button" onMouseDown={ this.incrementCount }>
					Increment count...
					</div> 
				<div className="Button" onMouseDown={ this.onJoinEdward }>
					Join the "Edward" chamber!
				</div> 
				{ this.renderActionStateLabel( EAction.A ) }
				{ this.renderActionStateLabel( EAction.B ) }
				{ this.renderActionStateLabel( EAction.Squeeze ) }
				{ this.renderActionStateLabel( EAction.Grab ) }
				{ this.renderActionStateLabel( EAction.Detach ) }
			</div>
		)
	}
}

ReactDOM.render( <TestPanel/>, document.getElementById( "root" ) );
