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
import { AvTransformControl } from 'common/aardvark-react/aardvark_translate_control';
import { AvNodeTransform } from 'common/aardvark-react/aardvark_protocol';
import { QuaternionToEulerAngles, RadiansToDegrees } from 'common/aardvark-react/aardvark_utils';


interface ControlTestState
{
	sliderValue: number;
	transformValue: AvNodeTransform;
}


class ControlTest extends React.Component< {}, ControlTestState >
{
	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
			sliderValue: 0,
			transformValue: 
			{
			},
		};
	}

	@bind onSetSlider( newValue: number[] )
	{
		this.setState( { sliderValue: newValue[0] } );
	}

	@bind onSetTransform( newValue: AvNodeTransform )
	{
		this.setState( { transformValue: newValue } );
	}

	private renderTransformLabel()
	{
		if( !this.state.transformValue )
			return null;

		let tx = this.state.transformValue.position ? this.state.transformValue.position.x : 0;
		let ty = this.state.transformValue.position ? this.state.transformValue.position.y : 0;
		let tz = this.state.transformValue.position ? this.state.transformValue.position.z : 0;
		let sx = this.state.transformValue.scale ? this.state.transformValue.scale.x : 1;
		let sy = this.state.transformValue.scale ? this.state.transformValue.scale.y : 1;
		let sz = this.state.transformValue.scale ? this.state.transformValue.scale.z : 1;
		let r = QuaternionToEulerAngles( this.state.transformValue.rotation );

		return <div className="TranslateLabel">

				<div>[ { tx.toFixed( 3 ) }, { ty.toFixed( 3 ) }, { tz.toFixed( 3 ) } ]</div>
				<div>[ { sx.toFixed( 2 ) }, { sy.toFixed( 2 ) }, { sz.toFixed( 2 ) } ]</div>
				<div>[ { RadiansToDegrees( r.yaw ).toFixed( 0 ) }, 
					{ RadiansToDegrees( r.pitch ).toFixed( 0 ) }, { RadiansToDegrees( r.roll ).toFixed( 0 ) } ]</div>
			</div>;
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
										<AvSlider rangeX={ 0.7 } onSetValue={ this.onSetSlider }
											modelUri="https://aardvark.install/models/gear.glb"/>
									</AvPanelAnchor>
								</div>
							</div>

							<div className="TranslateContainer">
								{ this.renderTransformLabel() }
								<div className="TranslateControl">
									<AvPanelAnchor>
										<AvTransformControl onSetValue={ this.onSetTransform }
											translate= { true } 
											rotate= { true } 
											scale= { true } 
											general= { true } />
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
