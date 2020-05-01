import { AvGadget, AvStandardGrabbable, AvPrimitive, AvLine, PrimitiveYOrigin, PrimitiveZOrigin, PrimitiveType, AvTransform, AvGrabbable, AvModelBoxHandle, AvHook, HookHighlight, HookInteraction, HighlightType } from '@aardvarkxr/aardvark-react';
import { g_builtinModelBox, AvNodeTransform, g_builtinModelCylinder, EndpointAddr, endpointAddrToString, endpointAddrsMatch, AvVector } from '@aardvarkxr/aardvark-shared';
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
	const [ touched, setTouched ] = React.useState( false );
	const [ nodeId, setNodeId ] = React.useState<EndpointAddr>( null );

	let updateHighlight = ( highlightType: HookHighlight, grabbableEpa: EndpointAddr )=>
	{
		if( highlightType == HookHighlight.InRange )
		{
			setTouched( true );

			let ie: IEColorPicker =
			{
				color: props.color
			}

			AvGadget.instance().sendInterfaceEvent( nodeId.nodeId, grabbableEpa, "color-picker@1", ie );
		}
		else
		{
			setTouched( false );
		}
	};

	return <>
			<AvPrimitive type={ PrimitiveType.Cylinder } height={0.1} width={0.07} depth={0.07} 
				originY={ PrimitiveYOrigin.Bottom } color={ props.color }/>
			{ touched && <AvPrimitive type={ PrimitiveType.Cylinder } height={0.005} width={0.075} depth={0.075} 
				originY={ PrimitiveYOrigin.Bottom } color={ "yellow" } />}
			<AvHook updateHighlight={ updateHighlight } xMin={ -0.035 } xMax={0.035 }
				zMin={ -0.035 } zMax={0.035 } yMin={0} yMax={0.1} dropIconUri=""
				interfaces={ { "color-picker@1": null } }
				onIdAssigned={ setNodeId }
				/>
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
	const [ nodeId, setNodeId ] = React.useState<EndpointAddr>( null );

	let onColorPicker = ( sender: EndpointAddr, colorPicker: IEColorPicker ) =>
	{
		console.log( `Setting color to ${ colorPicker.color } from ${ endpointAddrToString( sender ) }` );
		setColor( colorPicker.color );
	};

	let onSurfaceDrawing = ( sender: EndpointAddr, colorPicker: IESurfaceDrawing ) =>
	{
	};

	let onUpdateHighlight =  ( highlightType: HighlightType, handleAddr: EndpointAddr, tethered: boolean,
		interfaceName: string, nearbyHook: EndpointAddr ) =>
	{
		if( highlightType == HighlightType.InHookRange && interfaceName == "surface-drawing@1" )
		{
			AvGadget.instance().sendInterfaceEvent( nodeId.nodeId, nearbyHook, interfaceName, 
				{ color, thickness: props.thickness } as IESurfaceDrawing );
		}	
	}

	const markerRadius = 0.015;
	const markerTipRadius = 0.003;

	return <AvGrabbable preserveDropTransform={ true } onIdAssigned={ setNodeId }
		initialTransform={ { position: { x: props.initialXOffset, y: 0.005, z: 0 } } }
		showGrabIndicator={ false } hookInteraction={ HookInteraction.HighlightOnly }
		persistentName={`${props.initialColor }_marker`} 
		updateHighlight={ onUpdateHighlight }
		interfaces={ 
			{
				"color-picker@1": onColorPicker, 
				"surface-drawing@1": onSurfaceDrawing,
			} }	>
			<AvTransform scaleX={markerRadius} scaleY={ 0.06 } scaleZ={ markerRadius } translateY={ 0.03 }>
				<AvModelBoxHandle uri={ g_builtinModelCylinder } />
			</AvTransform>
			<AvTransform translateY={ markerTipRadius } >
				<AvPrimitive type={PrimitiveType.Cylinder} originY={ PrimitiveYOrigin.Bottom }
					width={markerRadius} depth={markerRadius} height={0.065 } color={ color } />
			</AvTransform>
			<AvPrimitive type={PrimitiveType.Sphere} width={ props.thickness } height={ props.thickness } 
				depth={ props.thickness } color={props.initialColor }/>
		</AvGrabbable>
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


