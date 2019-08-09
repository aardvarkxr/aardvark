import bind from 'bind-decorator';
import { EndpointType, MessageType, Endpoint, Envelope, parseEnvelope, MsgSetEndpointType } from './aardvark_protocol';

export interface MessageHandler
{
	( type:MessageType, payload: any, sender: Endpoint ):void;
}


export class CAardvarkEndpoint
{
	private m_ws = new WebSocket( "ws://localhost:8999" );
	private m_type:EndpointType;
	private m_handlers: { [ msgType: number ]: MessageHandler } = {};
	private m_defaultHandler: MessageHandler = null;

	constructor( type: EndpointType, defaultHandler: MessageHandler = null )
	{
		this.m_type = type;
		this.m_defaultHandler = defaultHandler;
		this.m_ws.onopen = this.onOpen;
		this.m_ws.onmessage = this.onMessage;
	}

	public registerHandler( type: MessageType, handler: MessageHandler )
	{
		this.m_handlers[ type ] = handler;
	}

	@bind onOpen()
	{
		console.log( "Connected" );
		let msgSetEndpointType: MsgSetEndpointType =
		{
			newEndpointType: this.m_type,
		}

		this.sendMessage( [], MessageType.SetEndpointType, msgSetEndpointType );
	}

	@bind onMessage( msgEvent: MessageEvent )
	{
		let env = parseEnvelope( msgEvent.data );
		if( !env )
			return;

		if( this.m_handlers[ env.type ] )
		{
			this.m_handlers[ env.type ]( env.type, env.payload, env.sender );
		} 
		else if( this.m_defaultHandler )
		{
			this.m_defaultHandler( env.type, env.payload, env.sender );
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