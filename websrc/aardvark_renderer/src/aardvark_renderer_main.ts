import { CRendererEndpoint } from '@aardvarkxr/aardvark-react';
import { Av, AvRendererConfig, MessageType, MsgUpdateSceneGraph, Envelope, MsgLostEndpoint, MsgNodeHaptic, EHand, MsgInterfaceSendEvent, MsgInterfaceSendEventResponse, EndpointType, MsgInterfaceLock, MsgInterfaceLockResponse, MsgInterfaceUnlockResponse, MsgInterfaceRelock, MsgInterfaceRelockResponse } from '@aardvarkxr/aardvark-shared';
import { AvDefaultTraverser } from './aardvark_traverser';
import { TraverserCallbacks } from './traverser_interface';
import { initSentryForBrowser } from 'common/sentry_utils';

initSentryForBrowser();

let rendererEndpoint = new CRendererEndpoint( ( config: AvRendererConfig ) =>
	{
		Av().renderer.setRendererConfig( JSON.stringify( config ) );
	} );

let traverserCallbacks: TraverserCallbacks =
{
	sendMessage: ( type: MessageType, m: object ) =>
	{
		rendererEndpoint.sendMessage( type, m );
	}
};

let traverser = new AvDefaultTraverser( traverserCallbacks, Av().renderer );

rendererEndpoint.registerHandler( MessageType.UpdateSceneGraph, 
	( m: MsgUpdateSceneGraph, env: Envelope ) =>
	{
		if( !m.root )
		{
			traverser.forgetGadget( env.sender.endpointId );
		}
		else
		{
			traverser.updateSceneGraph( m.root, m.gadgetUrl, env.sender.endpointId );
		}
	} );

rendererEndpoint.registerHandler( MessageType.LostEndpoint, 
	( m: MsgLostEndpoint ) =>
	{
		traverser.forgetGadget( m.endpointId );
	} );

rendererEndpoint.registerHandler( MessageType.NodeHaptic, 
	( m: MsgNodeHaptic ) =>
	{
		let hand = traverser.getHandForEpa( m.nodeId );
		if( hand != EHand.Invalid )
		{
			Av().renderer.sendHapticEventForHand( hand, m.amplitude, m.frequency, m.duration );
		}
	} );

rendererEndpoint.registerHandler( MessageType.InterfaceSendEvent, 
	( m: MsgInterfaceSendEvent, env: Envelope ) =>
	{
		traverser.interfaceSendEvent( m.destination, m.peer, m.iface, m.event );
		let response: MsgInterfaceSendEventResponse =
		{
		};
		rendererEndpoint.sendReply(MessageType.InterfaceSendEventResponse, response, env, 
			{ type: EndpointType.Renderer } );
	} );

rendererEndpoint.registerHandler( MessageType.InterfaceLock, 
	( m: MsgInterfaceLock, env: Envelope ) =>
	{
		let result = traverser.interfaceLock( m.transmitter, m.receiver, m.iface );
		let response: MsgInterfaceLockResponse =
		{
			result,
		};
		rendererEndpoint.sendReply(MessageType.InterfaceLockResponse, response, env, 
			{ type: EndpointType.Renderer } );
	} );

rendererEndpoint.registerHandler( MessageType.InterfaceUnlock, 
	( m: MsgInterfaceLock, env: Envelope ) =>
	{
		let result = traverser.interfaceUnlock( m.transmitter, m.receiver, m.iface );
		let response: MsgInterfaceUnlockResponse =
		{
			result,
		};
		rendererEndpoint.sendReply(MessageType.InterfaceUnlockResponse, response, env, 
			{ type: EndpointType.Renderer } );
	} );

rendererEndpoint.registerHandler( MessageType.InterfaceRelock,
	( m: MsgInterfaceRelock, env: Envelope ) =>
	{
		let result = traverser.interfaceRelock( m.transmitter, m.oldReceiver, m.newReceiver, m.iface );
		let response: MsgInterfaceRelockResponse =
		{
			result,
		};
		rendererEndpoint.sendReply(MessageType.InterfaceRelockResponse, response, env, 
			{ type: EndpointType.Renderer } );
	} );

traverser.init( )
.then( () =>
{
	Av().renderer.registerTraverser( traverser.traverse );

	// Always draw some hands
	Av().startGadget( 
		{
			uri: "http://localhost:23842/gadgets/default_hands", 
			initialInterfaces: "", 
		} );

	// Provide messagebox services
	Av().startGadget( 
		{
			uri: "http://localhost:23842/gadgets/messagebox", 
			initialInterfaces: "", 
		} );
} );

