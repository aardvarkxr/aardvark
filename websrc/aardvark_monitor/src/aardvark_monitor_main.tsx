import * as React from 'react';
import  * as ReactDOM from 'react-dom';
import { CMonitorEndpoint } from 'common/aardvark-react/aardvark_endpoint';
import { EndpointType, MessageType, EndpointAddr, MsgNewEndpoint, MsgLostEndpoint, MsgUpdateSceneGraph } from 'common/aardvark-react/aardvark_protocol';
import bind from 'bind-decorator';
import { AvGadgetManifest, AvNode, AvNodeType, AvNodeTransform, AvVector, AvQuaternion } from 'common/aardvark';
import { observable, ObservableMap, action, observe } from 'mobx';
import { observer } from 'mobx-react';

interface EndpointData
{
	id: number;
	type: EndpointType;
	gadgetUri?: string;
	gadgetRoot?: AvNode;
	gadgetHook?: string;
}


class CMonitorStore
{
	private m_connection: CMonitorEndpoint;
	@observable m_endpoints: ObservableMap<number, EndpointData>;

	constructor()
	{
		this.m_endpoints = new ObservableMap<number, EndpointData>();

		this.m_connection = new CMonitorEndpoint( this.onUnhandledMessage );
		this.m_connection.registerHandler( MessageType.NewEndpoint, this.onNewEndpoint );
		this.m_connection.registerHandler( MessageType.LostEndpoint, this.onLostEndpoint );
		this.m_connection.registerHandler( MessageType.UpdateSceneGraph, this.onUpdateSceneGraph );

	}

	public getConnection() { return this.m_connection; }

	public getEndpointData( epid: number )
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

	@bind onUnhandledMessage( type: MessageType, message: any, sender: EndpointAddr )
	{
		console.log( "received unhandled message", type, message, sender );
	}

	@bind @action onNewEndpoint( type: MessageType, message: MsgNewEndpoint, sender: EndpointAddr )
	{
		console.log( "New endpoint!", message );
		if( message.newEndpointType != EndpointType.Monitor )
		{
			this.m_endpoints.set( message.endpointId,
				{ 
					type: message.newEndpointType,
					id: message.endpointId,
					gadgetUri: message.gadgetUri,
				} );
		}
	}

	@bind @action onUpdateSceneGraph( type: MessageType, message: MsgUpdateSceneGraph, sender: EndpointAddr )
	{
		if( this.m_endpoints.has( sender.endpointId ) )
		{
			let endpointData = this.m_endpoints.get( sender.endpointId );
			endpointData.gadgetHook = message.hook;
			endpointData.gadgetRoot = message.root;
		}
	}

	@bind @action onLostEndpoint( type: MessageType, message: MsgLostEndpoint, sender: EndpointAddr )
	{
		console.log( "Lost endpoint!", message );
		this.m_endpoints.delete( message.endpointId );
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

		let gadgetData = MonitorStore.getEndpointData( this.props.gadgetId );
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


	public render()
	{
		let gadgetData = MonitorStore.getEndpointData( this.props.gadgetId );
		return <div className="Gadget">
			Gadget { this.props.gadgetId } 
			<div className="GadgetName">{ this.state.manifest ? this.state.manifest.name : "???" } 
				<span className="GadgetUri">({ gadgetData.gadgetUri })</span>
				<span className="GadgetUri">({ gadgetData.gadgetHook })</span>
			</div>
			{ gadgetData.gadgetRoot && this.renderNode( gadgetData.gadgetRoot ) }

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

		if( endpoints.length == 0 )
		{
			return <div>Nothing connected yet.</div>;
		}
		else
		{
			return <div>{ endpoints }</div>;
		}
	}
}

let MonitorStore = new CMonitorStore();
ReactDOM.render( <AardvarkMonitor/>, document.getElementById( "root" ) );
