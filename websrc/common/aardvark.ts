import { EndpointAddr, MsgGrabberState } from './aardvark-react/aardvark_protocol';

export interface PokerProximity
{
	panelId: string;
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
}

interface AvSceneContext_SetTextureSource
{
	(textureSource:string):void;
}

export interface AvSceneContext
{
	//finish: AvSceneContext_Finish;
	// startNode: AvSceneContext_StartNode;
	// finishNode: AvSceneContext_FinishNode;
	// setOriginPath: AvSceneContext_SetOriginPath;
	// setTranslation: AvSceneContext_SetTranslation;
	// setScale: AvSceneContext_SetScale;
	// setUniformScale: AvSceneContext_SetUniformScale;
	// setRotationEulerDegrees: AvSceneContext_SetRotationEulerDegrees;
	// setModelUri: AvSceneContext_SetModelUri;
	setTextureSource: AvSceneContext_SetTextureSource;
	//setInteractive: AvSceneContext_SetInteractive;
	//setSphereVolume( radius: number ): void;
	//startCustomNode( nodeId: number, name: string, customNodeType: string ): void;
}

interface AvGadget_GetName
{
	():string;
}

interface AvGadget_StartSceneContext
{
	():AvSceneContext;
}

export interface AvPokerHandler
{
	( proximity: PokerProximity[] ): void;
}

interface AvGadget_RegisterPokerHandler
{
	( nodeId:number, handlerFunction: AvPokerHandler ): void;
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
	panelId: string;
	pokerId: string;
	x: number;
	y: number;
}

interface AvGadget_SendMouseEvent
{
	(pokerId: number, panelId:string, type: AvPanelMouseEventType, x:number, y:number ): void;
}

export interface AvPanelHandler
{
	( event: AvPanelMouseEvent ): void;
}

interface AvGadget_RegisterPanelHandler
{
	( nodeId:number, handlerFunction: AvPanelHandler ): void;
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
};

export interface AvGrabEvent
{
	type: AvGrabEventType;
	senderId?: number;
	grabbableId?: EndpointAddr;
	grabberId?: EndpointAddr;
	hookId?: EndpointAddr;
	requestId?: number;
	allowed?: boolean;
	useIdentityTransform?: boolean;
}

export interface AvGrabEventProcessor
{
	( event: AvGrabEvent ): void;
}

export interface AvGrabberProcessor
{
	( isPressed: boolean, grabbableIds: EndpointAddr[], hookIds: EndpointAddr[] ): void;
}

export interface AvGadgetObj
{
	getName: AvGadget_GetName;
	startSceneContext: AvGadget_StartSceneContext;
	registerPokerHandler: AvGadget_RegisterPokerHandler;
	registerPanelHandler: AvGadget_RegisterPanelHandler;
	enableDefaultPanelHandling( panelId: number ): void;
	sendHapticEventFromPanel( panelId: number, amplitude: number, frequency: number, duration: number ): void;
	sendMouseEvent: AvGadget_SendMouseEvent;
	registerGrabbableProcessor( nodeId: number, processor: AvGrabEventProcessor ): void;
	registerGrabberProcessor( nodeId: number, processor: AvGrabberProcessor ): void;
	sendGrabEvent( event: AvGrabEvent ): void;
}

interface Av_CreateGadget
{
	(gadgetName:string):AvGadgetObj;
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
};


export interface AvVolume
{
	type: EVolumeType;

	radius?: number;
}


export interface AvNode
{
	type: AvNodeType;
	id: number;
	globalId?: EndpointAddr;
	flags: number;
	children?: AvNode[];

	propOrigin?: string;
	propTransform?: AvNodeTransform;
	propModelUri?: string;
	propVolume?: AvVolume;
	propInteractive?: boolean;
	propCustomNodeType?: string;
	propSharedTexture?: AvSharedTextureInfo;
}


export interface AvNodeRoot
{
	gadgetId: number;
	root: AvNode;
	hook?: string;
}

export interface AvVisualFrame
{
	id: string;
	nodeRoots: AvNodeRoot[];
}

export interface AvTraversalFrameProcessor
{
	( frame: AvVisualFrame ): void;
}

export interface AvTraversalRenderer
{
	(): void;
}
export interface AvHapticProcessor
{
	( globalNodeId: string, amplitude: number, frequence: number, duration: number ): void;
}

export interface AvModelInstance
{
	setUniverseFromModelTransform( universeFromModel: number[] ): void;
	setOverrideTexture( textureInfo: AvSharedTextureInfo ): void;
}

export enum EHand
{
	Invalid = 0,
	Left = 1,
	Right = 2,
};


interface AvRenderer
{
	registerSceneProcessor( sceneProcessor: AvTraversalFrameProcessor ): void;
	registerTraverser( traverser: AvTraversalRenderer ): void;
	renderList( renderList: AvModelInstance[] ): void,
	createModelInstance( uri: string): AvModelInstance;
	addToRenderList( modelInstance: AvModelInstance ): void;
	getUniverseFromOriginTransform( origin: string ): number[];

	registerHapticProcessor( hapticProcessor: AvHapticProcessor ) : void;
	sendHapticEventForHand( hand: EHand, amplitude: number, frequency: number, duration: number ): void;

	addActivePanel( panelGlobalId: string, nodeFromUniverse: number[], zScale: number, hand: EHand  ): void;
	addActivePoker( pokerGlobalId: string, pokerInUniverse: number[], hand: EHand  ): void;

	updateGrabberIntersections(): MsgGrabberState[];
	registerGrabEventProcessor( grabEventProcessor: AvGrabEventProcessor ): void;
	addGrabbableHandle_Sphere( grabbableGlobalId: EndpointAddr, universeFromGrabbable: number[], radius: number, hand: EHand ): void;
	addGrabber_Sphere( grabberGlobalId: EndpointAddr, universeFromGrabber: number[], radius: number, hand: EHand ): void;
	addHook_Sphere( hookGlobalId: EndpointAddr, universeFromGrabber: number[], radius: number, hand: EHand  ): void;

	startGrab( grabberGlobalId: EndpointAddr, grabbableGlobalId: EndpointAddr  ): void;
	endGrab( grabberGlobalId: EndpointAddr, grabbableGlobalId: EndpointAddr  ): void;
}

export interface AvStartGadgetCallback
{
	(success: boolean, mainGrabbableGlobalId: EndpointAddr ) : void;
}

export interface AvGadgetManifest
{
	name: string;
	permissions: string[];
	width: number;
	height: number;
	modelUri: string;
}

export interface AvGadgetManifestCallback
{
	(manifest: AvGadgetManifest) : void;
}

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

export interface AvBrowserTextureCallback
{
	( textureInfo: AvSharedTextureInfo ): void;
}

export interface Aardvark
{
	// requires scenegraph permissions
//	createGadget: Av_CreateGadget;
	subscribeToBrowserTexture( callback: AvBrowserTextureCallback ): void;

	// requires master permissions
	startGadget( uri: string, initialHook: string, epToNotify: EndpointAddr ): void;
	getGadgetManifest( uri: string, callback: AvGadgetManifestCallback ): void;

	// requires renderer permissions
	renderer: AvRenderer;
}

declare global
{
	interface Window
	{
		aardvark: any;
	}
}

export function Av():Aardvark
{
	return window.aardvark as Aardvark;
}
