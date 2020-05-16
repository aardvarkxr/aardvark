import { AvGadget, AvStandardGrabbable, AvPrimitive, AvLine, PrimitiveYOrigin, PrimitiveZOrigin, PrimitiveType, AvTransform, AvGrabbable, AvModelBoxHandle, AvHook, HookHighlight, HookInteraction, HighlightType, DropStyle, AvInterfaceEntity, ActiveInterface, MoveableComponent, AvComposedEntity } from '@aardvarkxr/aardvark-react';
import { g_builtinModelBox, AvNodeTransform, g_builtinModelCylinder, EndpointAddr, endpointAddrToString, endpointAddrsMatch, AvVector, EVolumeType, AvVolume } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { vec2 } from '@tlaukkan/tsm';


function vec2FromAvTransformPosition( transform: AvNodeTransform )
{
	if( !transform.position )
		return null;

	return new vec2( [ transform.position.x, transform.position.y ] );
}

interface Stroke
{
	id: number;
	thickness: number;
	points: vec2[];
	color: string;
}

function optimizeStroke( stroke: Stroke )
{
	if( !stroke || stroke.points.length < 3 )
	{
		return 0;
	}

	let pointsRemoved = 0;
	while( true )
	{
		let bestIndex: number;
		let bestError = 99999;

		// Look for points we can slice out of the stroke because 
		// their error is too small to matter
		for( let n = 0; n < stroke.points.length - 2; n++ )
		{
			let distN1 = vec2.distance( stroke.points[n], stroke.points[n + 1] );
			let distN2 = vec2.distance( stroke.points[n], stroke.points[n + 2] );

			let fakeN1 = vec2.mix(stroke.points[n], stroke.points[n+2], distN1/distN2, new vec2() );
			let error = vec2.distance(stroke.points[n+1], fakeN1);
			if( error < bestError )
			{
				bestIndex = n + 1;
				bestError = error;
			}
		}

		if( !bestIndex || bestError > 0.001 )
		{
			break;
		}
		else
		{
			stroke.points.splice( bestIndex, 1 );
			pointsRemoved++;
		}
	}

	return pointsRemoved;
}


interface IEColorPicker
{
	color: string;
}

interface IESurfaceDrawing
{
	color: string;
	thickness: number;
}


interface PaintBucketProps
{
	color: string;
}

function PaintBucket( props: PaintBucketProps )
{
	const [ touched, setTouched ] = React.useState( 0 );

	let onNewColorPicker = ( newPicker: ActiveInterface ) =>
	{
		setTouched( touched + 1 );
		newPicker.onEnded( () => { setTouched( touched - 1 ) } );

		let ie: IEColorPicker =
		{
			color: props.color
		}

		newPicker.sendEvent( ie );
	}

	const k_volume = 
	{ 
		type: EVolumeType.AABB, 
		aabb:
		{
			xMin: -0.035, xMax: 0.035,
			zMin: -0.035, zMax: 0.035,
			yMin: 0, yMax: 0.1,
		}
	};

	return <>
			<AvPrimitive type={ PrimitiveType.Cylinder } height={0.1} width={0.07} depth={0.07} 
				originY={ PrimitiveYOrigin.Bottom } color={ props.color }/>
			{ touched > 0 && <AvPrimitive type={ PrimitiveType.Cylinder } height={0.005} width={0.075} depth={0.075} 
				originY={ PrimitiveYOrigin.Bottom } color={ "yellow" } />}
			<AvInterfaceEntity receives={ [ { iface: "color-picker@1", processor: onNewColorPicker } ]}
				volume={ k_volume } />
		</>
}

interface MarkerProps
{
	initialColor: string;
	initialXOffset: number;
	thickness: number;
}

