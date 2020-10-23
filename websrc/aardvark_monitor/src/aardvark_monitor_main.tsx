import { DegreesToRadians, EulerAnglesToQuaternion, QuaternionToEulerAngles, RadiansToDegrees } from '@aardvarkxr/aardvark-react';
import { AardvarkManifest, AvNode, AvNodeTransform, AvNodeType, AvQuaternion, AvVector, AvVolume, EndpointAddr, nodeTransformToMat4, endpointAddrToString, EndpointType, ENodeFlags, EVolumeType, InitialInterfaceLock, MessageType, MsgOverrideTransform, MsgResourceLoadFailed, EVolumeContext } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import { observer } from 'mobx-react';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { vec4 } from '@tlaukkan/tsm';
import { CMonitorStore } from 'common/monitor_store';

interface SpinnerProps
{
	onUpdatedValue: (value: number) => void;
	initialValue: number;
	step: number;
	min: number;
	max: number;
}

interface SpinnerState
{
	value: number;
}

class Spinner extends React.Component< SpinnerProps, SpinnerState >
{
	constructor( props: any )
	{
		super( props );
		this.state = { value: this.props.initialValue };
	}

	public componentDidUpdate( prevProps: SpinnerProps, prevState: SpinnerState )
	{
		if( prevProps.initialValue == prevState.value && this.props.initialValue != prevProps.initialValue )
		{
			// if we haven't changed the value, but our initial value has changed, update the state
			this.setState( { value: this.props.initialValue } );
		}
	}

	@bind onClickUp( event: React.MouseEvent )
	{
		event.preventDefault();
		event.persist();
		this.setState( ( prev: SpinnerState ) => 
			{ 
				let step = event.shiftKey ? this.props.step * 10 : this.props.step;
				let value = Math.min( prev.value + step, this.props.max );
				this.props.onUpdatedValue( value );
				return { value };
			} );
	}

	@bind onClickDown( event: React.MouseEvent )
	{
		event.preventDefault();
		event.persist();
		this.setState( ( prev: SpinnerState ) => 
			{ 
				let step = event.shiftKey ? this.props.step * 10 : this.props.step;
				let value = Math.max( prev.value - step, this.props.min );
				this.props.onUpdatedValue( value );
				return { value };
			} );
	}
	
	render()
	{
		return <div className="Spinner">
			<div className="SpinnerValue">{ this.state.value.toFixed( 2 ) }</div>
			<div className="SpinnerControls">
				<div className="SpinnerButton" onClick={ this.onClickUp }>
					<svg>    
						<path d="M 0,16 8,0 16,16 Z" />
					</svg>
				</div>
				<div className="SpinnerButton" onClick={ this.onClickDown }>
					<svg>    
						<path d="M 0,0 16,0 8,16 Z" />
					</svg>
				</div>
			</div>
		</div>
	}
}


interface TransformMonitorProps
{
	nodeId: EndpointAddr;
}

interface TransformMonitorState
{
	currentTransform?: AvNodeTransform;
}

enum VectorType
{
	Translation,
	Scale,
	Rotation,
}

function copyTransform( src: AvNodeTransform): AvNodeTransform
{
	// TODO: Maybe make this not stupid
	return JSON.parse( JSON.stringify( src ) ) as AvNodeTransform;
}

@observer 
class TransformMonitor extends React.Component< TransformMonitorProps, TransformMonitorState >
{
	private m_inputCopyRef = React.createRef<HTMLInputElement>();

	constructor( props: any )
	{
		super( props )
		this.state = {};
	}

