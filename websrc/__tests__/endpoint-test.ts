import { EndpointAddr, MessageType, AardvarkPort, MsgSetEndpointType, EndpointType, Envelope, MsgSetEndpointTypeResponse } from '@aardvarkxr/aardvark-shared';
import { CAardvarkEndpoint } from "@aardvarkxr/aardvark-react";
import { WS  } from 'jest-websocket-mock';
import { WebSocket } from 'mock-socket';
import { resolve } from 'dns';

( global as any).WebSocket = WebSocket;

//jest.useFakeTimers();
jest.useRealTimers();

let server: WS = null;

beforeEach( async() =>
{
	server = new WS( "ws://localhost:" + AardvarkPort, { jsonProtocol: true } );

	let endpointId = 123;

	server.connected.then( async () =>
	{
		while( true )
		{
			let msg: Envelope = await server.nextMessage as Envelope;
			switch( msg.type )
			{
				case MessageType.SetEndpointType:
					{
						let msgSetEndpointTypeResponse: MsgSetEndpointTypeResponse =
						{
							endpointId: endpointId++,
						}
						
						let env: Envelope =
						{
							type: MessageType.SetEndpointTypeResponse,
							payload: JSON.stringify( msgSetEndpointTypeResponse ),
						}
						server.send( env );
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



