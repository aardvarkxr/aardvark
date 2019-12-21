import * as React from 'react';
import { AvTransform } from './aardvark_transform';
import bind from 'bind-decorator';
import { AvModel } from './aardvark_model';
import { HighlightType, AvGrabbable, GrabResponse } from './aardvark_grabbable';
import { AvSphereHandle, AvModelBoxHandle } from './aardvark_handles';
import { AvGrabEvent, AvConstraint, AvNodeTransform, AvColor, EndpointAddr, endpointAddrsMatch, g_builtinModelArrow, g_builtinModelSphere } from '@aardvarkxr/aardvark-shared';


interface TranslateArrowProps
{
	color: AvColor;
	highlightColor: AvColor;
	rotateX?: number;
	rotateY?: number;
	rotateZ?: number;
	constraint: AvConstraint;
	centerGap?: number;
	minimized?: boolean;
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
						rotateX={ this.props.rotateX } rotateY={ this.props.rotateY } rotateZ={ this.props.rotateZ }
						uniformScale={ this.props.minimized ? 0.3 : 1.0 }>
						<AvTransform translateY={ this.props.centerGap }>
							<AvModelBoxHandle uri={ g_builtinModelArrow }
								updateHighlight={ this.updateHighlight }
								constraint={ this.props.constraint }/>
							<AvModel uri={ g_builtinModelArrow }
								color={ color }/> }
							{ this.props.children }
						</AvTransform>
					</AvTransform>
				</div>;
	}
}

interface BallHandleProps
{
	color: AvColor | string;
	highlightColor: AvColor | string;
	radius: number;
	minimized?: boolean;
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
		let color: AvColor | string;
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

		let scale = this.props.radius;
		if( this.props.minimized )
		{
			scale *= 0.3;
		}

		return <div>
					<AvTransform uniformScale={ scale }>
							<AvModel uri={ g_builtinModelSphere }
								color={ color }/> }
							{ this.props.children }
					</AvTransform>
					<AvSphereHandle radius={ this.props.radius } updateHighlight={ this.updateHighlight }/>
				</div>;
	}
	
}


interface TransformControlProps
{
	/** The callback is invoked whenever the transform for the control is updated,
	 * which will happen continuously during a grab of any of the control's handles.
	 */
	onSetValue: ( newValue: AvNodeTransform ) => void;

	/** If this prop is true, the transform control will display handles that 
	 * allow the user to apply a scale.
	 * This is not yet implemented.
	 * 
	 * @default false
	 */
	scale?: boolean;

	/** If this prop is true, the transform control will display handles that 
	 * allow the user to apply strict yaw, pitch, and roll rotations.
	 * This is not yet implemented.
	 * 
	 * @default false
	 */
	rotate?: boolean;

	/** If this prop is true, the transform control will display handles that 
	 * allow the user to apply strict X, Y, and Z translations.
	 *
	 * @default false
	 */
	translate?: boolean;

	/** If this prop is true, the transform control will display a handle that
	 * allows the users to apply a general translation and/or rotation.
	 * 
	 * @default false
	 */
	general?: boolean;

	/** The starting transform of the control */
	initialTransform?: AvNodeTransform;

	/** If this prop is true, the control will be shown in a minimized form until 
	 * the user moves a grabber close to it
	 * 
	 * @default false
	 */
	minimizeUntilNearby?: boolean;
}

interface TransformControlState
{
	grabberInRange: boolean;
}

/** Displays a control that allows the user to control the transform of all child nodes.  */
export class AvTransformControl extends React.Component< TransformControlProps, TransformControlState >
{
	constructor( props: any )
	{
		super( props );

		this.state = 
		{ 
			grabberInRange: false,
		};
	}

	@bind onUpdateHighlight( newHighlight: HighlightType, handleAddr: EndpointAddr, tethered: boolean )
	{
		this.setState( { grabberInRange: newHighlight != HighlightType.None } );
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
				key="y"
				color={ { r: 0.8, g: 0, b: 0 } }
				highlightColor={ { r: 1, g: 0, b: 0 } }
				centerGap={ centerGap }
				minimized={ this.props.minimizeUntilNearby && !this.state.grabberInRange }
				constraint= 
				{ {
					minX: 0, maxX: 0,
					minY: -100, maxY: 100,
					minZ: 0, maxZ: 0,
				} } />,
			<AvTranslateArrow 
				key="z"
				rotateX={ -90 }
				color={ { r: 0, g: 0.8, b: 0 } }
				highlightColor={ { r: 0, g: 1, b: 0 } }
				centerGap={ centerGap }
				minimized={ this.props.minimizeUntilNearby && !this.state.grabberInRange }
				constraint= 
				{ {
					minX: 0, maxX: 0,
					minY: 0, maxY: 0,
					minZ: -100, maxZ: 100,
				} } />,
			<AvTranslateArrow 
				key="x"
				rotateZ={ -90 }
				color={ { r: 0, g: 0, b: 0.8 } }
				highlightColor={ { r: 0, g: 0, b: 1 } }
				centerGap={ centerGap }
				minimized={ this.props.minimizeUntilNearby && !this.state.grabberInRange }
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

		return ( <AvBallHandle radius = { 0.02 } color="#999900"
			minimized={ this.props.minimizeUntilNearby && !this.state.grabberInRange }
			highlightColor="#FFFF00" /> )
	}

	public render()
	{
		return (	
			<AvGrabbable onTransformUpdated={ this.onTransformUpdated } 
				preserveDropTransform={ true } initialTransform={ this.props.initialTransform }
				updateHighlight={ this.onUpdateHighlight } >
				{ this.renderTranslate() }
				{ this.renderGeneral() }
				{ this.props.children }
				{ this.props.minimizeUntilNearby &&
					<AvSphereHandle radius={ 0.22 } proximityOnly={ true }/> }
			</AvGrabbable> );
	}
}

