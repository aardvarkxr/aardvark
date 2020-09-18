import { vec3, mat4 } from '@tlaukkan/tsm';
import { WebAppManifest } from './web_app_manifest';
import { AvActionState } from './aardvark';
import { nodeTransformFromMat4 } from './math_utils';

export const AardvarkPort = 23842;

export enum MessageType
{
	// initialization messages. These are the only messages that 
	// aren't required to have a sender.
	SetEndpointType = 100,
	SetEndpointTypeResponse = 101,
	Error = 102,
	GetAardvarkManifest = 103,
	GetAardvarkManifestResponse = 104,
	//UserInfo = 105,

	// Monitor messages
	// these are send to monitors to give them meta context
	NewEndpoint = 200,
	LostEndpoint = 201,
	OverrideTransform = 202,

	// Gadget messages
	UpdateSceneGraph = 300,
	//GrabEvent = 301,
	//GrabberState = 302,
	GadgetStarted = 303,	
	//PokerProximity = 304,
	//MouseEvent = 305,
	NodeHaptic = 306,
	// AttachGadgetToHook = 307,
	// DetachGadgetFromHook = 308,
	//MasterStartGadget = 309, // tells master to start a gadget
	SaveSettings = 310,
	UpdateActionState = 311,
	DestroyGadget = 312,
	ResourceLoadFailed = 313,
	// SignRequest = 314,
	// SignRequestResponse = 315,
	InterfaceEvent = 316,

	// System messages
	GetInstalledGadgets = 400,
	GetInstalledGadgetsResponse = 401,
	InstallGadget = 402,

	// gadget has "room" permissions
	// CreateRoom = 600,
	// CreateRoomResponse = 601,
	// DestroyRoom = 602,
	// DestroyRoomResponse = 603,
	// RoomMessageReceived = 604,
	// RoomMessageReceivedResponse = 605,
	// SendRoomMessage = 606,
	// UpdatePose = 607,

	// Interfaces and interface entities
	InterfaceStarted = 700,
	InterfaceEnded = 701,
	InterfaceTransformUpdated = 702,
	InterfaceSendEvent = 703,
	InterfaceReceiveEvent = 704,
	InterfaceLock = 705,
	InterfaceLockResponse = 706,
	InterfaceUnlock = 707,
	InterfaceUnlockResponse = 708,
	InterfaceRelock = 709,
	InterfaceRelockResponse = 710,
	InterfaceSendEventResponse = 711,
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
	Utility = 5,
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

export function computeEndpointFieldUri( epa: EndpointAddr, fieldName: string )
{
	return `nodefield://${ endpointAddrToString( epa ) }/${ fieldName }`;
}

export interface Envelope
{
	type: MessageType;
	sequenceNumber: number;
	replyTo?: number;
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

export interface MsgGetAardvarkManifest
{
	gadgetUri: string;
}

export interface MsgGeAardvarkManifestResponse
{
	error?: string;
	manifest?: AardvarkManifest;
	gadgetUri?: string;
}


export interface MsgUpdateSceneGraph
{
	root?: AvNode;
	gadgetUrl?: string;
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
	startedGadgetEndpointId: number;
}


export interface MsgNodeHaptic
{
	nodeId: EndpointAddr;
	amplitude: number;
	frequency: number;
	duration: number;
}

export interface MsgInterfaceEvent
{
	destination: EndpointAddr;
	interface: string;
	data: object;
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

export interface MsgInstallGadget
{
	gadgetUri: string;
}


export interface MsgResourceLoadFailed
{
	nodeId: EndpointAddr;
	resourceUri: string;
	error: string;
}

// tx, ty, tz, rw, rx, ry, rz
export type MinimalPose = [ number, number, number, number, number, number, number ];


export interface MsgInterfaceStarted
{
	transmitter: EndpointAddr;
	receiver: EndpointAddr;
	iface: string;
	transmitterFromReceiver: AvNodeTransform;
	intersectionPoint?: AvVector;
	params?: object; // This will only be set for initial interface locks
}

export interface MsgInterfaceEnded
{
	transmitter: EndpointAddr;
	receiver: EndpointAddr;
	iface: string;
	transmitterFromReceiver?: AvNodeTransform;
	intersectionPoint?: AvVector;
}

export interface MsgInterfaceLock
{
	transmitter: EndpointAddr;
	receiver: EndpointAddr;
	iface: string;
}

export enum InterfaceLockResult
{
	Success = 0,
	AlreadyLocked = 1,
	NotLocked = 2,
	InterfaceNotFound = 3,
	InterfaceNameMismatch = 4,
	InterfaceReceiverMismatch = 5,
	NewReceiverNotFound = 6,
}

export interface MsgInterfaceLockResponse
{
	result: InterfaceLockResult;
}

export interface MsgInterfaceUnlock
{
	transmitter: EndpointAddr;
	receiver: EndpointAddr;
	iface: string;
}

export interface MsgInterfaceUnlockResponse
{
	result: InterfaceLockResult;
}

export interface MsgInterfaceRelock
{
	transmitter: EndpointAddr;
	oldReceiver: EndpointAddr;
	newReceiver: EndpointAddr;
	iface: string;
}

export interface MsgInterfaceRelockResponse
{
	result: InterfaceLockResult;
}

export interface MsgInterfaceTransformUpdated
{
	destination: EndpointAddr;
	peer: EndpointAddr;
	iface: string;
	destinationFromPeer: AvNodeTransform;
	intersectionPoint?: AvVector;
}

export interface MsgInterfaceSendEvent
{
	destination: EndpointAddr;
	peer: EndpointAddr;
	iface: string;
	event: object;
}

export interface MsgInterfaceSendEventResponse
{
}

export interface MsgInterfaceReceiveEvent
{
	destination: EndpointAddr;
	peer: EndpointAddr;
	iface: string;
	event: object;
	destinationFromPeer: AvNodeTransform;
	intersectionPoint?: AvVector;
}

export enum AvNodeType
{
	Invalid = -1,

