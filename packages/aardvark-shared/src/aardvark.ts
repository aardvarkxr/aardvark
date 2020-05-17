import { AABB as Aabb, AardvarkManifest, AvSharedTextureInfo, EHand, EndpointAddr, Permission } from './aardvark_protocol';

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
	setBaseColor( color: [ number, number, number, number ] ): void;
}

export interface AvActionState
{
	// these actions are available to held gadgets
	a: boolean;
	b: boolean;
	squeeze: boolean;

	// these actions are not available to gadgets
	grab?: boolean;
	detach?: boolean;
}


interface AvRenderer
{
	setRendererConfig( rendererConfig: string ): void;
	registerTraverser( traverser: AvTraversalRenderer ): void;
	renderList( renderList: AvModelInstance[] ): void,
	createModelInstance( uri: string): AvModelInstance;
	getUniverseFromOriginTransform( origin: string ): number[];
	getAABBForModel( uri: string ): Aabb;

	registerHapticProcessor( hapticProcessor: AvHapticProcessor ) : void;
	sendHapticEventForHand( hand: EHand, amplitude: number, frequency: number, duration: number ): void;

	getActionState( hand: EHand ): AvActionState;
}

export interface AvStartGadgetResult
{
	success: boolean;
	startedGadgetEndpointId: number;
}

export interface AvManifestCallback
{
	(manifest: AardvarkManifest) : void;
}


export interface AvBrowserTextureCallback
{
	( textureInfo: AvSharedTextureInfo ): void;
}

export interface GadgetParams
{
	uri: string;
	initialHook: string;
	persistenceUuid: string;
	epToNotify?: EndpointAddr;
	remoteUniversePath?: string;
	ownerUuid?: string;
	remotePersistenceUuid?: string;
}

export enum PanelMouseEventType
{
	Unknown = 0,
	Down = 1,
	Up = 2,
	Enter = 3,
	Leave = 4,
	Move = 5,
};


export interface Aardvark
{
	hasPermission( permission: Permission ): boolean;

	// requires scenegraph permissions
	subscribeToBrowserTexture( callback: AvBrowserTextureCallback ): void;
	spoofMouseEvent( type:PanelMouseEventType, x: number, y: number ): void;

	// requires master permissions
	startGadget( params: GadgetParams ): void;

	/** Destroys the current browser. */
	closeBrowser(): void;

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