	@bind private onCopy()
	{
		let transform = this.transform;
		let props:{ [key:string]: number } = {};

		if( transform.position )
		{
			if( transform.position.x != 0 )
			{
				props[ "positionX" ] = transform.position.x;
			}
			if( transform.position.y != 0 )
			{
				props[ "positionY" ] = transform.position.y;
			}
			if( transform.position.z != 0 )
			{
				props[ "positionZ" ] = transform.position.z;
			}
		}

		if( transform.scale )
		{
			if( transform.scale.x == transform.scale.y && transform.scale.x == transform.scale.z 
				&& transform.scale.x != 1 )
			{
				props[ "uniformScale" ] = transform.scale.x;
			}
			else
			{
				if( transform.scale.x != 1 )
				{
					props[ "scaleX" ] = transform.scale.x;
				}
				if( transform.scale.y != 1 )
				{
					props[ "scaleY" ] = transform.scale.y;
				}
				if( transform.scale.z != 1 )
				{
					props[ "scaleZ" ] = transform.scale.z;
				}
			}
		}

		if( transform.rotation )
		{
			let angles = QuaternionToEulerAngles( transform.rotation );
			if( angles.yaw )
			{
				props[ "rotateY" ] = 180 * angles.yaw / Math.PI;
			}
			if( angles.roll )
			{
				props[ "rotateZ" ] = 180 * angles.roll / Math.PI;
			}
			if( angles.pitch )
			{
				props[ "rotateX" ] = 180 * angles.pitch / Math.PI;
			}
		}

		let transformString = "<AvTransform";
		for( let key in props )
		{
			transformString += ` ${key}={ ${ props[ key ].toFixed( 3 ) } }`;
		}
		transformString += " >";

		this.m_inputCopyRef.current.value = transformString;
		this.m_inputCopyRef.current.select();
		document.execCommand( 'copy' );
	}


	private renderQuaternion( name: string, q: AvQuaternion )
	{
		if( !q && !this.state.currentTransform )
			return null;

		let angles = QuaternionToEulerAngles( q );
		let v = 
		{ 
			x: RadiansToDegrees( angles.pitch ), 
			y: RadiansToDegrees( angles.yaw ), 
			z: RadiansToDegrees( angles.roll ),
		};

		return this.renderVector( "Rotation", v, VectorType.Rotation,
			( which: string, value: number ) =>
			{
				let newTransform = copyTransform( this.transform );
				let rot = newTransform.rotation;
				if( !rot )
				{
					rot = { x: 0, y: 0, z: 0, w: 1 };
				}

				let angles = QuaternionToEulerAngles( rot );
				switch( which )
				{
					case "x": 
						angles.pitch = DegreesToRadians( value );
						break;

					case "y": 
						angles.yaw = DegreesToRadians( value );
						break;

					case "z": 
						angles.roll = DegreesToRadians( value );
						break;
				}

				newTransform.rotation = EulerAnglesToQuaternion( angles );
				this.setState( { currentTransform: newTransform } );
				this.overrideTransform( newTransform );
			}
		);
	}

	private renderVector( name: string, vector: AvVector, type: VectorType, 
		onUpdateVector: ( which: string, value: number ) => void )
	{
		let min:number, max: number, step: number;
		switch( type )
		{
			case VectorType.Rotation:
				if( !vector )
				{
					vector = { x: 0, y: 0, z: 0 };
				}
				min = -180;
				max = 180;
				step = 1;
				break;

			case VectorType.Translation:
				if( !vector )
				{
					vector = { x: 0, y: 0, z: 0 };
				}
				min = -2;
				max = 2;
				step = 0.005;
				break;

			case VectorType.Scale:
				if( !vector )
				{
					vector = { x: 1, y: 1, z: 1 };
				}
				min = 0.01;
				max = 2;
				step = 0.005;
				break;
		}


		return <div className="AvNodeProperty">
			<div className="AvNodePropertyName">{name}</div> 
			<div className="AvNodePropertyValue">
				<Spinner min={ min } max={ max } step={ step } initialValue={ vector.x }
					onUpdatedValue={ ( value: number ) => { onUpdateVector( "x", value ); } }/>
				<Spinner min={ min } max={ max } step={ step } initialValue={ vector.y }
					onUpdatedValue={ ( value: number ) => { onUpdateVector( "y", value ); } }/>
				<Spinner min={ min } max={ max } step={ step } initialValue={ vector.z }
					onUpdatedValue={ ( value: number ) => { onUpdateVector( "z", value ); } }/>
			</div>
		</div>;
	}

	private get transform(): AvNodeTransform
	{
		if( this.state.currentTransform )
		{
			return this.state.currentTransform;
		}
		else
		{
			let node = MonitorStore.getNodeData( this.props.nodeId );
			return node.propTransform;
		}
	}

	private overrideTransform( newTransform: AvNodeTransform )
	{
		this.setState( { currentTransform: newTransform } );

		let m: MsgOverrideTransform =
		{
			nodeId: this.props.nodeId,
			transform: this.transform,
		};
		MonitorStore.sendMessage( MessageType.OverrideTransform, m );
	}