function Surface( props: SurfaceProps )
{
	const [ nodeId, setNodeId ] = React.useState<EndpointAddr>( null );
	const [ contacts, setContacts ] = React.useState<SurfaceContactDetailsMap>({});

	let onSurfaceDrawing = ( markerId: EndpointAddr, surfaceDrawingEvent: IESurfaceDrawing ) =>
	{
		let markerAddrString = endpointAddrToString( markerId );
		console.log( `contact from ${ markerAddrString } started`)
		let newMap = { ...contacts };
		newMap[ markerAddrString ] =
		{
			id: nextStrokeId++,
			color: surfaceDrawingEvent.color,
			thickness: surfaceDrawingEvent.thickness,
			points:[],
		}
		setContacts( newMap );

		AvGadget.instance().sendHapticEvent( markerId, 1, 1, 0)
	};

	let updateHighlight = ( highlightType: HookHighlight, markerEpa: EndpointAddr )=>
	{
		if( highlightType != HookHighlight.InRange )
		{
			console.log( `contact from ${ endpointAddrToString( markerEpa ) } ended`)
			let newMap = { ...contacts };
			let markerAddrString = endpointAddrToString( markerEpa );
			if( newMap[ markerAddrString ] )
			{
				let newStroke = newMap[ markerAddrString ];
				if( newStroke.points.length > 0 )
				{
					props.addStroke( newStroke );
				}
				delete newMap[ endpointAddrToString( markerEpa ) ];
				setContacts( newMap );	
				AvGadget.instance().sendHapticEvent( markerEpa, 0.7, 1, 0)
			}
		}
	};

	let onTransformUpdated = ( grabbableId: EndpointAddr, hookFromGrabbable: AvNodeTransform ) =>
	{
		if( !hookFromGrabbable.position )
			return;

		let markerAddrString = endpointAddrToString( grabbableId );		
		let contact = contacts[ markerAddrString ];
		if( !contact )
			return;

		let newPoint = vec2FromAvTransformPosition( hookFromGrabbable );
		if( contact.points.length > 0 )
		{
			let n1Point = contact.points[ contact.points.length - 1 ];
			let diffN1 = vec2.difference( newPoint, n1Point, new vec2() );
			let distN1 = diffN1.length();
			if( distN1 < 0.005 )
			{
				// require that the marker move at least 5mm to add a point
				return;
			}
		}

		let newMap = { ...contacts };
		newMap[ markerAddrString ].points.push( newPoint );
		setContacts( newMap );
	}

	let strokeLines: JSX.Element[] = [];
	for( let markerId in contacts )
	{
		let markerStroke = contacts[ markerId ];
		if( markerStroke.color && markerStroke.points.length > 0 )
		{
			strokeLines.push( <StrokeLines stroke={ markerStroke } />)
		}
	}

	return <>
		<AvHook xMin={ -0.5 } xMax={0.5 }
			zMin={ -0.03 } zMax={ 0.01 } yMin={ 0 } yMax={ 0.75 } dropIconUri=""
			interfaces={ { "surface-drawing@1": onSurfaceDrawing } }
			onIdAssigned={ setNodeId } updateHighlight={ updateHighlight }
			onTransformUpdated={ onTransformUpdated }/>
		<AvPrimitive type={ PrimitiveType.Cube } originY={ PrimitiveYOrigin.Bottom }
			originZ={ PrimitiveZOrigin.Forward }
			height={ 0.75 } width={ 1.0 } depth={ 0.005 }/>
		{ strokeLines }
		</>
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
			<AvStandardGrabbable modelUri={ g_builtinModelBox } modelScale={ 0.1 } modelColor="lightblue">
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
