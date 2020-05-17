import { AardvarkManifest, AardvarkPort, EndpointAddr, EndpointType, Envelope, MessageType, MsgGeAardvarkManifestResponse, MsgGetAardvarkManifest, MsgSetEndpointType, MsgSetEndpointTypeResponse, parseEnvelope, WebSocketCloseCodes } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';

export interface MessageHandler
{
	( payload: any, env: Envelope ): void;
}

export interface AsyncMessageHandler
{
	( payload: any, env: Envelope ): Promise<void>;
}

export interface OpenHandler
{
	( settings: any, persistenceUuid?: string ):void;
}


interface PendingResponse
{
	resolve( resp: [ any, Envelope ] ): void;
	reject( reason: any ): void;
}


export class CAardvarkEndpoint
{
	private m_ws:WebSocket = null;
	private m_handlers: { [ msgType: number ]: MessageHandler } = {};
	private m_asyncHandlers: { [ msgType: number ]: AsyncMessageHandler } = {};
	private m_defaultHandler: AsyncMessageHandler = null;
	private m_realOpenHandler: OpenHandler = null;
	private m_handshakeComplete: OpenHandler = null;
	private m_endpointId: number = null;
	private m_queuedMessages: Envelope[] = [];
	private m_allowReconnect = false;
	private m_nextSequenceNumber = 1;
	private m_pendingResponses: 
	{ 
		[ responseType: number ]: 
		{ 
			[ sequenceNumber: number ]: 
			PendingResponse 
		}
		
	} = {};

	constructor( openHandler: OpenHandler, handshakeComplete: OpenHandler, defaultHandler: AsyncMessageHandler = null )
	{
		this.m_defaultHandler = defaultHandler;
		this.m_realOpenHandler = openHandler;
		this.m_handshakeComplete = handshakeComplete;
		this.connectToServer();
		this.registerHandler( MessageType.SetEndpointTypeResponse, this.onSetEndpointTypeResponse );
	}

	public sendMessageAndWaitForResponse<T>( type: MessageType, msg: any, responseType: MessageType ):
		Promise< [ T, Envelope ] >
	{
		return new Promise( ( resolve, reject ) =>
		{
			let seqNumber = this.sendMessage( type, msg );

			if( !this.m_pendingResponses[ responseType ] )
			{
				this.m_pendingResponses[ responseType ] = {};
			}

			this.m_pendingResponses[ responseType ][ seqNumber ] = { resolve, reject };
		} );
	}

	public getEndpointId() { return this.m_endpointId; }

	public allowReconnect() { this.m_allowReconnect = true; }

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

	public registerAsyncHandler( type: MessageType, handler: AsyncMessageHandler )
	{
		this.m_asyncHandlers[ type ] = handler;
	}

	private m_messageInProgress = false;
	private m_waitingIncomingMessages: MessageEvent[] = [];
	@bind async onMessage( msgEvent: MessageEvent )
	{
		if( this.m_messageInProgress )
		{
			// process this event when whatever is currently being processed returns
			// let env = parseEnvelope( msgEvent.data );
			// console.log( `Pushing message of type ${ MessageType[ env.type ] }` );
			this.m_waitingIncomingMessages.push( msgEvent );
		}
		else
		{
			this.m_messageInProgress = true;
			await this.processMessageInternal( msgEvent );
			
			while( this.m_waitingIncomingMessages.length > 0 )
			{
				let nextEvent = this.m_waitingIncomingMessages.shift();
				await this.processMessageInternal( nextEvent );
			}
			this.m_messageInProgress = false;
		}
	}

