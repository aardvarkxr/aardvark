import { AvGadget, AvStandardGrabbable, AvPrimitive, PrimitiveYOrigin, PrimitiveZOrigin, PrimitiveType, AvTransform, AvGrabbable, AvModelBoxHandle, AvHook, HookHighlight, HookInteraction } from '@aardvarkxr/aardvark-react';
import { g_builtinModelBox, AvNodeTransform, g_builtinModelCylinder, EndpointAddr, endpointAddrToString } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as React from 'react';
import * as ReactDOM from 'react-dom';





interface Point
{
	x: number;
	y: number;
}

interface Stroke
{
	id: number;
	points: Point[];
	color: string;
}

interface IEColorPicker
{
	color: string;
}

interface IESurfaceDrawing
{
}


interface WhiteboardState
{
	strokes?: Stroke[];
}

interface WhiteboardSettings
{
	strokes?: Stroke[];
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
}

function Marker( props: MarkerProps )
{
	const [ color, setColor ] = React.useState( props.initialColor );

	let fn = ( parentFromNode: AvNodeTransform, universeFromNode: AvNodeTransform ) =>
	{
		//console.log( "new transform", parentFromNode );
	};

	let onColorPicker = ( sender: EndpointAddr, colorPicker: IEColorPicker ) =>
	{
		console.log( `Setting color to ${ colorPicker.color } from ${ endpointAddrToString( sender ) }` );
		setColor( colorPicker.color );
	};
	let onSurfaceDrawing = ( sender: EndpointAddr, colorPicker: IESurfaceDrawing ) =>
	{
	};

	const markerRadius = 0.015;
	const markerTipRadius = 0.003;

	return <AvGrabbable onTransformUpdated={ fn } preserveDropTransform={ true } 
		initialTransform={ { position: { x: props.initialXOffset, y: 0.005, z: 0 } } }
		showGrabIndicator={ false } hookInteraction={ HookInteraction.HighlightOnly }
		persistentName={`${props.initialColor }_marker`} 
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
			<AvPrimitive type={PrimitiveType.Sphere} width={markerTipRadius} height={markerTipRadius} 
				depth={markerTipRadius} color={props.initialColor }/>
		</AvGrabbable>
}

class Whiteboard extends React.Component< {}, WhiteboardState >
{
	private nextStrokeId = 0;

	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
		};

		AvGadget.instance().registerForSettings( this.onSettingsReceived );
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

		this.setState( { strokes: settings?.strokes } );
	}

	public render()
	{
		return (
			<AvStandardGrabbable modelUri={ g_builtinModelBox } modelScale={ 0.1 } modelColor="lightblue">
				<AvTransform translateY={0.2}>
					<AvPrimitive type={PrimitiveType.Cube} originZ={ PrimitiveZOrigin.Back }
						originY={ PrimitiveYOrigin.Top } height={0.02 } width={1.0} depth={0.10 } 
						color="grey"/>
					<AvPrimitive type={ PrimitiveType.Cube } originY={ PrimitiveYOrigin.Bottom }
						height={ 0.75 } width={ 1.0 } depth={ 0.01 }/>
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

						<Marker initialColor="blue" initialXOffset={-0.450 }/>
						<Marker initialColor="red" initialXOffset={-0.200 }/>
						<Marker initialColor="green" initialXOffset={ 0.050 }/>
						<Marker initialColor="purple" initialXOffset={ 0.300 }/>
					</AvTransform>
				</AvTransform>
			</AvStandardGrabbable>
		)
	}

}

ReactDOM.render( <Whiteboard/>, document.getElementById( "root" ) );
