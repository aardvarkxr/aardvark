import * as React from 'react';
import  * as ReactDOM from 'react-dom';
import { CAardvarkEndpoint } from 'common/aardvark-react/aardvark_endpoint';
import { EndpointType, MessageType, Endpoint, MsgNewEndpoint, MsgLostEndpoint } from 'common/aardvark-react/aardvark_protocol';
import bind from 'bind-decorator';


interface GadgetMonitorProps
{
	gadgetId: number;
}

interface GadgetMonitorState
{

}

class GadgetMonitor extends React.Component< GadgetMonitorProps, GadgetMonitorState >
{
	constructor( props: any )
	{
		super( props );
		this.state = {};
	}

	public render()
	{
		return <div className="Gadget">Gadget { this.props.gadgetId }</div>
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

interface AardvarkMonitorState
{
	endpoints: { [id: number] : Endpoint };
}

class AardvarkMonitor extends React.Component< {}, AardvarkMonitorState >
{
	private m_endpoint: CAardvarkEndpoint;

	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
			endpoints : {},
		};

		this.m_endpoint = new CAardvarkEndpoint( EndpointType.Monitor, this.onUnhandledMessage );
		this.m_endpoint.registerHandler( MessageType.NewEndpoint, this.onNewEndpoint );
		this.m_endpoint.registerHandler( MessageType.LostEndpoint, this.onLostEndpoint );
	}

	@bind onUnhandledMessage( type: MessageType, message: any, sender: Endpoint )
	{
		console.log( "received unhandled message", type, message, sender );
	}

	@bind onNewEndpoint( type: MessageType, message: MsgNewEndpoint, sender: Endpoint )
	{
		console.log( "New endpoint!", message );
		if( message.newEndpointType != EndpointType.Monitor )
		{
			let newList = Object.assign( {}, this.state.endpoints );
			newList[ message.endpointId ] = 
			{ 
				type: message.newEndpointType,
				endpointId: message.endpointId,
			}

			this.setState( { endpoints: newList } );
		}
	}

	@bind onLostEndpoint( type: MessageType, message: MsgLostEndpoint, sender: Endpoint )
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
					endpoints.push( <GadgetMonitor gadgetId={ ep.endpointId } /> );
					break;
				case EndpointType.Renderer:
					endpoints.push( <RendererMonitor rendererId={ ep.endpointId } /> );
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