	private async processMessageInternal( msgEvent: MessageEvent )
	{
		let env = parseEnvelope( msgEvent.data );
		if( !env )
			return;

		//console.log( `Processing message of type ${ MessageType[ env.type ] }` );

		if( this.m_handlers[ env.type ] )
		{
			this.m_handlers[ env.type ]( env.payloadUnpacked, env );
		} 
		else if( this.m_asyncHandlers[ env.type ] )
		{
			await this.m_asyncHandlers[ env.type ]( env.payloadUnpacked, env );
		} 
		else if( this.m_pendingResponses[ env.type ] )
		{
			let pendingResponse = this.m_pendingResponses[ env.type ][ env.replyTo ];
			if( !pendingResponse )
			{
				console.log( `Received message of type ${ MessageType[ env.type ] } that didn't `
					+ `have a matching sequence number ${ env.replyTo }` );
			}
			else
			{
				pendingResponse.resolve( [ env.payloadUnpacked, env ] );
				delete this.m_pendingResponses[ env.type ][ env.replyTo ];
			}
		}
		else if( this.m_defaultHandler )
		{
			await this.m_defaultHandler( env.payloadUnpacked, env );
		}
		else
		{
			console.log( `Unhandled ${ MessageType[ env.type ] }: ${ env.payload }` );
		}
	}

	@bind public async onSetEndpointTypeResponse( m: MsgSetEndpointTypeResponse )
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

	public sendMessage( type: MessageType, msg: any, sendingNode ?: number )
	{
		let env: Envelope =
		{
			type,
			sequenceNumber: this.m_nextSequenceNumber++,
		};
		if( msg != undefined )
		{
			env.payload = JSON.stringify( msg );
		}
		if( sendingNode != undefined )
		{
			env.sender = 
			{ 
				type: EndpointType.Node, 
				endpointId: this.m_endpointId, 
				nodeId: sendingNode 
			};
		}

		if( !this.m_endpointId && type != MessageType.SetEndpointType )
		{
			//console.log( `Queueing message of type ${ MessageType[ type ] } to be sent when we connect` );
			this.m_queuedMessages.push( env );
		}
		else
		{
			this.m_ws.send( JSON.stringify( env ) );
		}
		return env.sequenceNumber;
	}

	public sendReply( type: MessageType, msg: any, replyTo: Envelope, sender:EndpointAddr = undefined  )
	{
		let env: Envelope =
		{
			type,
			sequenceNumber: this.m_nextSequenceNumber++,
			sender: sender ? sender : { type: EndpointType.Hub, endpointId: 0 },
			target: replyTo.sender,
			replyTo: replyTo.sequenceNumber,
			payload: JSON.stringify( msg ),
		}
		this.m_ws.send( JSON.stringify( env ) );
	}

	public getGadgetManifest( gadgetUri: string ): Promise<AardvarkManifest>
	{
		return new Promise<AardvarkManifest>( ( resolve, reject ) =>
		{
			let msgGetGadgetManifest: MsgGetAardvarkManifest =
			{
				gadgetUri,
			}
			let prom = this.sendMessageAndWaitForResponse( MessageType.GetAardvarkManifest, 
				msgGetGadgetManifest, MessageType.GetAardvarkManifestResponse );

			prom.then( ( [ msg, env ] : [ MsgGeAardvarkManifestResponse, Envelope ] ) =>
			{
				if( msg.manifest )
				{
					resolve( msg.manifest );
				}
				else
				{
					reject( msg.error );
				}
			} );
		} );
	}

	@bind onClose( ev: CloseEvent )
	{
		if( ev.code == WebSocketCloseCodes.UserDestroyedGadget )
		{
			// The user asked to destroy this gadget. Just close with as little additional
			// work as possible
			window.close();
		}
		else if ( this.m_allowReconnect )
		{
			// The socket closed from the other end. Schedule a reconnect for when
			// the server comes back up
			setTimeout( this.connectToServer, 2000 );
		}
	}
}

export class CMonitorEndpoint extends CAardvarkEndpoint
{
	constructor( defaultHandler: AsyncMessageHandler = null )
	{
		super( () => { this.onOpen() }, null, defaultHandler );
		this.allowReconnect();
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


export class CUtilityEndpoint extends CAardvarkEndpoint
{
	constructor( defaultHandler: AsyncMessageHandler = null )
	{
		super( () => { this.onOpen() }, null, defaultHandler );
	}

	@bind onOpen()
	{
		console.log( "Connected" );
		let msgSetEndpointType: MsgSetEndpointType =
		{
			newEndpointType: EndpointType.Utility,
		}

		this.sendMessage( MessageType.SetEndpointType, msgSetEndpointType );
	}


}


