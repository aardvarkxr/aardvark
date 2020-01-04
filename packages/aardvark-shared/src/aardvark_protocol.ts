import { AvActionState } from './aardvark';

export const AardvarkPort = 23842;

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
	UpdateActionState = 311,
	DestroyGadget = 312,
	ResourceLoadFailed = 313,

	// System messages
	GetInstalledGadgets = 400,
	GetInstalledGadgetsResponse = 401,
}

export enum WebSocketCloseCodes
{
	UserDestroyedGadget = 4701,
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
	if( !epa )
	{
		return null;
	}
	else
	{
		return endpointCharacterFromType( epa.type )
		+ ":" + ( epa.endpointId ? epa.endpointId : 0 )
		+ ":" + ( epa.nodeId ? epa.nodeId : 0 );
	}
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
		return false;

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
	persistenceUuid?: string;
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
	hookFromGadget?: AvNodeTransform;
}

export enum EHookVolume
{
	Inner = 0,
	Outer = 1,
}

export interface GrabberHookState
{
	hookId: EndpointAddr;
	whichVolume: EHookVolume;
}

export interface MsgGrabberState
{
	grabberId: EndpointAddr;
	hand: EHand;
	grabbables?: AvGrabbableCollision[];
	hooks?: GrabberHookState[];
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
	mainHandle?: number;
	mainGrabbableGlobalId?: EndpointAddr;
	mainHandleGlobalId?: EndpointAddr;
}


export interface MsgPokerProximity
{
	pokerId: EndpointAddr;
	hand: EHand;
	actionState: AvActionState;
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
	hookFromGrabbable?: AvNodeTransform;
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

export interface MsgUpdateActionState
{
	gadgetId: number;
	hand: EHand;
	actionState: AvActionState;
}

export interface MsgOverrideTransform
{
	nodeId: EndpointAddr;
	transform: AvNodeTransform;
}


export interface MsgGetInstalledGadgets
{
}

export interface MsgGetInstalledGadgetsResponse
{
	installedGadgets: string[];
}

export interface MsgDestroyGadget
{
	gadgetId: number;
}

export interface MsgResourceLoadFailed
{
	nodeId: EndpointAddr;
	resourceUri: string;
	error: string;
}

export interface PokerProximity
{
	panelId: EndpointAddr;
	x: number;
	y: number;
	distance: number;
}

export enum AvNodeType
{
	Invalid = -1,

	Container = 0,
	Origin = 1,
	Transform = 2,
	Model = 3,
	Panel = 4,
	Poker = 5,
	Grabbable = 6,
	Handle = 7,
	Grabber = 8,
	Hook = 9,
	Line = 10,
	PanelIntersection = 11,
}


export enum AvPanelMouseEventType
{
	Unknown = 0,
	Down = 1,
	Up = 2,
	Enter = 3,
	Leave = 4,
	Move = 5,
};

export interface AvPanelMouseEvent
{
	type: AvPanelMouseEventType;
	panelId: EndpointAddr;
	pokerId: EndpointAddr;
	x: number;
	y: number;
}

export interface AvPanelHandler
{
	( event: AvPanelMouseEvent ): void;
}

export enum AvGrabEventType
{
	Unknown = 0,
	EnterRange = 1,
	LeaveRange = 2,
	StartGrab = 3,
	EndGrab = 4,
	EnterHookRange = 5,
	LeaveHookRange = 6,
	RequestGrab = 7,
	RequestGrabResponse = 8,
	CancelGrab = 9,
	GrabStarted = 10,
	UpdateGrabberHighlight = 11,
	TransformUpdated = 12,
	Detach = 13,
};

export enum GrabberHighlight
{
	None = 0,
	InRange = 1,
	WaitingForConfirmation = 2,
	WaitingForGrabToStart = 3,
	Grabbed = 4,
	NearHook = 5,
	WaitingForReleaseAfterRejection = 6,
}

export interface AvGrabEvent
{
	type: AvGrabEventType;
	senderId?: number;
	grabbableId?: EndpointAddr;
	handleId?: EndpointAddr;
	grabberId?: EndpointAddr;
	hookId?: EndpointAddr;
	requestId?: number;
	allowed?: boolean;
	useIdentityTransform?: boolean;
	highlight?: GrabberHighlight;
	parentFromNode?: AvNodeTransform;
	universeFromNode?: AvNodeTransform;
	hookFromGrabbable?: AvNodeTransform;
}

export interface AvGrabEventProcessor
{
	( event: AvGrabEvent ): void;
}

export interface AvGrabbableCollision
{
	grabbableId: EndpointAddr;
	handleId: EndpointAddr;
	handleFlags: number;
	grabbableFlags: number;
}

export interface AvVector
{
	x: number;
	y: number;
	z: number;
}

export interface AvQuaternion
{
	x: number;
	y: number;
	z: number;
	w: number;
}

export interface AvNodeTransform
{
	position?: AvVector;
	rotation?: AvQuaternion;
	scale?: AvVector;
}

export enum EVolumeType
{
	Invalid = -1,