	@bind private updateUniformScale( value: number )
	{
		let newTransform = copyTransform( this.transform );
		newTransform.scale = 
		{
			x: value,
			y: value,
			z: value,
		}
		this.overrideTransform( newTransform );
	}

	private renderScale( name: string, scale: AvVector )
	{
		if( scale && scale.x != null && scale.x == scale.y && scale.x == scale.z )
		{
			return <div className="AvNodeProperty">
					<div className="AvNodePropertyName">Uniform Scale:</div> 
					<div className="AvNodePropertyValue">
						<Spinner min={ 0.01 } max={ 2 } step={ 0.01 } initialValue={ scale.x }
							onUpdatedValue={ this.updateUniformScale }/>
					</div>
				</div>;
		}
		else
		{
			return this.renderVector( name, scale, VectorType.Scale, 
				( which: string, value: number ) =>
				{
					let newTransform = copyTransform( this.transform );
					if( !newTransform.scale )
					{
						newTransform.scale = { x: 1, y: 1, z: 1 };
					}
					switch( which )
					{
						case "x": 
							newTransform.scale.x = value;
							break;

						case "y": 
							newTransform.scale.y = value;
							break;

						case "z": 
							newTransform.scale.z = value;
							break;
					}

					this.transform.scale = scale;
					this.overrideTransform( newTransform );
				} );
		}
	}

	private renderTransform( transform: AvNodeTransform )
	{
		if( !transform )
		{
			return null;
		}

		return <div>
				{ this.renderVector( "translation", transform.position, VectorType.Translation, 
					( which: string, value: number ) =>
					{
						let newTransform = copyTransform( this.transform );
						let translation = newTransform.position;
						if( !translation )
						{
							translation = { x: 0, y: 0, z: 0 };
						}

						switch( which )
						{
							case "x": 
								translation.x = value;
								break;

							case "y": 
								translation.y = value;
								break;

							case "z": 
								translation.z = value;
								break;
						}
						newTransform.position = translation;

						this.overrideTransform( newTransform );
					} ) }

				{ this.renderScale( "scale", transform.scale ) }
				{ this.renderQuaternion( "rotation", transform.rotation ) }
				{ this.state.currentTransform && 
					<div>
						<div className="TransformCopyButton" onClick={ this.onCopy }>Copy Transform</div>
						<input type="text" className="TransformCopyInput" ref={ this.m_inputCopyRef }/>
					</div> 
				}
			</div>;
	}

	render()
	{
		let node = MonitorStore.getNodeData( this.props.nodeId );
		if( !node )
			return null;

		return this.renderTransform( this.transform );
	}
}


interface GadgetMonitorProps
{
	gadgetId: number;
}

interface GadgetMonitorState
{
	manifest: AardvarkManifest;
	expanded: boolean;
}

@observer
class GadgetMonitor extends React.Component< GadgetMonitorProps, GadgetMonitorState >
{
	constructor( props: any )
	{
		super( props );
		this.state = { manifest: null, expanded: false };

		let gadgetData = MonitorStore.getGadgetData( this.props.gadgetId );
		MonitorStore.getConnection().getGadgetManifest( gadgetData.gadgetUri )
		.then( ( manifest: AardvarkManifest ) =>
		{
			this.setState( { manifest });
		});
	}

	@bind
	private onToggleExpand(	)
	{
		this.setState( ( prevState: GadgetMonitorState ) => { return { expanded: !prevState.expanded } } );
	}

	private renderFlags( flags: number )
	{
		if( !flags )
			return null;
	
		let flagNames = [];
		for( let bit = 0; bit < 32; bit++ )
		{
			if( 0 != ( flags & ( 1 << bit ) ) )
			{
				flagNames.push( ENodeFlags[ 1 << bit ] );
			}
		}

		return <div>Flags: { flagNames.join( ' ' ) } </div>;
	}