	Container = 0,
	Origin = 1,
	Transform = 2,
	Model = 3,
	//Panel = 4,
	//Poker = 5,
	// Grabbable = 6,
	// Handle = 7,
	// Grabber = 8,
	// Hook = 9,
	Line = 10,
	//PanelIntersection = 11,
	ParentTransform = 12,
	HeadFacingTransform = 13,
	// RemoteUniverse = 14,
	// RemoteOrigin = 15,
	// RoomMember = 16,
	InterfaceEntity = 17,
	Child = 18,
}


export interface AvInterfaceEventProcessor
{
	( iface: string, sender: EndpointAddr, data: object ): void;
}

export function interfaceToString( transmitter: EndpointAddr, receiver: EndpointAddr, iface: string )
{
	return endpointAddrToString( transmitter ) + "->" + endpointAddrToString( receiver ) 
		+ "(" + iface + ")";
}

export function interfaceStringFromMsg( m: { transmitter: EndpointAddr, receiver: EndpointAddr, 
	iface: string } )
{
	return interfaceToString(m.transmitter, m.receiver, m.iface );
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
	Infinite = 3,
	Empty = 4,
	Ray = 5, // ray is always down the positive X axis from the origin
};

/** Volume context allows entities to specify volumes that
 * only apply to starting an interface, only apply to
 * continuing an interface, or always apply. 
 */
export enum EVolumeContext
{
	Always = 0,
	StartOnly = 1,
	ContinueOnly = 2,
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
	nodeFromVolume?: AvNodeTransform;
	context?: EVolumeContext;

