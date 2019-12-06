import bind from 'bind-decorator';
import { AvGadgetManifest, AvGrabEvent, EndpointType, MessageType, EndpointAddr, Envelope, parseEnvelope, MsgSetEndpointType, MsgGetGadgetManifest, MsgGetGadgetManifestResponse, MsgGrabEvent, MsgSetEndpointTypeResponse, AardvarkPort, WebSocketCloseCodes } from '@aardvarkxr/aardvark-shared';

export interface MessageHandler
{
	( type:MessageType, payload: any, sender: EndpointAddr, target: EndpointAddr ):void;
}

export interface OpenHandler
{
	( settings: any, persistenceUuid?: string ):void;
}

interface PendingGadgetManifestLoad
{
	resolve ( manifest: AvGadgetManifest ): void;
	reject ( reason: any ): void;
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
	private m_queuedMessages: Envelope[] = [];
	private m_pendingManifestLoads: { [gadgetUri: string ]: PendingGadgetManifestLoad[] } = {};

	constructor( openHandler: OpenHandler, handshakeComplete: OpenHandler, defaultHandler: MessageHandler = null )
	{
		this.m_defaultHandler = defaultHandler;
		this.m_realOpenHandler = openHandler;
		this.m_handshakeComplete = handshakeComplete;
		this.connectToServer();
		this.registerHandler( MessageType.SetEndpointTypeResponse, this.onSetEndpointTypeResponse );
		this.registerHandler( MessageType.GetGadgetManifestResponse, this.onGetGadgetManifestResponse );
	}

	public getEndpointId() { return this.m_endpointId; }

	@bind private connectToServer()
	{
		this.m_ws = new WebSocket( "ws://localhost:" + AardvarkPort );
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
			this.m_handshakeComplete( m.settings, m.persistenceUuid );
		}

		// send all the messages that were queued while we were waiting to connect
		for( let env of this.m_queuedMessages )
		{
			this.m_ws.send( JSON.stringify( env ) );
		}
		this.m_queuedMessages = [];
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

		if( !this.m_endpointId && type != MessageType.SetEndpointType )
		{
			console.log( `Queueing message of type ${ MessageType[ type ] } to be sent when we connect` );
			this.m_queuedMessages.push( env );
		}
		else
		{
			this.m_ws.send( JSON.stringify( env ) );
		}
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
	
			if( !this.m_pendingManifestLoads.hasOwnProperty( gadgetUri ) )
			{
				this.m_pendingManifestLoads[ gadgetUri ] = [];
			}

			this.m_pendingManifestLoads[ gadgetUri ].push( { resolve, reject } );

			this.sendMessage( MessageType.GetGadgetManifest, msgGetGadgetManifest );
		} );
	}

	@bind private onGetGadgetManifestResponse( type: MessageType, m: MsgGetGadgetManifestResponse )
	{
		let pendingRequests = this.m_pendingManifestLoads[ m.gadgetUri ];
		if( pendingRequests )
		{
			for( let req of pendingRequests )
			{
				if( m.manifest )
				{
					req.resolve( m.manifest );
				}
				else
				{
					req.reject( m.error );
				}
			}

			delete this.m_pendingManifestLoads[ m.gadgetUri ];
		}
	}

	@bind onClose( ev: CloseEvent )
	{
		if( ev.code == WebSocketCloseCodes.UserDestroyedGadget )
		{
			// The user asked to destroy this gadget. Just close with as little additional
			// work as possible
			window.close();
		}
		else
		{
			// The socket closed from the other end. Schedule a reconnect for when
			// the server comes back up
			window.setTimeout( this.connectToServer, 2000 );
		}
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


