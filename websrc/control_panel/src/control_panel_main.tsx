import * as React from 'react';
import  * as ReactDOM from 'react-dom';

import { AvGadget } from 'common/aardvark-react/aardvark_gadget';
import { AvTransform } from 'common/aardvark-react/aardvark_transform';
import { AvPanel } from 'common/aardvark-react/aardvark_panel';
import bind from 'bind-decorator';
import { EndpointAddr } from 'common/aardvark-react/aardvark_protocol';
import { AvGrabButton } from 'common/aardvark-react/aardvark_grab_button';


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
								<div className="Button">
									Click Me!
								</div> 
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
