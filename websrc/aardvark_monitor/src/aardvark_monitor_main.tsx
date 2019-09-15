import * as React from 'react';
import  * as ReactDOM from 'react-dom';
import { CMonitorEndpoint } from 'common/aardvark-react/aardvark_endpoint';
import { EndpointType, MessageType, EndpointAddr, MsgNewEndpoint, MsgLostEndpoint, MsgUpdateSceneGraph, MsgGrabberState, endpointAddrToString, MsgGrabEvent, MsgPokerProximity, MsgOverrideTransform } from 'common/aardvark-react/aardvark_protocol';
import bind from 'bind-decorator';
import { AvGadgetManifest, AvNode, AvNodeType, AvNodeTransform, AvVector, AvQuaternion, AvGrabEvent, AvGrabEventType } from 'common/aardvark';
import { observable, ObservableMap, action, observe, computed } from 'mobx';
import { observer } from 'mobx-react';
import { AvTransform } from 'common/aardvark-react/aardvark_transform';
import { quat, vec3 } from '@tlaukkan/tsm';

interface EndpointData
{
	id: number;
	type: EndpointType;
}

interface GadgetData extends EndpointData
{
	gadgetUri?: string;
	gadgetRoot?: AvNode;
	gadgetHook?: string | EndpointAddr;
	grabberIsPressed?: boolean;
	grabbables?: EndpointAddr[];
	hooks?: EndpointAddr[];
	nodes?: { [ nodeId: number]: AvNode };
}

class CMonitorStore
{
	private m_connection: CMonitorEndpoint;
	@observable m_endpoints: ObservableMap<number, EndpointData>;
	m_grabEvents = observable.array<AvGrabEvent>();

	constructor()
	{
		this.m_endpoints = new ObservableMap<number, EndpointData>();

		this.m_connection = new CMonitorEndpoint( this.onUnhandledMessage );
		this.m_connection.registerHandler( MessageType.NewEndpoint, this.onNewEndpoint );
		this.m_connection.registerHandler( MessageType.LostEndpoint, this.onLostEndpoint );
		this.m_connection.registerHandler( MessageType.UpdateSceneGraph, this.onUpdateSceneGraph );
		this.m_connection.registerHandler( MessageType.GrabEvent, this.onGrabEvent );
		this.m_connection.registerHandler( MessageType.PokerProximity, this.onPokerProximity );

	}

	public getConnection() { return this.m_connection; }

	public getEndpointData( epid: number ): EndpointData
	{
		if( this.m_endpoints.has( epid ) )
		{
			return this.m_endpoints.get( epid );
		}
		else
		{
			return null;
		}
	}

	public getGadgetData( epid: number ): GadgetData
	{
		let data = this.getEndpointData( epid );
		if( data && data.type == EndpointType.Gadget )
			return data as GadgetData;
		else
			return null;
	}

	public getNodeData( nodeId: EndpointAddr ): AvNode
	{
		if( nodeId.type != EndpointType.Node )
			return null;

		let gadgetData = this.getGadgetData( nodeId.endpointId );
		if( !gadgetData )
			return null;

		return gadgetData.nodes[ nodeId.nodeId ];
	}

	@bind onUnhandledMessage( type: MessageType, message: any, sender: EndpointAddr )
	{
		console.log( "received unhandled message", type, message, sender );
	}

	@bind @action onNewEndpoint( type: MessageType, message: MsgNewEndpoint, sender: EndpointAddr )
	{
		console.log( "New endpoint!", message );
		let data: EndpointData;
		switch( message.newEndpointType )
		{
			case EndpointType.Gadget:
				let gadgetData: GadgetData = 
				{
					type: message.newEndpointType,
					id: message.endpointId,
					gadgetUri: message.gadgetUri,
				}
				data = gadgetData;
				break;

			case EndpointType.Renderer:
				data = 
				{
					type: message.newEndpointType,
					id: message.endpointId,
				}
				break;
		}

		if( data )
		{
			this.m_endpoints.set( message.endpointId, data );
		}
	}

	@action private updateNode( gadgetData: GadgetData, node: AvNode )
	{
		gadgetData.nodes[ node.id ] = node;
		if( node.children )
		{
			for( let child of node.children )
			{
				this.updateNode( gadgetData, child );
			}
		}
	}

