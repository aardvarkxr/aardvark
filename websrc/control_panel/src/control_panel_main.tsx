import * as React from 'react';
import  * as ReactDOM from 'react-dom';

import { AvGadget } from 'common/aardvark-react/aardvark_gadget';
import { AvTransform } from 'common/aardvark-react/aardvark_transform';
import { AvPanel } from 'common/aardvark-react/aardvark_panel';
import bind from 'bind-decorator';
import { EndpointAddr } from 'common/aardvark-react/aardvark_protocol';
import { AvGrabButton } from 'common/aardvark-react/aardvark_grab_button';
import { AvPanelAnchor } from 'common/aardvark-react/aardvark_panelanchor';
import { AvModel } from 'common/aardvark-react/aardvark_model';
import { AvGadgetSeed } from 'common/aardvark-react/aardvark_gadget_seed';


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
			{ this.renderGadgetSeed( "https://aardvark.install/gadgets/charm_bracelet") }
			{ this.renderGadgetSeed( "https://aardvark.install/gadgets/test_panel") }
			{ this.renderGadgetSeed( "https://aardvark.install/gadgets/test_gadget_launcher") }
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
			<AvGadget gadgetUri="">
				<AvTransform translateZ={-0.1} rotateX={ 45 }>
					<AvGrabButton modelUri="https://aardvark.install/models/gear.glb" 
						onTrigger={ this.onActivateControlPanel } />
				</AvTransform>;
				{ this.renderPanel() }

			</AvGadget>	);
	}
}

ReactDOM.render( <ControlPanel/>, document.getElementById( "root" ) );
