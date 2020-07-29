import { AvGadget, AvPanel, AvStandardGrabbable, AvTransform, HighlightType, DefaultLanding, AvMessagebox } from '@aardvarkxr/aardvark-react';
import { EAction, EHand, g_builtinModelBox, InitialInterfaceLock, Av } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

const k_TestPanelInterface = "test_panel_counter@1";

interface TestPanelState
{
	count: number;
	grabbableHighlight: HighlightType;
	lastMessageboxResponse?: string;
}

interface TestSettings
{
	count: number;
}

interface TestPanelEvent
{
	type: "increment" | "set_count";
	count?: number;
}

class TestPanel extends React.Component< {}, TestPanelState >
{
	private m_actionListeners: number[];
	private m_grabbableRef = React.createRef<AvStandardGrabbable>();
	private m_messageboxRef = React.createRef<AvMessagebox>();

	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
			count: 0,
			grabbableHighlight: HighlightType.None,
		};
	}

	public componentDidMount()
	{
		if( !AvGadget.instance().isRemote )
		{
			this.m_actionListeners = 
			[
				AvGadget.instance().listenForActionStateWithComponent( EHand.Invalid, EAction.A, this ),
				AvGadget.instance().listenForActionStateWithComponent( EHand.Invalid, EAction.B, this ),
				AvGadget.instance().listenForActionStateWithComponent( EHand.Invalid, EAction.Squeeze, this ),
				AvGadget.instance().listenForActionStateWithComponent( EHand.Invalid, EAction.Grab, this ),
				AvGadget.instance().listenForActionStateWithComponent( EHand.Invalid, EAction.Detach, this ),
			];

			AvGadget.instance().registerForSettings( this.onSettingsReceived );
		}
		else
		{
			let params = AvGadget.instance().findInitialInterface( k_TestPanelInterface )?.params as TestSettings;
			this.onSettingsReceived( params );			
		}
	}

	public componentWillUnmount()
	{
		if( !AvGadget.instance().isRemote )
		{
			for( let listener of this.m_actionListeners )
			{
				AvGadget.instance().unlistenForActionState( listener );
			}

			this.m_actionListeners = [];
		}
	}

	@bind public incrementCount()
	{
		if( AvGadget.instance().isRemote )
		{
			let e: TestPanelEvent = { type: "increment" };
			this.m_grabbableRef.current?.sendRemoteEvent( e, true );
		}
		else
		{
			this.setState( ( oldState ) => 
				{ 
					return { ...oldState, count: oldState.count + 1 };
				} );
		}
	}

	public componentDidUpdate()
	{
		if( !AvGadget.instance().isRemote )
		{
			let e: TestPanelEvent = { type: "set_count", count: this.state.count };
			this.m_grabbableRef.current?.sendRemoteEvent( e, true );
		}
	}


	@bind public onSettingsReceived( settings: TestSettings )
	{
		if( settings )
		{
			this.setState( { count: settings.count } );
		}
	}

	@bind
	private onRemoteEvent( event: TestPanelEvent )
	{
		switch( event.type )
		{
			case "increment":
				if( AvGadget.instance().isRemote )
				{
					console.log( "Received unexpected increment event on remote" );
				}
				else
				{
					this.incrementCount();
				}
				break;
			
			case "set_count":
				if( !AvGadget.instance().isRemote )
				{
					console.log( "Received unexpected set_count event on master" );
				}
				else
				{
					this.setState( { count: event.count } );
				}
				break;		
		}
	}

	public renderActionStateLabel( action: EAction )
	{
		if( AvGadget.instance().getActionStateForHand( EHand.Invalid, action ) )
			return <div className="Label">{ EAction[ action ] }: TRUE</div>;
		else
			return <div className="Label">{ EAction[ action ] }: false</div>;
	}

	@bind
	public async showMessagebox()
	{
		let res = await this.m_messageboxRef.current.showPrompt( "This is a caption", 
		[
			{ text: "Button A", name: "a" },
			{ text: "Button B", name: "b" },
			{ text: "Button C", name: "c" },
			{ text: "Button D", name: "d" },
		] );
		this.setState( { lastMessageboxResponse: res } );
	}

	public renderRemote()
	{
		return (
			<>
				<div className="Label">Count: { this.state.count }</div>
				<div className="Label">This gadget is owned by somebody else</div>
				<div className="Button" onMouseDown={ this.incrementCount }>
					Increment count...
				</div> 
			</>
		);
	}

	public renderLocal()
	{
		return <>
				<div className="Label">Count: { this.state.count }</div>
				<div className="Label">This gadget is owned by me</div>
				<div className="Button" onMouseDown={ this.incrementCount }>
					Increment count...
				</div> 
				{ this.renderActionStateLabel( EAction.A ) }
				{ this.renderActionStateLabel( EAction.B ) }
				{ this.renderActionStateLabel( EAction.Squeeze ) }
				{ this.renderActionStateLabel( EAction.Grab ) }
				{ this.renderActionStateLabel( EAction.Detach ) }
				<div className="Button" onMouseDown={ this.showMessagebox }>
					Show Messagebox
				</div> 
				{ this.state.lastMessageboxResponse && 
					<div className="Label">{ this.state.lastMessageboxResponse }</div> }

			</>
	}

	public render()
	{
		let sDivClasses:string = "FullPage";

		let remoteInitLocks: InitialInterfaceLock[] = [];

		if( !AvGadget.instance().isRemote )
		{
			remoteInitLocks.push( {
				iface: k_TestPanelInterface,
				receiver: null,
				params: 
				{
					count: this.state.count,
				}
			} );
		}

		return (
			<div className={ sDivClasses } >
				<div>
					<AvStandardGrabbable modelUri={ g_builtinModelBox } modelScale={ 0.03 } remoteGadgetCallback={ this.onRemoteEvent }
						modelColor="lightblue" useInitialParent={ true } remoteInterfaceLocks={ remoteInitLocks } ref={ this.m_grabbableRef }>
						<AvTransform translateY={ 0.08 } >
							<AvPanel interactive={true} widthInMeters={ 0.1 }/>
						</AvTransform>
					</AvStandardGrabbable>
				</div>
				{ AvGadget.instance().isRemote ? this.renderRemote() : this.renderLocal() }
				<AvMessagebox ref={ this.m_messageboxRef }/>
			</div> );
	}

}

let main = Av() ? <TestPanel/> : <DefaultLanding/>;
ReactDOM.render( main, document.getElementById( "root" ) );
