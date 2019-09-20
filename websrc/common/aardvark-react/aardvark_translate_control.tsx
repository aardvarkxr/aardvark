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
	constraint: AvConstraint;
	centerGap?: number;
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
					<AvTransform 
						rotateX={ this.props.rotateX } rotateY={ this.props.rotateY } rotateZ={ this.props.rotateZ }>
						<AvTransform translateY={ this.props.centerGap }>
							<AvModelBoxHandle uri="http://aardvark.install/models/arrow.glb" 
								updateHighlight={ this.updateHighlight }
								constraint={ this.props.constraint }/>
							<AvModel uri={ "http://aardvark.install/models/arrow.glb" }
								color={ color }/> }
							{ this.props.children }
						</AvTransform>
					</AvTransform>
				</div>;
	}
}

interface BallHandleProps
{
	color: AvColor;
	highlightColor: AvColor;
	radius: number;
}

interface BallHandleState
{
	highlight: HighlightType;
}

class AvBallHandle extends React.Component< BallHandleProps, BallHandleState >
{
	constructor( props: any )
	{
		super( props );
		this.state = { highlight: HighlightType.None };
	}

	@bind updateHighlight( newHighlight: HighlightType )
	{
		this.setState( { highlight: newHighlight } );
	}
	
	public render()
	{
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
					<AvTransform uniformScale={ this.props.radius }>
							<AvModel uri={ "http://aardvark.install/models/sphere/sphere.glb" }
								color={ color }/> }
							{ this.props.children }
					</AvTransform>
					<AvSphereHandle radius={ this.props.radius } />
				</div>;
	}
	
}


interface TransformControlProps
{
	onSetValue: ( newValue: AvNodeTransform ) => void;
	scale?: boolean;
	rotate?: boolean;
	translate?: boolean;
	general?: boolean;
}

interface TransformControlState
{
}

export class AvTransformControl extends React.Component< TransformControlProps, TransformControlState >
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
		if( this.props.onSetValue )
		{
			this.props.onSetValue( parentFromNode );
		}
	}

	private renderTranslate(): JSX.Element[]
	{
		if( !this.props.translate )
			return null;

		let centerGap = this.props.general ? 0.04 : 0;
		return (
		[
			<AvTranslateArrow 
				color={ { r: 0.8, g: 0, b: 0 } }
				highlightColor={ { r: 1, g: 0, b: 0 } }
				centerGap={ centerGap }
				constraint= 
				{ {
					minX: 0, maxX: 0,
					minY: -100, maxY: 100,
					minZ: 0, maxZ: 0,
				} } />,
			<AvTranslateArrow 
				rotateX={ -90 }
				color={ { r: 0, g: 0.8, b: 0 } }
				highlightColor={ { r: 0, g: 1, b: 0 } }
				centerGap={ centerGap }
				constraint= 
				{ {
					minX: 0, maxX: 0,
					minY: 0, maxY: 0,
					minZ: -100, maxZ: 100,
				} } />,
			<AvTranslateArrow 
				rotateZ={ -90 }
				color={ { r: 0, g: 0, b: 0.8 } }
				highlightColor={ { r: 0, g: 0, b: 1 } }
				centerGap={ centerGap }
				constraint= 
				{ {
					minX: -100, maxX: 100,
					minY: 0, maxY: 0,
					minZ: 0, maxZ: 0,
				} } />,
		] );
	}

	private renderGeneral()
	{
		if( !this.props.general )
			return null;

		return ( <AvBallHandle radius = { 0.04 } color={ {r: 0.8, g: 0.8, b: 0 } }
			highlightColor={ { r: 1, g: 1, b: 0 }} /> )
	}

	public render()
	{
		return (	
			<AvGrabbable onTransformUpdated={ this.onTransformUpdated } 
				preserveDropTransform={ true }>
				{ this.renderTranslate() }
				{ this.renderGeneral() }
				{ this.props.children }
			</AvGrabbable> );
	}
}

