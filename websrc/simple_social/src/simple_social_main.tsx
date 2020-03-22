import * as React from 'react';
import  * as ReactDOM from 'react-dom';

import bind from 'bind-decorator';
import { AvGadget, AvTransform, AvGrabButton, AvPanelAnchor, AvGadgetSeed, AvPanel, AvGrabbable, AvModelBoxHandle, HighlightType, AvModel, AvOrigin, AvDefaultChamber } from '@aardvarkxr/aardvark-react';
import { g_builtinModelGear, EndpointAddr } from '@aardvarkxr/aardvark-shared';


interface ControlPanelState
{
	highlight: HighlightType;
	installedGadgets?: string[];
}

class ControlPanel extends React.Component< {}, ControlPanelState >
{
	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
			highlight: HighlightType.None,
		};

		AvGadget.instance().getInstalledGadgets()
		.then( ( installedGadgets: string[] ) =>
		{
			this.setState( { installedGadgets } );
		} );
	}

	@bind onUpdateHighlight( highlight: HighlightType, handleAddr: EndpointAddr, tethered: boolean )
	{
		console.log( `Highlight state is ${ HighlightType[ highlight ] }` );
		this.setState( { highlight } );
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
							<AvGadgetSeed key="gadget" uri={ gadget } 
								radius={ 0.1 }/>
						</AvPanelAnchor>
					</div> );
			}
			return <div className="GadgetSeedContainer">{ seeds }</div>;
		}
	}

	public renderPanel()
	{
		if( this.state.highlight != HighlightType.Grabbed )
			return null;

		return <AvTransform rotateX={ 45 } translateZ={ -0.1 }>
				<AvTransform uniformScale={0.25}>
					<AvTransform translateZ={ -0.55 }>
						<AvPanel interactive={false}>
							<div className="FullPage" >
								<h1>This is the control panel</h1>
							</div>;
						</AvPanel>
					</AvTransform>
				</AvTransform>
			</AvTransform>;
	}

	public renderChamber()
	{
		return <AvOrigin path="/space/stage" >
				<AvDefaultChamber chamberId="chuck" showSelf={ true } />
			</AvOrigin>;
	}

	public render()
	{
		return (
			<AvGrabbable updateHighlight={ this.onUpdateHighlight } preserveDropTransform={ true }
				grabWithIdentityTransform={ true }
				dropOnHooks={ true }> 
				<AvTransform uniformScale={ this.state.highlight == HighlightType.InRange ? 1.1 : 1.0 } >
					<AvModel uri={ g_builtinModelGear } />
					<AvModelBoxHandle uri={ g_builtinModelGear }/>
				</AvTransform>

				{ this.renderPanel() }
				{ this.renderChamber() }
			</AvGrabbable>	);
	}
}


ReactDOM.render( <ControlPanel/>, document.getElementById( "root" ) );
