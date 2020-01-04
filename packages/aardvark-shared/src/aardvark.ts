import { AvGadgetManifest, AvPanelMouseEventType, EndpointAddr, 
	MsgGrabberState, MsgPokerProximity, AvSharedTextureInfo, 
	EHand, 
	AABB as Aabb} from './aardvark_protocol';

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
	registerTraverser( traverser: AvTraversalRenderer ): void;
	renderList( renderList: AvModelInstance[] ): void,
	createModelInstance( uri: string): AvModelInstance;
	getUniverseFromOriginTransform( origin: string ): number[];
	getAABBForModel( uri: string ): Aabb;

	registerHapticProcessor( hapticProcessor: AvHapticProcessor ) : void;
	sendHapticEventForHand( hand: EHand, amplitude: number, frequency: number, duration: number ): void;

	updatePokerProximity(): MsgPokerProximity[];
	addActivePanel( panelGlobalId: EndpointAddr, nodeFromUniverse: number[], zScale: number, hand: EHand  ): void;
	addActivePoker( pokerGlobalId: EndpointAddr, pokerInUniverse: number[], hand: EHand  ): void;
	
	updateGrabberIntersections(): MsgGrabberState[];
	addGrabbableHandle_Sphere( grabbableGlobalId: EndpointAddr, 
		handleGlobalId: EndpointAddr,
		universeFromHandle: number[], radius: number, hand: EHand ): void;
	addGrabbableHandle_ModelBox( grabbableGlobalId: EndpointAddr, 
		handleGlobalId: EndpointAddr,
		universeFromHandle: number[], uri: string, hand: EHand ): void;
	addGrabber_Sphere( grabberGlobalId: EndpointAddr, universeFromGrabber: number[], radius: number, hand: EHand ): void;
	addHook_Sphere( hookGlobalId: EndpointAddr, universeFromGrabber: number[], radius: number, hand: EHand, outerVolumeScale: number  ): void;
	addHook_Aabb( hookGlobalId: EndpointAddr, universeFromGrabber: number[], aabb: Aabb, hand: EHand, outerVolumeScale: number  ): void;

	startGrab( grabberGlobalId: EndpointAddr, grabbableGlobalId: EndpointAddr  ): void;
	endGrab( grabberGlobalId: EndpointAddr, grabbableGlobalId: EndpointAddr  ): void;

	getActionState( hand: EHand ): AvActionState;
}

export interface AvStartGadgetCallback
{
	(success: boolean, mainGrabbableGlobalId: EndpointAddr, mainHandleId: EndpointAddr ) : void;
}

export interface AvGadgetManifestCallback
{
	(manifest: AvGadgetManifest) : void;
}


export interface AvBrowserTextureCallback
{
	( textureInfo: AvSharedTextureInfo ): void;
}

export interface Aardvark
{
	// requires scenegraph permissions
	subscribeToBrowserTexture( callback: AvBrowserTextureCallback ): void;
	spoofMouseEvent( type:AvPanelMouseEventType, x: number, y: number ): void;

	// requires master permissions
	startGadget( uri: string, initialHook: string, persistenceUuid: string, epToNotify: EndpointAddr ): void;
	getGadgetManifest( uri: string, callback: AvGadgetManifestCallback ): void;

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
