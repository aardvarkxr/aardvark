import { AvGadgetManifest, AvNode } from './../aardvark';

export enum MessageType
{
	// initialization messages. These are the only messages that 
	// aren't required to have a sender.
	SetEndpointType = 100,
	Error = 101,
	GetGadgetManifest = 102,
	GetGadgetManifestResponse = 103,

	// Monitor messages
	// these are send to monitors to give them meta context
	NewEndpoint = 200,
	LostEndpoint = 201,

	// Gadget messages
	UpdateSceneGraph = 300,
	

}

export enum EndpointType
{
	Unknown = -1,
	Hub = 0,
	Gadget = 1,
	Node = 2,
	Renderer = 3,
	Monitor = 4,
}

export interface EndpointAddr
{
	type: EndpointType;
	endpointId?: number;
	nodeId?: number;
}

export function endpointAddrToString( epa: EndpointAddr ) : string
{
	return EndpointType[ epa.type ] 
		+ ( epa.endpointId ? ":" + epa.endpointId : "" )
		+ ( epa.nodeId ? ":" + epa.nodeId : "" );
}

export function endpointAddrIsEmpty( epa: EndpointAddr ): boolean
{
	return epa == null || epa.type == undefined || epa.type == EndpointType.Unknown;
}

export function endpointAddrsMatch( epa1: EndpointAddr, epa2: EndpointAddr ): boolean
{
	if( endpointAddrIsEmpty( epa1 ) )
		return endpointAddrIsEmpty( epa2 );

	return epa1.type == epa2.type && epa1.nodeId == epa2.nodeId && epa1.endpointId == epa2.endpointId;
}

export interface Envelope
{
	type: MessageType;
	sender?: EndpointAddr;
	targets?: EndpointAddr[]; 
	payload?: string;
	payloadUnpacked?: any;
}

export interface MsgError
{
	messageType?: MessageType;
	error: string;
}

export interface MsgSetEndpointType
{
	newEndpointType: EndpointType;
	gadgetUri?: string;
	initialHook?: string;
}

export interface MsgNewEndpoint
{
	newEndpointType: EndpointType;
	endpointId: number;
	gadgetUri?: string;
}

export interface MsgLostEndpoint
{
	endpointId: number;
}

export interface MsgGetGadgetManifest
{
	gadgetUri: string;
}

export interface MsgGetGadgetManifestResponse
{
	error?: string;
	manifest?: AvGadgetManifest;
}


export interface MsgUpdateSceneGraph
{
	root?: AvNode;
	hook?: string;
}

export function parseEnvelope( envString: string, parsePayload: boolean = true ): Envelope
{
	try
	{
		let env = JSON.parse( envString ) as Envelope;
		if( env.payload && parsePayload )
		{
			env.payloadUnpacked = JSON.parse( env.payload );
		}
		return env;
	}
	catch( e )
	{
		console.log( "failed to parse envelope", envString, e );
		return null;
	}
}