function Marker( props: MarkerProps )
{
	const [ color, setColor ] = React.useState( props.initialColor );
	const [ moveable, setMoveable ] = React.useState( new MoveableComponent( () => {} ) );

	let onColorPicker = ( activeColorPicker: ActiveInterface ) =>
	{
		activeColorPicker.onEvent( (colorPicker: IEColorPicker ) =>
		{
			console.log( `Setting color to ${ colorPicker.color } from ${ endpointAddrToString( activeColorPicker.peer ) }` );
			setColor( colorPicker.color );
		});
	};

	let onSurfaceDrawing = ( activeSurface: ActiveInterface ) =>
	{
		console.log( "Sending surface-drawing event to board");
		activeSurface.sendEvent( { color, thickness: props.thickness } as IESurfaceDrawing );
	};

	const markerRadius = 0.015;
	const markerTipRadius = 0.003;

	const k_grabVolume =
	{
		type: EVolumeType.AABB,
		aabb: 
		{
			xMin: -markerRadius, xMax: markerRadius,
			zMin: -markerRadius, zMax: markerRadius,
			yMin: 0, yMax: 0.06,	
		}
	} as AvVolume;

	const k_tipVolume =
	{
		type: EVolumeType.Sphere,
		radius: markerTipRadius,
	} as AvVolume;

	return <AvTransform translateX={ props.initialXOffset } translateY={ 0.005 }>
		<AvComposedEntity components={ [ moveable ]} volume={ k_grabVolume }>
			<AvTransform translateY={ markerTipRadius } >
				<AvPrimitive type={PrimitiveType.Cylinder} originY={ PrimitiveYOrigin.Bottom }
					radius={ markerRadius } height={0.065 } color={ color } />
			</AvTransform>
			<AvPrimitive type={PrimitiveType.Sphere} width={ props.thickness } height={ props.thickness } 
				depth={ props.thickness } color={props.initialColor }/>
			<AvInterfaceEntity transmits={
				[
					{ iface: "color-picker@1", processor: onColorPicker },
					{ iface: "surface-drawing@1", processor: onSurfaceDrawing },
				] } volume={ k_tipVolume }/>
			</AvComposedEntity>
		</AvTransform>;
}

interface SurfaceProps
{
	addStroke: ( newStroke: Stroke ) => void;
}

let nextStrokeId = 1;

type SurfaceContactDetailsMap = {[endpointAddr: string]: Stroke };

interface StrokeLineProps
{
	stroke: Stroke;
}

function StrokeLines( props: StrokeLineProps )
{
	if( !props.stroke.color || props.stroke.points.length == 0
		|| props.stroke.thickness <= 0 )
		return null;

	if( props.stroke.points.length == 1 )
	{
		let point = props.stroke.points[0];
		return <AvTransform translateX={ point.x } translateY={ point.y }>
			<AvPrimitive type={ PrimitiveType.Sphere } radius={ props.stroke.thickness / 2 }
				color={ props.stroke.color } />
		</AvTransform>;
	}

	let strokeId = `stroke${ props.stroke.id}`;
	let transforms: JSX.Element[] = [];
	for( let pointIndex = 0; pointIndex < props.stroke.points.length; pointIndex++ )
	{
		let point = props.stroke.points[pointIndex];
		let pointId = `stroke${ props.stroke.id}_${ pointIndex }`;
		transforms.push( <AvTransform translateX={ point.x } translateY={ point.y } 
			id={ pointId } key={ pointId }>
				{ pointIndex > 0 && 
					<AvLine endId={ `stroke${ props.stroke.id}_${ pointIndex - 1 }` }
						key={ "line_" + pointId }
						thickness={ props.stroke.thickness } color={ props.stroke.color }/> }
			</AvTransform> )
	}

	return <div key={ strokeId }>{ transforms } </div>;
}

interface SurfaceState
{
	strokesInProgress: Stroke[];
}

class Surface extends React.Component<SurfaceProps, SurfaceState>
{
	constructor( props: any )
	{
		super( props );

		this.state = { strokesInProgress: [] };
	}

	@bind
	private onSurfaceDrawing( activeContact: ActiveInterface )
	{
		let stroke: Stroke;

		activeContact.onEvent( ( surfaceDrawingEvent: IESurfaceDrawing ) =>
		{
			let markerAddrString = endpointAddrToString( activeContact.peer );
			console.log( `contact from ${ markerAddrString } started`)
			stroke =
			{
				id: nextStrokeId++,
				color: surfaceDrawingEvent.color,
				thickness: surfaceDrawingEvent.thickness,
				points:[],
			}
	
			AvGadget.instance().sendHapticEvent( activeContact.peer, 1, 1, 0)

			this.setState( { strokesInProgress: [ ...this.state.strokesInProgress, stroke ] } );
		} );
	
		activeContact.onEnded( ()=>
		{
			console.log( `contact from ${ endpointAddrToString( activeContact.peer ) } ended`)
			if( stroke && stroke.points.length > 0 )
			{
				this.props.addStroke( stroke );
			}

			if( stroke )
			{
				let newStrokes = [ ...this.state.strokesInProgress ];
				let i = newStrokes.indexOf( stroke );
				newStrokes.splice( i, 1 );
				this.setState( { strokesInProgress: newStrokes } );
			}

			AvGadget.instance().sendHapticEvent( activeContact.peer, 0.7, 1, 0)
		} );
	
		activeContact.onTransformUpdated( ( surfaceFromMarker: AvNodeTransform ) =>
		{
			if( !stroke )
				return;

			let newPoint = vec2FromAvTransformPosition( surfaceFromMarker );
			if( stroke.points.length > 0 )
			{
				let n1Point = stroke.points[ stroke.points.length - 1 ];
				let diffN1 = vec2.difference( newPoint, n1Point, new vec2() );
				let distN1 = diffN1.length();
				if( distN1 < 0.005 )
				{
					// require that the marker move at least 5mm to add a point
					return;
				}
			}

			stroke.points.push( newPoint );

			this.forceUpdate();
		} );
	}

