import { AvNode, EndpointAddr, InterfaceLockResult, MessageType, EHand } from '@aardvarkxr/aardvark-shared';



export interface Traverser
{
	init(): Promise<void>;
	updateSceneGraph( rootNode: AvNode, gadgetUrl: string, origin: string, userAgent: string, 
		gadgetId: number ): void;
	forgetGadget( gadgetId: number ): void;
	traverse(): void;

	getHandForEpa( epa: EndpointAddr ): EHand;

	interfaceLock( transmitter: EndpointAddr, receiver: EndpointAddr, iface: string ): InterfaceLockResult;
	interfaceUnlock( transmitter: EndpointAddr, receiver: EndpointAddr, iface: string ): 
		[ InterfaceLockResult, () => void ];
	interfaceRelock( transmitterEpa: EndpointAddr, oldReceiverEpa: EndpointAddr, 
		newReceiverEpa: EndpointAddr, iface: string ): InterfaceLockResult;
	interfaceSendEvent( destEpa: EndpointAddr, peerEpa: EndpointAddr, iface: string, event: object ): void;
}

export interface TraverserCallbacks
{
	sendMessage( type: MessageType, m: object ): void;
}

