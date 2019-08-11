import * as React from 'react';
import  * as ReactDOM from 'react-dom';
import { CMonitorEndpoint } from 'common/aardvark-react/aardvark_endpoint';
import { EndpointType, MessageType, EndpointAddr, MsgNewEndpoint, MsgLostEndpoint, MsgUpdateSceneGraph } from 'common/aardvark-react/aardvark_protocol';
import bind from 'bind-decorator';
import { AvGadgetManifest, AvNode, AvNodeType, AvNodeTransform, AvVector, AvQuaternion } from 'common/aardvark';


interface GadgetMonitorProps
{
	gadgetId: number;
	gadgetUri: string;
	gadgetRoot?: AvNode;
	monitor: CMonitorEndpoint;
}

interface GadgetMonitorState
{
	manifest: AvGadgetManifest;
}

class GadgetMonitor extends React.Component< GadgetMonitorProps, GadgetMonitorState >
{
	constructor( props: any )
	{
		super( props );
		this.state = { manifest: null};

		this.props.monitor.getGadgetManifest( this.props.gadgetUri )
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
			{ this.renderTransform( node.propTransform ) }
			{ childElements }
		</div>
	}


	public render()
	{
		return <div className="Gadget">
			Gadget { this.props.gadgetId } 
			<div className="GadgetName">{ this.state.manifest ? this.state.manifest.name : "???" } 
				<span className="GadgetUri">({ this.props.gadgetUri })</span></div>
			{ this.props.gadgetRoot && this.renderNode( this.props.gadgetRoot ) }

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

interface EndpointData
{
	id: number;
	type: EndpointType;
	gadgetUri?: string;
	gadgetRoot?: AvNode;
}

interface AardvarkMonitorState
{
	endpoints: { [id: number] : EndpointData };
}

class AardvarkMonitor extends React.Component< {}, AardvarkMonitorState >
{
	private m_endpoint: CMonitorEndpoint;

	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
			endpoints : {},
		};

		this.m_endpoint = new CMonitorEndpoint( this.onUnhandledMessage );
		this.m_endpoint.registerHandler( MessageType.NewEndpoint, this.onNewEndpoint );
		this.m_endpoint.registerHandler( MessageType.LostEndpoint, this.onLostEndpoint );
		this.m_endpoint.registerHandler( MessageType.UpdateSceneGraph, this.onUpdateSceneGraph );
	}

	@bind onUnhandledMessage( type: MessageType, message: any, sender: EndpointAddr )
	{
		console.log( "received unhandled message", type, message, sender );
	}

	@bind onNewEndpoint( type: MessageType, message: MsgNewEndpoint, sender: EndpointAddr )
	{
		console.log( "New endpoint!", message );
		if( message.newEndpointType != EndpointType.Monitor )
		{
			let newList = Object.assign( {}, this.state.endpoints );
			newList[ message.endpointId ] = 
			{ 
				type: message.newEndpointType,
				id: message.endpointId,
				gadgetUri: message.gadgetUri,
			}

			this.setState( { endpoints: newList } );
		}
	}

	@bind onUpdateSceneGraph( type: MessageType, message: MsgUpdateSceneGraph, sender: EndpointAddr )
	{
		let newList = Object.assign( {}, this.state.endpoints );
		newList[ sender.endpointId ].gadgetRoot = message.root;
		this.setState( { endpoints: newList } );
	}

	@bind onLostEndpoint( type: MessageType, message: MsgLostEndpoint, sender: EndpointAddr )
	{
		console.log( "Lost endpoint!", message );
		let newList = Object.assign( {}, this.state.endpoints );
		delete newList[ message.endpointId ];
		this.setState( { endpoints: newList } );
	}

	public render()
	{
		let endpoints: JSX.Element[] = [];
		for( let epid in this.state.endpoints )
		{
			let ep = this.state.endpoints[ epid ];
			switch( ep.type )
			{
				case EndpointType.Gadget:
					endpoints.push( <GadgetMonitor key={ epid }
						gadgetId={ ep.id } 
						gadgetUri={ ep.gadgetUri } 
						gadgetRoot={ ep.gadgetRoot }
						monitor={ this.m_endpoint } /> );
					break;
				case EndpointType.Renderer:
					endpoints.push( <RendererMonitor  key={ epid } rendererId={ ep.id } /> );
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

ReactDOM.render( <AardvarkMonitor/>, document.getElementById( "root" ) );