	radius?: number;
	uri?: string;
	aabb?: AABB;
	scale?: number; // Scales radius or AABB (after model box is resolved)
}

export function emptyVolume(): AvVolume
{
	return { type: EVolumeType.Empty };
}
export function infiniteVolume(): AvVolume
{
	return { type: EVolumeType.Infinite };
}

export function rayVolume( start: vec3, dir: vec3 )
{
	let nodeFromVolume: mat4;

	let back: vec3;
	if( vec3.dot( vec3.up, dir ) > 0.999 )
	{
		back = vec3.forward;
	}
	else
	{
		back = vec3.cross( dir, vec3.up );
	}

	let up = vec3.cross( back, dir );

	nodeFromVolume = new mat4([
		dir.x,
		dir.y,
		dir.z,
		0,

		up.x,
		up.y,
		up.z,
		0,

		back.x,
		back.y,
		back.z,
		0,

		start.x, start.y, start.z, 1,
	] );

	return (
		{
			type: EVolumeType.Ray,
			nodeFromVolume: nodeTransformFromMat4( nodeFromVolume ),
		} as AvVolume );
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
	ShowGrabIndicator			= 1 << 7,
	Remote						= 1 << 8,
	HighlightHooks  			= 1 << 9,
}

export interface AvConstraint
{
	minX?: number;
	maxX?: number;
	minY?: number;
	maxY?: number;
	minZ?: number;
	maxZ?: number;
	gravityAligned?: boolean;
}

export interface AvColor
{
	r: number;
	g: number;
	b: number;
	a?: number;
}

export interface InitialInterfaceLock
{
	iface: string;
	receiver: EndpointAddr;
	params?: object;
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
	propUniverseName?: string;
	propTransform?: AvNodeTransform;
	propModelUri?: string;
	propVolume?: AvVolume;
	propOuterVolumeScale?: number;
	propVolumes?: AvVolume[];
	propPriority?: number;
	propParentAddr?: EndpointAddr;
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
	propInterfaces?: string[];
	propTransmits?: string[];
	propReceives?: string[];
	propInterfaceLocks?: InitialInterfaceLock[];
	propChildAddr?: EndpointAddr;
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

export interface AvRendererConfig
{
	enableMixedReality: boolean;
	mixedRealityFov: number;
	clearColor: [number, number, number];
}

export enum Permission
{
	Master = "master",
	SceneGraph = "scenegraph",
	Favorites = "favorites",
}

export interface AardvarkManifestExtension
{
	permissions: Permission[];
	browserWidth: number;
	browserHeight: number;
	startAutomatically: boolean;
}

export interface AardvarkManifest extends WebAppManifest
{
	xr_type: string;
	aardvark: AardvarkManifestExtension;
}



export enum EAction
{
	A = 0,
	B = 1,
	Squeeze = 2,
	Grab = 3,
	Detach = 4,
	GrabShowRay = 5,
	GrabMove = 6,
	Max
}

export function emptyActionState(): AvActionState
{
	return (
		{
			a: false, b:false, squeeze: false,
			grab: false, grabShowRay: false, detach: false,
			grabMove: [ 0, 0 ]
		} );
}


export function filterActionsForGadget( actionState: AvActionState ): AvActionState
{
	// Don't actually filter for now.
	return {
		...actionState,
	};
}

export function gadgetDetailsToId( gadgetName: string, gadgetUri: string, gadgetPersistenceUuid?: string )
{
	let filteredName = ( gadgetName + gadgetUri ).replace( /\W/g, "_" ).toLowerCase();
	if( filteredName.length > 24 )
	{
		filteredName = filteredName.substr( 0, 24 );
	}

	if( gadgetPersistenceUuid )
	{
		let keyToHash = gadgetUri + gadgetPersistenceUuid;
		let hash = 0;
		for ( let i = 0; i < keyToHash.length; i++) 
		{
			let char = keyToHash.charCodeAt(i);
			hash = ((hash<<5)-hash)+char;
			hash = hash & hash; // Convert to 32bit integer
		}
	
		filteredName += hash.toString( 16 );
	}

	return filteredName;
}

export function manifestUriFromGadgetUri( gadgetUri: string )
{
	if( gadgetUri.endsWith( "/" ) )
	{
		return gadgetUri + "manifest.webmanifest";
	}
	else
	{
		return gadgetUri + "/manifest.webmanifest";
	}
}