	@bind @action onUpdateSceneGraph( type: MessageType, message: MsgUpdateSceneGraph, sender: EndpointAddr )
	{
		if( !this.m_endpoints.has( sender.endpointId ) )
			return;

		let epData = this.m_endpoints.get( sender.endpointId );
		if( !epData || epData.type != EndpointType.Gadget )
		{
			console.log( "UpdateSceneGraph for invalid endpoint", epData );
			return;
		}

		let gadgetData = epData as GadgetData;
		gadgetData.gadgetHook = message.hook;
		gadgetData.gadgetRoot = message.root;

		gadgetData.nodes = {};
		if( gadgetData.gadgetRoot )
		{
			this.updateNode( gadgetData, gadgetData.gadgetRoot );
		}
	}

	@bind @action onLostEndpoint( type: MessageType, message: MsgLostEndpoint, sender: EndpointAddr )
	{
		console.log( "Lost endpoint!", message );
		this.m_endpoints.delete( message.endpointId );
	}

	@bind @action onGrabEvent( type: MessageType, message: MsgGrabEvent, sender: EndpointAddr )
	{
		this.m_grabEvents.push( message.event );
	}

	@bind @action onPokerProximity( type: MessageType, message: MsgPokerProximity )
	{
		// nothing here yet
	}

	@computed get recentGrabEvents()
	{
		return this.m_grabEvents.slice( -10 );
	}

	public sendMessage( type: MessageType, m: any )
	{
		this.m_connection.sendMessage( type, m );
	}
}

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

interface EulerAngles
{
	yaw: number;
	pitch: number;
	roll: number;
}

// This code came from: https://en.wikipedia.org/wiki/Conversion_between_quaternions_and_Euler_angles#Quaternion_to_Euler_Angles_Conversion
function QuaternionToEulerAngles( q: AvQuaternion): EulerAngles
{
	if( !q )
	{
		return ( { yaw: 0, pitch: 0, roll: 0 } );
	}
	
	let r: EulerAngles = { yaw: 0, pitch: 0, roll: 0 };

    // pitch (x-axis rotation)
    let sinr_cosp = +2.0 * (q.w * q.x + q.y * q.z);
    let cosr_cosp = +1.0 - 2.0 * (q.x * q.x + q.y * q.y);
    r.pitch = Math.atan2(sinr_cosp, cosr_cosp);

    // yaw (y-axis rotation)
    let sinp = +2.0 * (q.w * q.y - q.z * q.x);
    if ( Math.abs( sinp ) >= 1 )
        r.yaw = Math.sign( sinp) * Math.PI / 2; // use 90 degrees if out of range
    else
        r.yaw = Math.asin(sinp);

    // roll (z-axis rotation)
    let siny_cosp = +2.0 * (q.w * q.z + q.x * q.y);
    let cosy_cosp = +1.0 - 2.0 * (q.y * q.y + q.z * q.z);  
    r.roll = Math.atan2(siny_cosp, cosy_cosp);

	return r;
}

function quatFromAxisAngleRadians( axis: vec3, rad?: number ): quat
{
	if( !rad )
		return new quat( quat.identity.xyzw );

	return quat.fromAxisAngle( axis, rad );
}


function EulerAnglesToQuaternion( angles: EulerAngles ): AvQuaternion
{
	let qx = quatFromAxisAngleRadians( vec3.right, angles.pitch );
	let qy = quatFromAxisAngleRadians( vec3.up, angles.yaw );
	let qz = quatFromAxisAngleRadians( vec3.forward, angles.roll );

	let q = quat.product( quat.product( qx, qy ), qz );
	return (
	{
		w: q.w,
		x: q.x,
		y: q.y,
		z: q.z,
	} );
}

function RadiansToDegrees( rad: number ): number
{
	return rad * 180 / Math.PI;
}

function DegreesToRadians( deg: number ): number
{
	return deg * Math.PI / 180;
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
	manifest: AvGadgetManifest;
}

@observer
class GadgetMonitor extends React.Component< GadgetMonitorProps, GadgetMonitorState >
{
	constructor( props: any )
	{
		super( props );
		this.state = { manifest: null};

		let gadgetData = MonitorStore.getGadgetData( this.props.gadgetId );
		MonitorStore.getConnection().getGadgetManifest( gadgetData.gadgetUri )
		.then( ( manifest: AvGadgetManifest ) =>
		{
			this.setState( { manifest });
		});
	}