	public renderVolume( volume: AvVolume ): JSX.Element
	{
		if( !volume )
			return null;

		let contextName = "";
		switch( volume.context ?? EVolumeContext.Always )
		{
			case EVolumeContext.ContinueOnly:
				contextName= "(Con't)";
				break;

			case EVolumeContext.StartOnly:
				contextName= "(Start)";
				break;
		}

		if( volume.scale )
		{
			contextName += `[Scale=${ volume.scale.toFixed( 1 ) }]`;
		}
		
		switch( volume.type )
		{
			case EVolumeType.Sphere:
				return <div className="AvNodeProperty">volume{ contextName }: radius={volume.radius }</div>;

			case EVolumeType.AABB:
			case EVolumeType.ModelBox:
				if( volume.uri )
					return <div className="AvNodeProperty">volume{ contextName }: model box={ volume.uri }</div>;
				else
					return <div className="AvNodeProperty">volume{ contextName }: AABB({ JSON.stringify( volume.aabb ) } )</div>;

			case EVolumeType.Infinite:
				return <div className="AvNodeProperty">volume{ contextName }: infinite</div>;

			case EVolumeType.Empty:
				return <div className="AvNodeProperty">volume{ contextName }: empty</div>;
			
			case EVolumeType.Ray:
				{
					let matRay = nodeTransformToMat4( volume.nodeFromVolume );
					let start = matRay.multiplyVec4( new vec4( [ 0, 0, 0, 1 ] ) )
					let dir = matRay.multiplyVec4( new vec4( [ 1, 0, 0, 0 ] ) )
					return <div className="AvNodeProperty">volume{ contextName }: Ray( 
						{ start.x.toFixed( 3 ) }, { start.y.toFixed( 3 ) }, { start.z.toFixed( 3 ) } -&gt;
						{ dir.x.toFixed( 3 ) }, { dir.y.toFixed( 3 ) }, { dir.z.toFixed( 3 ) }</div>
				}

			default:
				return <div className="AvNodeProperty">volume: Unknown/invalid</div>;
		}
	}

	public renderInitialInterfaceLocks( interfaceLocks: InitialInterfaceLock[] ): JSX.Element
	{
		if( !interfaceLocks || !interfaceLocks.length )
		{
			return null;
		}

		return <div className="AvNodeProperty">Interface Locks: 
				{ interfaceLocks.map( ( value ) => (
					<div> { value.iface } -&gt; { MonitorStore.epaDisplayText( value.receiver ) } 
						{ value.params ? JSON.stringify( value.params ) : "" }
					</div> ) ) }
			</div>;
	}

	public renderNode( node: AvNode ): JSX.Element
	{
		if( !node )
			return null;

		let childElements: JSX.Element[] = [];
		if( node.children )
		{
			for( let child of node.children )
			{
				let childElement = this.renderNode( child );
				if( childElement )
					childElements.push( childElement );
			}	
		}

		return <div className="AvNode" key={node.id }>
			<div className="AvNodeType">{AvNodeType[ node.type ] } @{ node.id }
				<div className="AvNodeName">{ MonitorStore.epaDisplayText( node.globalId ) }</div>
				{ this.renderFlags( node.flags ) } 
			</div>
			{ node.propUniverseName && <div className="AvNodeProperty">remote: {node.propUniverseName }</div> }
			{ node.propOrigin && <div className="AvNodeProperty">origin: {node.propOrigin }</div> }
			{ node.propModelUri && <div className="AvNodeProperty">model: {node.propModelUri }</div> }
			{ node.propColor && <div className="AvNodeProperty">Color: 
				{ node.propColor.r.toFixed( 2 ) },
				{ node.propColor.g.toFixed( 2 ) },
				{ node.propColor.b.toFixed( 2 ) }
				{ node.propColor.r != undefined && ( ", " + node.propColor.a ) }
				</div> }
			{ this.renderVolume( node.propVolume ) }
			{ node.propVolumes &&
				node.propVolumes.map( ( volume ) => this.renderVolume( volume ) ) }
			{ node.propInteractive && <div className="AvNodeProperty">Interactive</div> }
			{ node.propConstraint && <div className="AvNodeProperty">Constraint: 
				{ node.propConstraint.gravityAligned && "Gravity Aligned " }
				[ { node.propConstraint.minX ?? Number.NEGATIVE_INFINITY }, 
					{node.propConstraint.maxX ?? Number.POSITIVE_INFINITY } ]
				[ { node.propConstraint.minY ?? Number.NEGATIVE_INFINITY }, 
					{node.propConstraint.maxY ?? Number.POSITIVE_INFINITY } ]
				[ { node.propConstraint.minZ ?? Number.NEGATIVE_INFINITY }, 
					{node.propConstraint.maxZ ?? Number.POSITIVE_INFINITY } ]
				</div> }
			{ node.propSharedTexture && <div className="AvNodeProperty">{ JSON.stringify( node.propSharedTexture ) }</div> }
			{ node.propTransform && <TransformMonitor 
				nodeId={ { type: EndpointType.Node, endpointId: this.props.gadgetId, nodeId: node.id } } /> }
			{ node.propInterfaces 
				&& <div className="AvNodeProperty">Interfaces: { node.propInterfaces.join( ", " ) }</div> }
			{ node.propTransmits && node.propTransmits.length > 0
				&& <div className="AvNodeProperty">Transmits: { node.propTransmits.join( ", " ) }</div> }
			{ node.propReceives && node.propReceives.length > 0
				&& <div className="AvNodeProperty">Receives: { node.propReceives.join( ", " ) }</div> }
			{ this.renderInitialInterfaceLocks( node.propInterfaceLocks ) }
			{ node.propParentAddr 
				&& <div className="AvNodeProperty">Parent: { MonitorStore.epaDisplayText( node.propParentAddr ) }</div> }
			{ node.propChildAddr 
				&& <div className="AvNodeProperty">Child: { MonitorStore.epaDisplayText( node.propChildAddr ) }</div> }
			{ childElements }
		</div>
	}

	public render()
	{
		let gadgetData = MonitorStore.getGadgetData( this.props.gadgetId );

		let sGadgetClasses="Gadget";

		return <div className={ sGadgetClasses }>
			{ this.props.gadgetId }: 
			<div className="GadgetName" onClick={ this.onToggleExpand }>
				{ this.state.manifest ? this.state.manifest.name : "???" } 
				<span className="GadgetUri">({ gadgetData.gadgetUri })</span>
			</div>
			{ this.state.expanded && this.renderNode( gadgetData.gadgetRoot ) }

		</div>
	}
}

interface RendererMonitorProps
{
	rendererId: number;
}

interface RendererMonitorState
{

}

@observer
class RendererMonitor extends React.Component< RendererMonitorProps, RendererMonitorState >
{
	constructor( props: any )
	{
		super( props );
		this.state = {};
	}

