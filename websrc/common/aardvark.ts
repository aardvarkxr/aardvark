
export interface PokerProximity
{
	panelId: string;
	x: number;
	y: number;
	distance: number;
}

interface AvSceneContext_Finish
{
	():void;
}

export enum AvNodeType
{
	Container = 1,
	Origin = 1,
	Transform = 2,
	Model = 3,
	Panel = 4,
	Poker = 5,
	Grabbable = 6,
	Handle = 7,
	Grabber = 8,
}

interface AvSceneContext_StartNode
{
	( nodeId: number, nodeName: string, nodeType:AvNodeType):void;
}

interface AvSceneContext_FinishNode
{
	():void;
}

interface AvSceneContext_SetOriginPath
{
	( path: string ): void;
}

interface AvSceneContext_SetTranslation
{
	( x: number, y: number, z: number ):void;
}

interface AvSceneContext_SetScale
{
	( x: number, y: number, z: number ):void;
}

interface AvSceneContext_SetUniformScale
{
	( scale: number ):void;
}

interface AvSceneContext_SetRotationEulerDegrees
{
	( yaw:number, pitch:number, roll:number):void;
}

interface AvSceneContext_SetModelUri
{
	(modelUri:string):void;
}

interface AvSceneContext_SetTextureSource
{
	(textureSource:string):void;
}

interface AvSceneContext_SetInteractive
{
	(interactive:boolean):void;
}

export interface AvSceneContext
{
	finish: AvSceneContext_Finish;
	startNode: AvSceneContext_StartNode;
	finishNode: AvSceneContext_FinishNode;
	setOriginPath: AvSceneContext_SetOriginPath;
	setTranslation: AvSceneContext_SetTranslation;
	setScale: AvSceneContext_SetScale;
	setUniformScale: AvSceneContext_SetUniformScale;
	setRotationEulerDegrees: AvSceneContext_SetRotationEulerDegrees;
	setModelUri: AvSceneContext_SetModelUri;
	setTextureSource: AvSceneContext_SetTextureSource;
	setInteractive: AvSceneContext_SetInteractive;
	setSphereVolume( radius: number ): void;
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
};

export interface AvGrabEvent
{
	type: AvGrabEventType;
	grabbableId: string;
	grabberId: string;
}

export interface AvGrabbableProcessor
{
	( event: AvGrabEvent ): void;
}

export interface AvGrabberProcessor
{
	( isPressed: boolean, grabbableIds: string[] ): void;
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
	registerGrabbableProcessor( nodeId: number, processor: AvGrabbableProcessor ): void;
	registerGrabberProcessor( nodeId: number, processor: AvGrabberProcessor ): void;
	sendGrabEvent( grabberId: number, grabbableId: string, eventType: AvGrabEventType ): void;
}

interface Av_CreateGadget
{
	(gadgetName:string):AvGadgetObj;
}

interface Av_StartGadget
{
	( uri:string, initialHook: string ):void;
}

export interface Aardvark
{
	createGadget: Av_CreateGadget;
	startGadget: Av_StartGadget;
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
