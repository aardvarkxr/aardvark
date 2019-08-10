import bind from 'bind-decorator';
import { EndpointType, MessageType, Endpoint, Envelope, parseEnvelope, MsgSetEndpointType } from './aardvark_protocol';

export interface MessageHandler
{
	( type:MessageType, payload: any, sender: Endpoint ):void;
}

export interface OpenHandler
{
	():void;
}

class CAardvarkEndpoint
{
	private m_ws = new WebSocket( "ws://localhost:8999" );
	private m_handlers: { [ msgType: number ]: MessageHandler } = {};
	private m_defaultHandler: MessageHandler = null;

	constructor( openHandler: OpenHandler, defaultHandler: MessageHandler = null )
	{
		this.m_defaultHandler = defaultHandler;
		this.m_ws.onopen = openHandler;
		this.m_ws.onmessage = this.onMessage;
	}

	public registerHandler( type: MessageType, handler: MessageHandler )
	{
		this.m_handlers[ type ] = handler;
	}

	@bind onMessage( msgEvent: MessageEvent )
	{
		let env = parseEnvelope( msgEvent.data );
		if( !env )
			return;

		if( this.m_handlers[ env.type ] )
		{
			this.m_handlers[ env.type ]( env.type, env.payloadUnpacked, env.sender );
		} 
		else if( this.m_defaultHandler )
		{
			this.m_defaultHandler( env.type, env.payloadUnpacked, env.sender );
		}
		else
		{
			console.log( "Unhandled message", env );
		}
	}

	public sendMessage( targets: Endpoint[], type: MessageType, msg: any )
	{
		let env: Envelope =
		{
			type,
			targets,
		};
		if( msg != undefined )
		{
			env.payload = JSON.stringify( msg );
		}

		this.m_ws.send( JSON.stringify( env ) );
	}
}

export class CMonitorEndpoint extends CAardvarkEndpoint
{
	constructor( defaultHandler: MessageHandler = null )
	{
		super( () => { this.onOpen() }, defaultHandler );
	}

	@bind onOpen()
	{
		console.log( "Connected" );
		let msgSetEndpointType: MsgSetEndpointType =
		{
			newEndpointType: EndpointType.Monitor,
		}

		this.sendMessage( [], MessageType.SetEndpointType, msgSetEndpointType );
	}


}


export class CGadgetEndpoint extends CAardvarkEndpoint
{
	private gadgetUri: string;

	constructor( gadgetUri: string, defaultHandler: MessageHandler = null )
	{
		super( () => { this.onOpen() }, defaultHandler );
		this.gadgetUri = gadgetUri;
	}

	@bind onOpen()
	{
		console.log( "Connected" );
		let msgSetEndpointType: MsgSetEndpointType =
		{
			newEndpointType: EndpointType.Gadget,
			gadgetUri: this.gadgetUri,
		}

		this.sendMessage( [], MessageType.SetEndpointType, msgSetEndpointType );
	}


}

