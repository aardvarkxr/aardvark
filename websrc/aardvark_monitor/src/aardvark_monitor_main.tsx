import * as React from 'react';
import  * as ReactDOM from 'react-dom';
import { CMonitorEndpoint } from 'common/aardvark-react/aardvark_endpoint';
import { EndpointType, MessageType, EndpointAddr, MsgNewEndpoint, MsgLostEndpoint, MsgUpdateSceneGraph, MsgGrabberState, endpointAddrToString, MsgGrabEvent } from 'common/aardvark-react/aardvark_protocol';
import bind from 'bind-decorator';
import { AvGadgetManifest, AvNode, AvNodeType, AvNodeTransform, AvVector, AvQuaternion, AvGrabEvent, AvGrabEventType } from 'common/aardvark';
import { observable, ObservableMap, action, observe, computed } from 'mobx';
import { observer } from 'mobx-react';

interface EndpointData
{
	id: number;
	type: EndpointType;
}

interface GadgetData extends EndpointData
{
	gadgetUri?: string;
	gadgetRoot?: AvNode;
	gadgetHook?: string;
	grabberIsPressed?: boolean;
	grabbables?: EndpointAddr[];
	hooks?: EndpointAddr[];
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

	@computed get recentGrabEvents()
	{
		return this.m_grabEvents.slice( -10 );
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

	private renderVector( name: string, vector: AvVector )
	{
		if( !vector )
			return null;

		return <div className="AvNodeProperty">
			<div className="AvNodePropertyName">{name}</div> 
			<div className="AvNodePropertyValue">
				[ {vector.x}, {vector.y}, {vector.x} ]
			</div>
		</div>;
	}

	private renderScale( name: string, scale: AvVector )
	{
		if( !scale )
			return null;

		if( scale.x != null && scale.x == scale.y && scale.x == scale.z )
		{
			return <div className="AvNodeProperty">
				<div className="AvNodePropertyName">{name}</div> 
				<div className="AvNodePropertyValue">uniform( { scale.x } )</div>
			</div>;
		}
		else
		{
			return this.renderVector( name, scale );
		}
	}

	private renderTransform( transform: AvNodeTransform )
	{
		if( !transform )
			return null;
		return <div>
			{ this.renderVector( "translation", transform.position ) }
			{ this.renderScale( "scale", transform.scale ) }
			{ this.renderQuaternion( "rotation", transform.rotation ) }
		</div>
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

		console.log( "rendering node", node );
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
			{ this.renderTransform( node.propTransform ) }
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
		return <div className="Gadget">
			Gadget { this.props.gadgetId } 
			<div className="GadgetName">{ this.state.manifest ? this.state.manifest.name : "???" } 
				<span className="GadgetUri">({ gadgetData.gadgetUri })</span>
				<span className="GadgetUri">({ gadgetData.gadgetHook })</span>
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
