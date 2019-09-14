import * as React from 'react';
import  * as ReactDOM from 'react-dom';

import { AvTransform } from 'common/aardvark-react/aardvark_transform';
import bind from 'bind-decorator';
import { AvSlider } from 'common/aardvark-react/aardvark_slider';
import { AvGrabbable } from 'common/aardvark-react/aardvark_grabbable';
import { AvSphereHandle } from 'common/aardvark-react/aardvark_handles';
import { AvModel } from 'common/aardvark-react/aardvark_model';


interface ControlTestState
{
}


class ControlTest extends React.Component< {}, ControlTestState >
{
	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
		};
	}

	@bind onSetSlider( newValue: number[] )
	{
		console.log( `Slider set to ${ newValue[0] }` );
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

					<AvTransform translateY={ 0.3 } >
						<AvSlider rangeX={ 1 } onSetValue={ this.onSetSlider }
							modelUri="https://aardvark.install/models/gear.glb"/>
					</AvTransform>
				</AvGrabbable>
			</div>
		)
	}
}

ReactDOM.render( <ControlTest/>, document.getElementById( "root" ) );
