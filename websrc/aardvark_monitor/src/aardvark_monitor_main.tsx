import * as React from 'react';
import  * as ReactDOM from 'react-dom';
import { CAardvarkEndpoint } from 'common/aardvark-react/aardvark_endpoint';
import { EndpointType, MessageType, Endpoint, MsgNewEndpoint } from 'common/aardvark-react/aardvark_protocol';
import bind from 'bind-decorator';

interface AardvarkMonitorState
{
}

class AardvarkMonitor extends React.Component< {}, AardvarkMonitorState >
{
	 private m_endpoint: CAardvarkEndpoint;

	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
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
	}

	@bind onLostEndpoint( type: MessageType, message: MsgLostEndpoint, sender: Endpoint )
	{
		console.log( "Lost endpoint!", message );
	}

	public render()
	{
		return (
			<div>
				Hello World!
			</div>
		)
	}
}

ReactDOM.render( <AardvarkMonitor/>, document.getElementById( "root" ) );
