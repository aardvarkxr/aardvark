import * as React from 'react';
import { AvTransform } from './aardvark_transform';
import bind from 'bind-decorator';
import { AvModel } from './aardvark_model';
import { HighlightType, AvGrabbable, GrabResponse } from './aardvark_grabbable';
import { AvSphereHandle } from './aardvark_handles';
import { AvGrabEvent, AvConstraint, AvNodeTransform } from '@aardvarkxr/aardvark-shared';


interface SliderProps
{
	/** This callback is called when the slider thumb moves. */
	onSetValue: ( newValue: number[] ) => void;

	/** The model URI of the slider thumb */
	modelUri?: string;

	/** The slider will be allowed to move between -rangeX/2 and +rangeX/2 on the X axis.
	 * 
	 * @default 0
	 */
	rangeX?: number;

	/** The slider will be allowed to move between -rangeY/2 and +rangeY/2 on the Y axis.
	 * 
	 * @default 0
	 */
	rangeY?: number;

	/** The slider will be allowed to move between -rangeZ/2 and +rangeZ/2 on the Z axis.
	 * 
	 * @default 0
	 */
	rangeZ?: number;
}

interface SliderState
{
	highlight: HighlightType;
}

function clamp( n: number, min: number, max: number ): number
{
	return Math.min( max, Math.max( min, n ) );
}

export class AvSlider extends React.Component< SliderProps, SliderState >
{
	constructor( props: any )
	{
		super( props );

		this.state = 
		{ 
			highlight: HighlightType.None,
		};
	}

	@bind updateHighlight( newHighlight: HighlightType )
	{
		this.setState( { highlight: newHighlight } );
	}

	@bind onGrabRequest( event: AvGrabEvent )
	{
		return new Promise<GrabResponse>( ( resolve, reject ) =>
		{
			let resp: GrabResponse =
			{
				allowed: true,
			}
			resolve( resp );
		} );
	}
	
	@bind onTransformUpdated( parentFromNode: AvNodeTransform, universeFromNode: AvNodeTransform )
	{
		let newValue = [ 0, 0, 0 ];
		if( this.props.rangeX )
		{
			newValue[0] = clamp( ( parentFromNode.position.x + this.props.rangeX / 2 ) / this.props.rangeX,
				0, 1 );
		}
		if( this.props.rangeX )
		{
			newValue[1] = clamp( ( parentFromNode.position.y + this.props.rangeY / 2 ) / this.props.rangeY,
				0, 1 );		
		}
		if( this.props.rangeX )
		{
			newValue[2] = clamp( ( parentFromNode.position.z + this.props.rangeZ / 2 ) / this.props.rangeZ,
				0, 1 );
		}

		this.props.onSetValue( newValue );
	}

	public render()
	{
		let constraint: AvConstraint = 
		{
			minX: 0, maxX: 0,
			minY: 0, maxY: 0,
			minZ: 0, maxZ: 0,
		}

		if( this.props.rangeX )
		{
			constraint.minX = -this.props.rangeX / 2;
			constraint.maxX = this.props.rangeX / 2;
		}
		if( this.props.rangeY )
		{
			constraint.minY = -this.props.rangeY / 2;
			constraint.maxY = this.props.rangeY / 2;
		}
		if( this.props.rangeZ )
		{
			constraint.minZ = -this.props.rangeZ / 2;
			constraint.maxZ = this.props.rangeZ / 2;
		}

		return <div>
				<AvGrabbable updateHighlight={ this.updateHighlight } onGrabRequest={ this.onGrabRequest }
					constraint={ constraint } onTransformUpdated={ this.onTransformUpdated }
					preserveDropTransform={ true }>
					<AvSphereHandle radius={ 0.1 } />
					<AvTransform uniformScale={ this.state.highlight == HighlightType.InRange ? 1.1 : 1.0 } >
						{ this.props.modelUri && <AvModel uri={ this.props.modelUri } /> }
					</AvTransform>
				</AvGrabbable>
				{ this.props.children }
			</div>;
	}
}

