
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
}

interface AvApp_GetName
{
	():string;
}

interface AvApp_StartSceneContext
{
	():AvSceneContext;
}

export interface AvPokerHandler
{
	( proximity: PokerProximity[] ): void;
}

interface AvApp_RegisterPokerHandler
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

interface AvApp_SendMouseEvent
{
	(pokerId: number, panelId:string, type: AvPanelMouseEventType, x:number, y:number ): void;
}

export interface AvPanelHandler
{
	( event: AvPanelMouseEvent ): void;
}

interface AvApp_RegisterPanelHandler
{
	( nodeId:number, handlerFunction: AvPanelHandler ): void;
}


export interface AvAppObj
{
	getName: AvApp_GetName;
	startSceneContext: AvApp_StartSceneContext;
	registerPokerHandler: AvApp_RegisterPokerHandler;
	registerPanelHandler: AvApp_RegisterPanelHandler;
	enableDefaultPanelHandling( panelId: number ): void;
	sendMouseEvent: AvApp_SendMouseEvent;
}

interface Av_CreateApp
{
	(appName:string):AvAppObj;
}

interface Av_StartApp
{
	( uri:string, permissions: string[]):void;
}

export interface Aardvark
{
	createApp: Av_CreateApp;
	startApp: Av_StartApp;
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
