import { EndpointAddr, MessageType, AardvarkPort, MsgSetEndpointType, EndpointType, Envelope, MsgSetEndpointTypeResponse } from '@aardvarkxr/aardvark-shared';
import { CAardvarkEndpoint } from "@aardvarkxr/aardvark-react";
import { WS  } from 'jest-websocket-mock';
import { WebSocket } from 'mock-socket';

( global as any).WebSocket = WebSocket;

jest.useRealTimers();

let server: WS = null;

beforeEach( async() =>
{
	server = new WS( "ws://localhost:" + AardvarkPort, { jsonProtocol: true } );

	let endpointId = 123;

	server.connected.then( async () =>
	{
		let nextSequence = 394;
		let sendMessage = ( type: MessageType, payload: any, replyTo?: Envelope ) =>
		{
			let env: Envelope =
			{
				type: type,
				sequenceNumber: nextSequence++,
				payload: JSON.stringify( payload ),
			}

			if( replyTo )
			{
				env.target = replyTo.sender;
				env.replyTo = replyTo.sequenceNumber;
			}

			server.send( env );
		}

		while( true )
		{
			let env: Envelope = await server.nextMessage as Envelope;
			switch( env.type )
			{
				case MessageType.SetEndpointType:
					{
						let msgSetEndpointTypeResponse: MsgSetEndpointTypeResponse =
						{
							endpointId: endpointId++,
						}
						
						sendMessage( MessageType.SetEndpointTypeResponse, msgSetEndpointTypeResponse, env );
					}
					break;
			}

		}
	})
} );

afterEach( () =>
{
	server = null;
	WS.clean();
} );

describe( "CAardvarkEndpoint ", () =>
{
	it( "connect", async () =>
	{
		let connected = false;
		let ep = new CAardvarkEndpoint( () =>
			{
				connected = true;
			}, 
			null, null );
	
		await server.connected;
		expect( connected ).toBe( true );
	} );

	it( "handshake", async () =>
	{
		let handshookPromise = new Promise ( ( resolve, reject ) =>
		{
			let ep = new CAardvarkEndpoint( ( settings: any, persistenceUuid: string ) =>
			{
				let msgSetEndpointType: MsgSetEndpointType =
				{
					newEndpointType: EndpointType.Utility,
				}

				ep.sendMessage( MessageType.SetEndpointType, msgSetEndpointType );
			}, 
			() => { resolve() }, null );
		} );

		await handshookPromise;
	} );

} );