	render()
	{
		let strokeLines: JSX.Element[] = [];
		for( let markerStroke of this.state.strokesInProgress )
		{
			if( markerStroke.color && markerStroke.points.length > 0 )
			{
				strokeLines.push( <StrokeLines stroke={ markerStroke } />)
			}
		}
	
		const k_boardVolume =
		{
			type: EVolumeType.AABB,
			aabb:
			{
				xMin: -0.5, xMax: 0.5,
				yMin: 0, yMax: 1.0,
				zMin: -0.03, zMax: 0.01,	
			}
		} as AvVolume;
	
		return <>
			<AvInterfaceEntity receives={ [ { iface: "surface-drawing@1", processor: this.onSurfaceDrawing } ] }
				volume={ k_boardVolume } wantsTransforms={ true }/>
			<AvPrimitive type={ PrimitiveType.Cube } originY={ PrimitiveYOrigin.Bottom }
				originZ={ PrimitiveZOrigin.Forward }
				height={ 0.75 } width={ 1.0 } depth={ 0.005 }/>
			{ strokeLines }
			</>
	
	}
}

interface WhiteboardState
{
	strokes?: Stroke[];
}

interface WhiteboardSettings
{
	strokes?: Stroke[];
}

class Whiteboard extends React.Component< {}, WhiteboardState >
{
	private nextStrokeId = 0;

	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
			strokes: []
		};

		AvGadget.instance().registerForSettings( this.onSettingsReceived );
	}

	@bind
	private onAddStroke( newStroke: Stroke )
	{
		let removed = optimizeStroke( newStroke );
		console.log( `Adding stroke. Optimized away ${ removed } points. ${ newStroke.points.length } remain` );
		this.setState( { strokes: [...this.state.strokes, newStroke ] } );
	}

	public componentDidMount()
	{
	}

	public componentWillUnmount()
	{
	}


	@bind public onSettingsReceived( settings: WhiteboardSettings )
	{
		if( settings && settings.strokes )
		{
			for( let stroke of settings.strokes )
			{
				this.nextStrokeId = Math.max( stroke.id + 1, this.nextStrokeId );
			}
		}

		//this.setState( { strokes: settings?.strokes } );
	}

	public render()
	{
		let strokeLines: JSX.Element[] = [];
		for( let stroke of this.state.strokes )
		{
			strokeLines.push( <StrokeLines stroke={ stroke }/> );
		}

		return (
			<AvStandardGrabbable modelUri={ g_builtinModelBox } modelScale={ 0.1 } 
				modelColor="lightblue" useInitialParent={ true } remoteInterfaceLocks={ [] }>
				<AvTransform translateY={0.2}>
					<AvTransform translateZ={ -0.005 }>
						<AvPrimitive type={PrimitiveType.Cube} originZ={ PrimitiveZOrigin.Back }
							originY={ PrimitiveYOrigin.Top } height={0.02 } width={1.0} depth={0.10 } 
							color="grey"/>
					</AvTransform>
					<Surface addStroke={ this.onAddStroke } />
					{ strokeLines }
					<AvTransform translateZ={ 0.06 } persistentName="traycontents">
						<AvTransform translateX={ -0.375 } persistentName="bluebucket" >
							<PaintBucket color="blue"/>
						</AvTransform>
						<AvTransform translateX={ -0.125 }  persistentName="redbucket">
							<PaintBucket color="red"/>
						</AvTransform>
						<AvTransform translateX={ 0.125 } persistentName="greenbucket">
							<PaintBucket color="green"/>
						</AvTransform>
						<AvTransform translateX={ 0.375 } persistentName="purplebucket">
							<PaintBucket color="purple"/>
						</AvTransform>

						<Marker initialColor="blue" initialXOffset={-0.450 } thickness={ 0.003 }/>
						<Marker initialColor="red" initialXOffset={-0.200 } thickness={ 0.003 }/>
						<Marker initialColor="green" initialXOffset={ 0.050 } thickness={ 0.006 }/>
						<Marker initialColor="purple" initialXOffset={ 0.300 } thickness={ 0.009 }/>
					</AvTransform>
				</AvTransform>
			</AvStandardGrabbable>
		)
	}

}

ReactDOM.render( <Whiteboard/>, document.getElementById( "root" ) );
