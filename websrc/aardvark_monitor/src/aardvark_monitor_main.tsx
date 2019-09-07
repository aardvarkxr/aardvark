import * as React from 'react';
import  * as ReactDOM from 'react-dom';
import { CMonitorEndpoint } from 'common/aardvark-react/aardvark_endpoint';
import { EndpointType, MessageType, EndpointAddr, MsgNewEndpoint, MsgLostEndpoint, MsgUpdateSceneGraph, MsgGrabberState, endpointAddrToString, MsgGrabEvent, MsgPokerProximity, MsgOverrideTransform } from 'common/aardvark-react/aardvark_protocol';
import bind from 'bind-decorator';
import { AvGadgetManifest, AvNode, AvNodeType, AvNodeTransform, AvVector, AvQuaternion, AvGrabEvent, AvGrabEventType } from 'common/aardvark';
import { observable, ObservableMap, action, observe, computed } from 'mobx';
import { observer } from 'mobx-react';
import { AvTransform } from 'common/aardvark-react/aardvark_transform';

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
		this.m_connection.registerHandler( MessageType.GrabberState, this.onGrabberState );
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

	@bind @action onGrabberState( type: MessageType, message: MsgGrabberState, sender: EndpointAddr )
	{
		let gadgetData = this.getGadgetData( message.grabberId.endpointId );
		if( !gadgetData )
			return;

		gadgetData.grabberIsPressed = message.isPressed;
		gadgetData.grabbables = message.grabbables;
		gadgetData.hooks = message.hooks;
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
	label?: string;
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
			{ this.props.label && <div className="SpinnerLabel">{ this.props.label }:</div> }
			<div className="SpinnerValue">{ this.state.value.toFixed( 2 ) }</div>
			<div className="SpinnerControls">
				<div className="SpinnerButton" onClick={ this.onClickUp }>
					<img className="SpinnerButtonImage Up" src="spinner_up.svg"/>
				</div>
				<div className="SpinnerButton" onClick={ this.onClickDown }>
					<img className="SpinnerButtonImage Down" src="spinner_up.svg"/>
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
}

@observer 
class TransformMonitor extends React.Component< TransformMonitorProps, TransformMonitorState >
{
	constructor( props: any )
	{
		super( props )
		
	}

	private renderQuaternion( name: string, q: AvQuaternion )
	{
		if( !q )
			return null;

		return <div className="AvNodeProperty">
			<div className="AvNodePropertyName">{name}</div> 
			<div className="AvNodePropertyValue">
				[ {q.w}, {q.x}, {q.y}, {q.x} ]
			</div>
		</div>;
	}

	private renderVector( name: string, vector: AvVector, allowNegative: boolean, 
		onUpdateVector: ( which: string, value: number ) => void )
	{
		if( !vector )
		{
			if( allowNegative )
			{
				vector = { x: 0, y: 0, z: 0 };
			}
			else
			{
				vector = { x: 1, y: 1, z: 1 };
			}
		}

		let min = allowNegative ? -2 : 0.01;
		return <div className="AvNodeProperty">
			<div className="AvNodePropertyName">{name}</div> 
			<div className="AvNodePropertyValue">
				<Spinner min={ min } max={ 2 } step={ 0.01 } initialValue={ vector.x }
					onUpdatedValue={ ( value: number ) => { onUpdateVector( "x", value ); } }/>
				<Spinner min={ min } max={ 2 } step={ 0.01 } initialValue={ vector.y }
					onUpdatedValue={ ( value: number ) => { onUpdateVector( "y", value ); } }/>
				<Spinner min={ min } max={ 2 } step={ 0.01 } initialValue={ vector.z }
					onUpdatedValue={ ( value: number ) => { onUpdateVector( "z", value ); } }/>
			</div>
		</div>;
	}

	private get transform(): AvNodeTransform
	{
		let node = MonitorStore.getNodeData( this.props.nodeId );
		return node.propTransform;
	}

	private overrideTransform()
	{
		let m: MsgOverrideTransform =
		{
			nodeId: this.props.nodeId,
			transform: this.transform,
		};
		MonitorStore.sendMessage( MessageType.OverrideTransform, m );
	}

	@bind private updateUniformScale( value: number )
	{
		this.transform.scale = 
		{
			x: value,
			y: value,
			z: value,
		}
		this.overrideTransform();
	}

	private renderScale( name: string, scale: AvVector )
	{
		if( scale && scale.x != null && scale.x == scale.y && scale.x == scale.z )
		{
			return <Spinner label="uniform scale" min={0.01} max={2.0} initialValue={ scale.x } step={0.01} 
				onUpdatedValue={ this.updateUniformScale }/>
		}
		else
		{
			return this.renderVector( name, scale, false, 
				( which: string, value: number ) =>
				{
					let scale = this.transform.scale;
					if( !scale )
					{
						scale = { x: 1, y: 1, z: 1 };
					}
					switch( which )
					{
						case "x": 
							scale.x = value;
							break;

						case "y": 
							scale.y = value;
							break;

						case "z": 
							scale.z = value;
							break;
					}

					this.transform.scale = scale;
					this.overrideTransform();
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
				{ this.renderVector( "translation", transform.position, true, 
					( which: string, value: number ) =>
					{
						let translation = this.transform.position;
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
						this.transform.position = translation;

						this.overrideTransform();
					} ) }

				{ this.renderScale( "scale", transform.scale ) }
				{ this.renderQuaternion( "rotation", transform.rotation ) }
			</div>;
	}

	render()
	{
		let node = MonitorStore.getNodeData( this.props.nodeId );
		if( !node )
			return null;

		return this.renderTransform( node.propTransform );
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
			{ node.propVolume && <div className="AvNodeProperty">volume: radius={node.propVolume.radius }</div> }
			{ node.propInteractive && <div className="AvNodeProperty">Interactive</div> }
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
