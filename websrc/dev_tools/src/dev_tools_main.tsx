import { AvGadget, AvMessagebox, AvPanel, AvStandardGrabbable, AvTransform } from '@aardvarkxr/aardvark-react';
import { Av, EndpointType, g_builtinModelBox, MessageType, MsgDestroyGadget } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import { CMonitorStore } from 'common/monitor_store';
import { observer } from 'mobx-react';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

const k_TestPanelInterface = "test_panel_counter@1";


interface DevToolPanelState
{
}


const k_neverKillGadgets =
[
	"http://localhost:23842/gadgets/gadget_menu",
	"http://localhost:23842/gadgets/messagebox",
	"http://localhost:23842/gadgets/aardvark_renderer",
	"http://localhost:23842/gadgets/default_hands",
	"http://localhost:23842/gadgets/dev_tools",
];

function isNeverKillGadget( gadgetUrl: string ): boolean
{
	for( let neverKillUrl of k_neverKillGadgets )
	{
		if( gadgetUrl.startsWith( neverKillUrl ) )
		{
			return true;
		}
	}

	return false;
}


@observer
class DevToolPanel extends React.Component< {}, DevToolPanelState >
{
	private m_grabbableRef = React.createRef<AvStandardGrabbable>();
	private m_messageboxRef = React.createRef<AvMessagebox>();

	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
		};
	}

	@bind
	private onDeleteAllGadgets()
	{
		for( let epid of MonitorStore.m_endpoints.keys() )
		{
			let ep = MonitorStore.m_endpoints.get( epid );
			switch( ep.type )
			{
				case EndpointType.Gadget:
					let gadgetData = MonitorStore.getGadgetData( epid );
					if( !isNeverKillGadget( gadgetData.gadgetUri ) )
					{
						let m: MsgDestroyGadget =
						{
							gadgetId: epid
						};
				
						AvGadget.instance().sendMessage( MessageType.DestroyGadget, m );
					}
					break;
			}
		}
	}

	public renderContents()
	{
		return <>
				<div className="Label">Developer Panel</div>
				<div className="Button" onMouseDown={ this.onDeleteAllGadgets }>
					Delete all Gadgets
				</div> 

			</>
	}

	public render()
	{
		let sDivClasses:string = "FullPage";

		return (
			<div className={ sDivClasses } >
				<div>
					<AvStandardGrabbable modelUri={ g_builtinModelBox } modelScale={ 0.03 }
						modelColor="lightblue" useInitialParent={ true } ref={ this.m_grabbableRef }>
						<AvTransform translateY={ 0.08 } >
							<AvPanel interactive={true} widthInMeters={ 0.1 }/>
						</AvTransform>
					</AvStandardGrabbable>
				</div>
				{ this.renderContents() }

				<AvMessagebox ref={ this.m_messageboxRef }/>
			</div> );
	}

}

let MonitorStore = new CMonitorStore();
let main = Av() ? <DevToolPanel/> : <div className="Label">Please open this in Aardvark</div>;
ReactDOM.render( main, document.getElementById( "root" ) );
