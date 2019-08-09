
export enum MessageType
{
	// initialization messages. These are the only messages that 
	// aren't required to have a sender.
	SetEndpointType = 100,

	// Monitor messages
	// these are send to monitors to give them meta context
	NewEndpoint = 200,
	LostEndpoint = 201,

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

export interface Endpoint
{
	type: EndpointType;
	endpointId?: number;
	nodeId?: number;
}

export interface Envelope
{
	type: MessageType;
	sender?: Endpoint;
	targets?: Endpoint[]; 
	payload?: string;
	payloadUnpacked?: any;
}

export interface MsgSetEndpointType
{
	newEndpointType: EndpointType;
}

export interface MsgNewEndpoint
{
	newEndpointType: EndpointType;
	endpointId: number;
}

export interface MsgLostEndpoint
{
	endpointId: number;
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

