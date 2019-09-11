import { AvTransform } from 'common/aardvark-react/aardvark_transform';
import { AvPanelMouseEvent, EHand } from 'common/aardvark';
import { AvGadgetManifest, AvNode, AvGrabEvent, PokerProximity, AvNodeTransform } from './../aardvark';

export enum MessageType
{
	// initialization messages. These are the only messages that 
	// aren't required to have a sender.
	SetEndpointType = 100,
	SetEndpointTypeResponse = 101,
	Error = 102,
	GetGadgetManifest = 103,
	GetGadgetManifestResponse = 104,
	
	// Monitor messages
	// these are send to monitors to give them meta context
	NewEndpoint = 200,
	LostEndpoint = 201,
	OverrideTransform = 202,

	// Gadget messages
	UpdateSceneGraph = 300,
	GrabEvent = 301,
	GrabberState = 302,
	GadgetStarted = 303,	
	PokerProximity = 304,
	MouseEvent = 305,
	NodeHaptic = 306,
	AttachGadgetToHook = 307,
	DetachGadgetFromHook = 308,
	MasterStartGadget = 309, // tells master to start a gadget
	SaveSettings = 310,
	SetEditMode = 311,
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

function endpointTypeFromCharacter( c: string ): EndpointType
{
	switch( c )
	{
		case "H": return EndpointType.Hub;
		case "G": return EndpointType.Gadget;
		case "N": return EndpointType.Node;
		case "M": return EndpointType.Monitor;
		case "R": return EndpointType.Renderer;
		default: return EndpointType.Unknown;
	}
}

function endpointCharacterFromType( ept: EndpointType ): string
{
	switch( ept )
	{
		case EndpointType.Hub: return "H";
		case EndpointType.Gadget: return "G";
		case EndpointType.Node: return "N";
		case EndpointType.Monitor: return "M";
		case EndpointType.Renderer: return "R";
		case EndpointType.Unknown: return "U";
		default: return "?";
	}
}

export function endpointAddrToString( epa: EndpointAddr ) : string
{
	return endpointCharacterFromType( epa.type )
		+ ":" + ( epa.endpointId ? epa.endpointId : 0 )
		+ ":" + ( epa.nodeId ? epa.nodeId : 0 );
}


export function stringToEndpointAddr( epaStr: string ) : EndpointAddr
{
	let re = new RegExp( "^(.):([0-9]+):([0-9]+)$" );
	let match = re.exec( epaStr );
	if( !match )
	{
		console.log( `endpoint string ${ epaStr } failed to parse` );
		return null;
	}
	return (
		{ 
			type: endpointTypeFromCharacter( match[1] ),
			endpointId: parseInt( match[2] ),
			nodeId: parseInt( match[3] ),
		} );
}

export function endpointAddrIsEmpty( epa: EndpointAddr ): boolean
{
	return epa == null || epa.type == undefined || epa.type == EndpointType.Unknown;
}

export function endpointAddrsMatch( epa1: EndpointAddr, epa2: EndpointAddr ): boolean
{
	if( endpointAddrIsEmpty( epa1 ) )
		return endpointAddrIsEmpty( epa2 );
	else if( endpointAddrIsEmpty( epa2 ) )
		return true;

	return epa1.type == epa2.type && epa1.nodeId == epa2.nodeId && epa1.endpointId == epa2.endpointId;
}

export function indexOfEndpointAddrs( epaArray: EndpointAddr[], epa: EndpointAddr ): number
{
	if( !epaArray )
	{
		return -1;
	}
	
	for( let i = 0; i < epaArray.length; i++ )
	{
		if( endpointAddrsMatch( epaArray[i], epa ) )
		{
			return i;
		}
	}
	return -1;
}

export interface Envelope
{
	type: MessageType;
	sender?: EndpointAddr;
	target?: EndpointAddr; 
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
	persistenceUuid?: string;
}

export interface MsgSetEndpointTypeResponse
{
	endpointId: number;
	settings?: any;
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
	gadgetUri?: string;
}


export interface MsgUpdateSceneGraph
{
	root?: AvNode;
	hook?: string|EndpointAddr;
}

export interface MsgGrabberState
{
	grabberId: EndpointAddr;
	isPressed: boolean;
	grabbables?: EndpointAddr[];
	hooks?: EndpointAddr[];
}

export interface MsgGrabEvent
{
	event: AvGrabEvent;
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

export interface MsgGadgetStarted
{
	epToNotify: EndpointAddr;
	mainGrabbable?: number;
	mainGrabbableGlobalId?: EndpointAddr;
}


export interface MsgPokerProximity
{
	pokerId: EndpointAddr;
	panels: PokerProximity[];
}

export interface MsgMouseEvent
{
	event: AvPanelMouseEvent;
}

export interface MsgNodeHaptic
{
	nodeId: EndpointAddr;
	amplitude: number;
	frequency: number;
	duration: number;
}

export interface MsgAttachGadgetToHook
{
	grabbableNodeId: EndpointAddr;
	hookNodeId: EndpointAddr;
}

export interface MsgDetachGadgetFromHook
{
	grabbableNodeId: EndpointAddr;
	hookNodeId: EndpointAddr;
}

export interface MsgMasterStartGadget
{
	uri: string;
	initialHook: string;
	persistenceUuid: string;
}

export interface MsgSaveSettings
{
	settings: any;
}

export interface MsgSetEditMode
{
	nodeId: EndpointAddr;
	hand: EHand;
	editMode: boolean;
}

export interface MsgOverrideTransform
{
	nodeId: EndpointAddr;
	transform: AvNodeTransform;
}
