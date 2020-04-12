import { EndpointAddr, MessageType, AardvarkPort, MsgSetEndpointType, EndpointType, Envelope, MsgSetEndpointTypeResponse, MsgGetGadgetManifest, MsgGetGadgetManifestResponse } from '@aardvarkxr/aardvark-shared';
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
			env.payloadUnpacked = JSON.parse( env.payload );
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

				case MessageType.GetGadgetManifest:
					{
						let m = env.payloadUnpacked as MsgGetGadgetManifest;
						let r: MsgGetGadgetManifestResponse = { gadgetUri: m.gadgetUri };
						if( m.gadgetUri == "http://fail.com" )
						{
							r.error = "Intentional Failure";
						}
						else
						{
							r.manifest =
							{
								name: "Fred",
								permissions: [],
								width: 16,
								height: 16,
								model: "http://somewhere.com/model.glb",
								startAutomatically: false,
							}
						}

						sendMessage( MessageType.GetGadgetManifestResponse, r, env );
					}
					break;

				case MessageType.CreateRoom:
					{
						sendMessage( MessageType.CreateRoom, {} );
						sendMessage( MessageType.SendRoomMessage, {} );
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

function createEndpoint( ept: EndpointType )
{
	let ep = new CAardvarkEndpoint( null, null, null );
	let msgSetEndpointType: MsgSetEndpointType =
	{
		newEndpointType: ept,
	}

	ep.sendMessage( MessageType.SetEndpointType, msgSetEndpointType );
	return ep;
}

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

	it( "GetGadgetManifest success", async () =>
	{
		let ep = createEndpoint( EndpointType.Utility );
		let manifest = await ep.getGadgetManifest( "http://success.com" );

		expect( manifest ).toBeTruthy();
	} );

	it( "GetGadgetManifest fail", async () =>
	{
		let ep = createEndpoint( EndpointType.Utility );
		return expect( ep.getGadgetManifest( "http://fail.com" ) ).rejects.toBe(
			'Intentional Failure',
		  );
	} );

	it( "serializing async message handlers", async () =>
	{
		let ep = createEndpoint( EndpointType.Utility );

		let phase = 1;
		let done1 = new Promise( ( resolve, reject )=>
		{
			ep.registerAsyncHandler( MessageType.CreateRoomResponse, async ( msg: object ) =>
				{
					phase++;
					await new Promise( resolve => setTimeout( resolve, 500));
					phase++;
					resolve();
				} );
		} );
		let done2 = new Promise( ( resolve, reject )=>
		{
			ep.registerHandler( MessageType.SendRoomMessage, ( msg: object ) =>
			{
				expect( phase ).toBe( 3 );
				phase++;
				resolve();
			} );
		});

		ep.sendMessage( MessageType.CreateRoom, {} );
		await Promise.all( [ done1, done2 ] );
		expect( phase ).toBe( 4 );
	} );

} );



