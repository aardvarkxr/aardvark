import { EndpointAddr, MessageType } from '@aardvarkxr/aardvark-shared';
import { CAardvarkEndpoint } from "@aardvarkxr/aardvark-react";

import { WebSocket } from 'mock-socket';

( global as any).WebSocket = WebSocket;

jest.useFakeTimers();

it( "simple test", () =>
{
	let connected = false;
	let handshook = true;
	let ep = new CAardvarkEndpoint( ( settings: any, persistenceUuid: string ) =>
	{
		connected = true;
	}, 
	( settings: any, persistenceUuid: string ) =>
	{
		handshook = true;
	},
	( type: MessageType, payload: any, sender: EndpointAddr, target: EndpointAddr ) =>
	{
	});
	expect( true ).toBe( true );
})