	Sphere = 0,
	ModelBox = 1,
	AABB = 1,
};


export interface AABB
{
	xMin: number;
	xMax: number;
	yMin: number;
	yMax: number;
	zMin: number;
	zMax: number;
}

export interface AvVolume
{
	type: EVolumeType;

	radius?: number;
	uri?: string;
	aabb?: AABB;
}

export enum ENodeFlags
{
	Visible 					= 1 << 0,
	PreserveGrabTransform 		= 1 << 1,
	NotifyOnTransformChange		= 1 << 2,
	NotifyProximityWithoutGrab 	= 1 << 3,
	AllowDropOnHooks  			= 1 << 4,
	AllowMultipleDrops			= 1 << 5,
	Tethered					= 1 << 6,
}

export interface AvConstraint
{
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
	minZ: number;
	maxZ: number;
}

export interface AvColor
{
	r: number;
	g: number;
	b: number;
	a?: number;
}

export interface AvNode
{
	type: AvNodeType;
	id: number;
	persistentName?: string;
	globalId?: EndpointAddr;
	flags: ENodeFlags;
	children?: AvNode[];

	propOrigin?: string;
	propTransform?: AvNodeTransform;
	propModelUri?: string;
	propVolume?: AvVolume;
	propOuterVolumeScale?: number;
	propInteractive?: boolean;
	propCustomNodeType?: string;
	propSharedTexture?: AvSharedTextureInfo;
	propConstraint?: AvConstraint;
	propColor?: AvColor;
	propEndAddr?: EndpointAddr;
	propThickness?: number;
	propStartGap?: number;
	propEndGap?: number;
	propScaleToFit?: AvVector;
}

export enum EHand
{
	Invalid = -1,
	Left = 0,
	Right = 1,
};

enum ETextureType
{
	Invalid = 0,
	D3D11Texture2D = 1,
}

enum ETextureFormat
{
	R8G8B8A8 = 1,
	B8G8R8A8 = 2,
}

export interface AvSharedTextureInfo
{
	dxgiHandle?: string;
	type: ETextureType;
	format: ETextureFormat;
	invertY?: boolean;
	width: number;
	height: number;
}

export interface AvGadgetManifest
{
	name: string;
	permissions: string[];
	width: number;
	height: number;
	model: string;
	startAutomatically: boolean;
}


export enum EAction
{
	A = 0,
	B = 1,
	Squeeze = 2,
	Grab = 3,
	Detach = 4,
	Max
}

export function getActionFromState( action: EAction, state: AvActionState): boolean
{
	if( !state )
		return false;

	switch( action )
	{
		case EAction.A: return state.a;
		case EAction.B: return state.b;
		case EAction.Grab: return state.grab;
		case EAction.Squeeze: return state.squeeze;
		case EAction.Detach: return state.detach;
		default: return false;
	}
}

export function emptyActionState(): AvActionState
{
	return (
		{
			a: false, b:false, squeeze: false,
			grab: false, detach: false
		} );
}


export function filterActionsForGadget( actionState: AvActionState ): AvActionState
{
	return {
		a: actionState.a,
		b: actionState.b,
		squeeze: actionState.squeeze,
	};
}