	public render()
	{
		return <div className="Renderer">Renderer { this.props.rendererId }</div>
	}
}

interface GrabEventProps
{
	event: MsgResourceLoadFailed;
}


class GrabEventMonitor extends React.Component< GrabEventProps, {} >
{
	constructor( props: any )
	{
		super( props );
	}

	private renderAddr( label: string, epa: EndpointAddr )
	{
		return <div className="GrabEventField">
			{ label } :
			{ epa && MonitorStore.epaDisplayText( epa ) }
		</div>
	}


	public render()
	{
		let m = this.props.event as MsgResourceLoadFailed;
		return ( <div className="ResourceLoadFailed">
			<div className="NodeAddr">Node: { MonitorStore.epaDisplayText( m.nodeId ) }</div>
			<div className="FailedUri">URI: { m.resourceUri } </div>
			<div className="Error">{ m.error } </div>
		</div> );
	}
}




interface AardvarkMonitorState
{
}

@observer
class AardvarkMonitor extends React.Component< {}, AardvarkMonitorState >
{

	constructor( props: any )
	{
		super( props );
	}

	public render()
	{
		let endpoints: JSX.Element[] = [];
		for( let epid of MonitorStore.m_endpoints.keys() )
		{
			let ep = MonitorStore.m_endpoints.get( epid );
			switch( ep.type )
			{
				case EndpointType.Gadget:
					endpoints.push( <GadgetMonitor key={ epid }
						gadgetId={ epid } 
						/> );
					break;
				case EndpointType.Renderer:
					endpoints.push( <RendererMonitor  key={ epid } rendererId={ epid } /> );
					break;
			}
		}

		let events: JSX.Element[] = [];
		let eventKey = 0;
		for( let event of MonitorStore.recentGrabEvents )
		{
			events.push( <GrabEventMonitor event = {event } key={ eventKey++ }/>)
		}

		if( endpoints.length == 0 && events.length == 0)
		{
			return <div>Nothing connected yet.</div>;
		}
		else
		{
			return <div className="MonitorContainer">
				<div className="EndpointList">{ endpoints }</div>
				<div className="EventList">{ events }</div>
			</div>;
		}
	}
}

let MonitorStore = new CMonitorStore();
ReactDOM.render( <AardvarkMonitor/>, document.getElementById( "root" ) );

