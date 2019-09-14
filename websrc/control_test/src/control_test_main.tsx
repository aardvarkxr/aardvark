import * as React from 'react';
import  * as ReactDOM from 'react-dom';

import { AvTransform } from 'common/aardvark-react/aardvark_transform';
import bind from 'bind-decorator';
import { AvSlider } from 'common/aardvark-react/aardvark_slider';
import { AvGrabbable } from 'common/aardvark-react/aardvark_grabbable';
import { AvSphereHandle } from 'common/aardvark-react/aardvark_handles';
import { AvModel } from 'common/aardvark-react/aardvark_model';
import { AvPanel } from 'common/aardvark-react/aardvark_panel';
import { AvPanelAnchor } from 'common/aardvark-react/aardvark_panelanchor';


interface ControlTestState
{
	sliderValue: number;
}


class ControlTest extends React.Component< {}, ControlTestState >
{
	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
			sliderValue: 0,
		};
	}

	@bind onSetSlider( newValue: number[] )
	{
		this.setState( { sliderValue: newValue[0] } );
	}

	public render()
	{
		return (
			<div className="FullPage" >
				<AvGrabbable preserveDropTransform={true}>
					<AvTransform uniformScale={0.1}>
						<AvModel uri="https://aardvark.install/models/sphere/sphere.glb"/>
					</AvTransform>
					<AvSphereHandle radius={0.1} />

					<AvPanel interactive={ false } >
						<div className="ControlList">
							<div className="SliderContainer">
								<div className="SliderLabel">{ this.state.sliderValue.toFixed( 2 ) }</div>
								<div className="SliderControl">
									<AvPanelAnchor>
										<AvSlider rangeX={ 1 } onSetValue={ this.onSetSlider }
											modelUri="https://aardvark.install/models/gear.glb"/>
									</AvPanelAnchor>
								</div>
							</div>

						</div>
					</AvPanel>
				</AvGrabbable>
			</div>
		)
	}
}

ReactDOM.render( <ControlTest/>, document.getElementById( "root" ) );
