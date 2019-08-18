import bind from 'bind-decorator';
import { EndpointType, MessageType, EndpointAddr, Envelope, parseEnvelope, MsgSetEndpointType, MsgGetGadgetManifest, MsgGetGadgetManifestResponse, MsgGrabEvent, MsgSetEndpointTypeResponse } from './aardvark_protocol';
import { AvGadgetManifest, AvGrabEvent } from 'common/aardvark';

export interface MessageHandler
{
	( type:MessageType, payload: any, sender: EndpointAddr, target: EndpointAddr ):void;
}

export interface OpenHandler
{
	():void;
}

export class CAardvarkEndpoint
{
	private m_ws:WebSocket = null;
	private m_handlers: { [ msgType: number ]: MessageHandler } = {};
	private m_callbacks: { [ msgType: number ]: MessageHandler } = {};
	private m_defaultHandler: MessageHandler = null;
	private m_realOpenHandler: OpenHandler = null;
	private m_handshakeComplete: OpenHandler = null;
	private m_endpointId: number = null;

	constructor( openHandler: OpenHandler, handshakeComplete: OpenHandler, defaultHandler: MessageHandler = null )
	{
		this.m_defaultHandler = defaultHandler;
		this.m_realOpenHandler = openHandler;
		this.m_handshakeComplete = handshakeComplete;
		this.connectToServer();
		this.registerHandler( MessageType.SetEndpointTypeResponse, this.onSetEndpointTypeResponse );
	}

	public getEndpointId() { return this.m_endpointId; }

	@bind private connectToServer()
	{
		this.m_ws = new WebSocket( "ws://localhost:8999" );
		this.m_ws.onopen = this.m_realOpenHandler;
		this.m_ws.onmessage = this.onMessage;
		this.m_ws.onclose = this.onClose;
	}

	public registerHandler( type: MessageType, handler: MessageHandler )
	{
		this.m_handlers[ type ] = handler;
	}

	public waitForResponse( type: MessageType, callback: MessageHandler )
	{
		this.m_callbacks[ type ] = callback;
	}

	@bind onMessage( msgEvent: MessageEvent )
	{
		let env = parseEnvelope( msgEvent.data );
		if( !env )
			return;

		if( this.m_handlers[ env.type ] )
		{
			this.m_handlers[ env.type ]( env.type, env.payloadUnpacked, env.sender, env.target );
		} 
		else if( this.m_callbacks[ env.type ] )
		{
			this.m_callbacks[ env.type]( env.type, env.payloadUnpacked, env.sender, env.target );
			delete this.m_callbacks[ env.type ];
		}
		else if( this.m_defaultHandler )
		{
			this.m_defaultHandler( env.type, env.payloadUnpacked, env.sender, env.target );
		}
		else
		{
			console.log( "Unhandled message", env );
		}
	}

	@bind public onSetEndpointTypeResponse( type: MessageType, m: MsgSetEndpointTypeResponse )
	{
		this.m_endpointId = m.endpointId;
		if( this.m_handshakeComplete )
		{
			this.m_handshakeComplete();
		}
	}

	public sendMessage( type: MessageType, msg: any )
	{
		let env: Envelope =
		{
			type,
		};
		if( msg != undefined )
		{
			env.payload = JSON.stringify( msg );
		}

		this.m_ws.send( JSON.stringify( env ) );
	}

	public sendGrabEvent( event: AvGrabEvent )
	{
		let msg: MsgGrabEvent =
		{
			event,
		};

		this.sendMessage( MessageType.GrabEvent, msg );
	}

	public getGadgetManifest( gadgetUri: string ): Promise<AvGadgetManifest>
	{
		return new Promise<AvGadgetManifest>( ( resolve, reject ) =>
		{
			let msgGetGadgetManifest: MsgGetGadgetManifest =
			{
				gadgetUri,
			}
	
			this.sendMessage( MessageType.GetGadgetManifest, msgGetGadgetManifest );
				
			this.waitForResponse( MessageType.GetGadgetManifestResponse, 
				( type:MessageType, m: MsgGetGadgetManifestResponse, sender: EndpointAddr ) =>
				{
					if( m.manifest )
					{
						resolve( m.manifest );
					}
					else
					{
						reject( m.error );
					}
				});
		})
	}

	@bind onClose()
	{
		// The socket closed from the other end. Schedule a reconnect for when
		// the server comes back up
		window.setTimeout( this.connectToServer, 2000 );
	}
}

export class CMonitorEndpoint extends CAardvarkEndpoint
{
	constructor( defaultHandler: MessageHandler = null )
	{
		super( () => { this.onOpen() }, null, defaultHandler );
	}

	@bind onOpen()
	{
		console.log( "Connected" );
		let msgSetEndpointType: MsgSetEndpointType =
		{
			newEndpointType: EndpointType.Monitor,
		}

		this.sendMessage( MessageType.SetEndpointType, msgSetEndpointType );
	}


}