	private renderFlags( flags: number )
	{
		if( !flags )
			return null;
	
		return <div>Flags: { flags } </div>;
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
				{ this.renderFlags } 
			</div>
			{ node.propOrigin && <div className="AvNodeProperty">origin: {node.propOrigin }</div> }
			{ node.propModelUri && <div className="AvNodeProperty">model: {node.propModelUri }</div> }
			{ node.propColor && <div className="AvNodeProperty">Color: 
				{ node.propColor.r },
				{ node.propColor.g },
				{ node.propColor.b }
				{ node.propColor.r != undefined && ( ", " + node.propColor.a ) }
				</div> }
			{ node.propVolume && <div className="AvNodeProperty">volume: radius={node.propVolume.radius }</div> }
			{ node.propInteractive && <div className="AvNodeProperty">Interactive</div> }
			{ node.propConstraint && <div className="AvNodeProperty">Constraint: 
				[ { node.propConstraint.minX }, {node.propConstraint.maxX } ]
				[ { node.propConstraint.minY }, {node.propConstraint.maxY } ]
				[ { node.propConstraint.minZ }, {node.propConstraint.maxZ } ]
				</div> }
			{ node.propSharedTexture && <div className="AvNodeProperty">{ JSON.stringify( node.propSharedTexture ) }</div> }
			{ node.type == AvNodeType.Transform && <TransformMonitor 
				nodeId={ { type: EndpointType.Node, endpointId: this.props.gadgetId, nodeId: node.id } } /> }
			{ childElements }
		</div>
	}

	private renderGrabberState()
	{
		let gadgetData = MonitorStore.getGadgetData( this.props.gadgetId );
		if( !gadgetData || 
			!gadgetData.grabberIsPressed && !gadgetData.hooks && !gadgetData.grabbables )
			return;

		let grabbables: string = "";
		if( gadgetData.grabbables )
		{
			for( let grabbable of gadgetData.grabbables)
			{
				if( grabbables.length > 0 )
				{
					grabbables += ", ";
				}
				grabbables += endpointAddrToString( grabbable );
			}
		}
		let hooks: string = "";
		if( gadgetData.hooks )
		{
			for( let hook of gadgetData.hooks )
			{
				if( hooks.length > 0 )
				{
					hooks += ", ";
				}
				hooks += endpointAddrToString( hook );
			}
		}
		return ( <div>{ gadgetData.grabberIsPressed ? "PRESSED" : "UNPRESSED" }
			<div>Grabbables: { grabbables }</div>
			<div>Hooks: { hooks }</div>
		</div> );
	}


	public render()
	{
		let gadgetData = MonitorStore.getGadgetData( this.props.gadgetId );
		let hookInfo:string;
		if( gadgetData.gadgetHook )
		{
			if( typeof gadgetData.gadgetHook === "string" )
			{
				hookInfo = gadgetData.gadgetHook;
			}
			else
			{
				hookInfo = endpointAddrToString( gadgetData.gadgetHook );
			}
		}

		return <div className="Gadget">
			Gadget { this.props.gadgetId } 
			<div className="GadgetName">{ this.state.manifest ? this.state.manifest.name : "???" } 
				<span className="GadgetUri">({ gadgetData.gadgetUri })</span>
				{ hookInfo && <span className="GadgetUri">({ hookInfo })</span> }
			</div>
			{ gadgetData.gadgetRoot && this.renderNode( gadgetData.gadgetRoot ) }
			{ this.renderGrabberState() }

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
	event: AvGrabEvent;
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
			{ epa && endpointAddrToString( epa ) }
		</div>
	}


	public render()
	{
		return ( <div className="GrabEvent">
			{ AvGrabEventType[ this.props.event.type ] }
			Sender: { this.props.event.senderId }
			{ this.renderAddr( "Grabber", this.props.event.grabberId ) }
			{ this.renderAddr( "Grabbable", this.props.event.grabbableId ) }
			{ this.renderAddr( "Handle", this.props.event.handleId ) }
			{ this.renderAddr( "Hook", this.props.event.hookId ) }
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
