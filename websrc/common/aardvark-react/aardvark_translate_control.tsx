import * as React from 'react';
import { AvTransform } from 'common/aardvark-react/aardvark_transform';
import bind from 'bind-decorator';
import { AvModel } from 'common/aardvark-react/aardvark_model';
import { HighlightType, AvGrabbable, GrabResponse } from './aardvark_grabbable';
import { AvSphereHandle, AvModelBoxHandle } from './aardvark_handles';
import { AvGrabEvent, AvConstraint, AvNodeTransform, AvColor } from 'common/aardvark';


interface TranslateArrowProps
{
	color: AvColor;
	highlightColor: AvColor;
	rotateX?: number;
	rotateY?: number;
	rotateZ?: number;
}

interface TranslateArrowState
{
	highlight: HighlightType;
}

class AvTranslateArrow extends React.Component< TranslateArrowProps, TranslateArrowState >
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
	
	public render()
	{
		let constraint: AvConstraint = 
		{
			minX: 0, maxX: 0,
			minY: -100, maxY: 100,
			minZ: 0, maxZ: 0,
		}

		let color: AvColor;
		switch( this.state.highlight )
		{
			case HighlightType.Grabbed:
			case HighlightType.InRange:
			case HighlightType.InHookRange:
				color = this.props.highlightColor;
				break;
			default:
			case HighlightType.None:
				color = this.props.color;
				break;
		}

		return <div>
					<AvModelBoxHandle uri="http://aardvark.install/models/arrow.glb" 
						updateHighlight={ this.updateHighlight }
						constraint={ constraint }/>
					<AvTransform 
						rotateX={ this.props.rotateX } rotateY={ this.props.rotateY } rotateZ={ this.props.rotateZ }>
						<AvModel uri={ "http://aardvark.install/models/arrow.glb" }
							color={ color }/> }
					</AvTransform>
					{ this.props.children }
				</div>;
	}
}


interface TranslateControlProps
{
	onSetValue: ( newValue: number[] ) => void;
}

interface TranslateControlState
{
	highlight: HighlightType;
}

function clamp( n: number, min: number, max: number ): number
{
	return Math.min( max, Math.max( min, n ) );
}

export class AvTranslateControl extends React.Component< TranslateControlProps, TranslateControlState >
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
//		this.props.onUpdateValue( parentFromNode.position.y );
	}

	public render()
	{
		return (	
			<AvGrabbable onTransformUpdated={ this.onTransformUpdated } 
				preserveDropTransform={ true }>
				<AvTranslateArrow 
					color={ { r: 0.8, g: 0, b: 0 } }
					highlightColor={ { r: 1, g: 0, b: 0 } }/>
				<AvTranslateArrow 
					rotateX={ -90 }
					color={ { r: 0, g: 0.8, b: 0 } }
					highlightColor={ { r: 0, g: 1, b: 0 } }/>
				<AvTranslateArrow 
					rotateZ={ -90 }
					color={ { r: 0, g: 0, b: 0.8 } }
					highlightColor={ { r: 0, g: 0, b: 1 } }/>
				{ this.props.children }
			</AvGrabbable> );
	}
}

