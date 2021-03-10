import { AABB, AardvarkManifest, AvNodeTransform, AvSharedTextureInfo, EHand, EndpointAddr, Permission, AvVector, AvQuaternion } from './aardvark_protocol';

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
	setOverlayOnly( overlayOnly: boolean ): void;
	setAnimationSource( animationSource: string ): void;
	setAnimation(modelUri: string, modelDataBase64: string ): void;
}

export interface AvActionState
{
	// these actions are available to held gadgets
	a: boolean;
	b: boolean;
	squeeze: boolean;

	// these actions are not available to gadgets
	grab?: boolean;
	grabShowRay?: boolean;
	grabMove?: [ number, number ];
	detach?: boolean;
}


export interface JointTransform
{
	translation: AvVector;
	rotation: AvQuaternion;
}

export interface JointInfo
{
	radius: number;
	parentIndex?: number;
}

export interface AvRenderer
{
	setRendererConfig( rendererConfig: string ): void;
	registerTraverser( traverser: AvTraversalRenderer ): void;
	renderList( renderList: AvModelInstance[] ): void,
	createModelInstance( modelUri: string, modelDataBase64: string ): AvModelInstance;
	getUniverseFromOriginTransform( origin: string ): number[];

	registerHapticProcessor( hapticProcessor: AvHapticProcessor ) : void;
	sendHapticEventForHand( hand: EHand, amplitude: number, frequency: number, duration: number ): void;

	getActionState( hand: EHand ): AvActionState;

	getSkeletonTransforms( skeletonPath: string ):JointTransform[] | null;
	getSkeletonInfo( skeletonPath: string ):JointInfo[] | null;
}

export interface AvStartGadgetResult
{
	success: boolean;
	startedGadgetEndpointId?: number;
	error?: string;
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
	initialInterfaces: string;
	epToNotify?: EndpointAddr;
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


export interface WindowInfo
{
	name: string;
	handle: string;
	texture: AvSharedTextureInfo;
};

export enum InteractionProfile
{
	ViveController = "/interaction_profiles/htc/vive_controller",
	CosmosController = "/interaction_profiles/htc/cosmos_controller",
	ReverbG2Controller = "/interaction_profiles/microsoft/hpmotioncontroller",
	MixedRealityController = "/interaction_profiles/microsoft/motion_controller",
	TouchController = "/interaction_profiles/oculus/touch",
	IndexController = "/interaction_profiles/valve/index_controller",
}

export enum Input
{
	Trigger = "/input/trigger",
	TriggerTouch = "/input/trigger/touch",
	TriggerClick = "/input/trigger/click",
	TriggerValue = "/input/trigger/value",

	Squeeze = "/input/squeeze",
	SqueezeTouch = "/input/squeeze/touch",
	SqueezeClick = "/input/squeeze/click",
	SqueezeValue = "/input/squeeze/value",
	SqueezeForce = "/input/squeeze/force",

	A = "/input/a",
	ATouch = "/input/a/touch",
	AClick = "/input/a/click",

	B = "/input/b",
	BTouch = "/input/b/touch",
	BClick = "/input/b/click",

	X = "/input/x",
	XTouch = "/input/x/touch",
	XClick = "/input/x/click",

	Y = "/input/y",
	YTouch = "/input/y/touch",
	YClick = "/input/y/click",

	Menu = "/input/menu",
	MenuTouch = "/input/menu/touch",
	MenuClick = "/input/menu/click",

	Trackpad = "/input/trackpad",
	TrackpadTouch = "/input/trackpad/touch",
	TrackpadClick = "/input/trackpad/click",
	TrackpadForce = "/input/trackpad/force",
	TrackpadX = "/input/trackpad/x",
	TrackpadY = "/input/trackpad/y",

	Thumbstick = "/input/thumbstick",
	ThumbstickTouch = "/input/thumbstick/touch",
	ThumbstickClick = "/input/thumbstick/click",
	ThumbstickForce = "/input/thumbstick/force",
	ThumbstickX = "/input/thumbstick/x",
	ThumbstickY = "/input/thumbstick/y",
}

export enum Device
{
	Left = "/user/hand/left",
	Right = "/user/hand/right",
}

export function handToDevice( hand: EHand ): Device
{
	switch( hand )
	{
		case EHand.Left: return Device.Left;
		case EHand.Right: return Device.Right;
	}
}

/** Used to bind a single action to an input for a single interaction profile */
export interface ActionBinding
{
	/** The OpenXR interaction profile to apply this binding to. Only interaction profiles that
	 * apply to /user/hand/left or /user/hand/right are currently supported.
	 *  See the OpenXR specification for more detail: https://www.khronos.org/registry/OpenXR/specs/1.0/html/xrspec.html#semantic-path-interaction-profiles
	 */
	interactionProfile: string;

	/** This will be one of the input paths included in the OpenXR specification for 
	 * this interactionProfile.
	 */
	inputPath: string;
}


/** The type of a single action. Pose actions are supposed through AvOrigin nodes on /user/hand/left
 * or /user/hand/right.
 */
export enum ActionType
{
	Unknown = -1,

	Boolean = 0,
	Float = 1,
	Vector2 = 2,
}

/** Declares a single action inside of an action set. */
export interface Action
{
	/** Internal name to use for this action. These must be unique within the action set. */
	name: string;

	/** Name in the user's languageto show a user for this action */
	localizedName: string;

	/** Type of the action */
	type: ActionType;

	/** Bindings for this action on any number of controller types */
	bindings?: ActionBinding[];
}

/** Declares a single action set for the gadget */
export interface ActionSet
{
	/** Internal name to use for this action set. These must be unique within the gadget. */
	name: string;

	/** Name in the user's languageto show a user for this action set */
	localizedName: string;

	/** Suppresses scene app input for any inputs bound to actions in this action set 
	 * whenever this action set is active. Use this with caution, and only when specific
	 * conditions are present to prevent app input from being blocked permanently. 
	 * 
	 * @default false 
	 */
	suppressAppBindings?: boolean;

	/** Priority for action bindings in this action set relative to other bindings in the same 
	 * gadget. Bindings from action sets with higher numbers will suppress bindings from action sets
	 * with lower numbers. This number will be clamped to the 0..10 range, inclusively.
	 * 
	 * @default 0
	 */
	priority?: number;

	/** Actions contained in this action set */
	actions?: Action[];
}

export interface ActiveActionSet
{
	/** Name of the action set to activate */
	actionSetName: string;

	/** List of hands to activate the action set on. This can be /user/hand/left, /user/hand/right, or 
	 * an empty list. Empty list means that the 
	 */
	topLevelPaths?: string[];
}

/** Contains the list of action sets that the application would like to activate. */
export interface InputInfo
{
	activeActionSets: ActiveActionSet[];
}

/** Contains the state of a single action on a single device */
export interface ActionDeviceState<T>
{
	active: boolean;
	value: T;
}

/** Contains the state of a single action */
export interface ActionState<T>
{
	left?: ActionDeviceState<T>;
	right?: ActionDeviceState<T>;
}

/** contains the state of a single action set */
export interface ActionSetState
{
	[ actionName: string ]: ActionState< boolean | number | [ number, number ] >;
}

/** Contains the current state of input for all actions after a call to syncActions. */
export interface InputState
{
	results: { [ actionSetName: string ]: ActionSetState };

	/** The interaction profile of the current controllers. Will be undefined if
	 * there are not currently controllers or if the controllers are of an unknown 
	 * interaction profile.
	 */
	interactionProfile?: string;
}

/** Information about the underlying application that Aardvark is running on top of. */
export interface SceneApplicationInfo
{
	/** A globally unique identifier for the running application. */
	id: string;

	/** A name that can be shown to a user for the running application. */
	name: string;

	/** A unique-within-the-application identifier for which level/map/planet the user is in. */
	worldId?: string;

	/** A unique-within-the-worldID identifier for which instance of the world that the user is in. */
	instanceId?: string;

	/** The transform from the user's stage origin to the instance's origin. */
	instanceFromStage?: AvNodeTransform;
}

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

	// requires starturl permissions
	startUrl( url: string ): void;

	// requires screeencapture permissions
	subscribeWindowList( callback: ( windows: WindowInfo[] ) => void ): void;
	unsubscribeWindowList():void;
	subscribeWindow( windowHandle: string, callback: ( window: WindowInfo ) => void ): void;
	unsubscribeWindow( windowHandle: string ): void;

	// requires input permissions
	registerInput( actionSets: ActionSet[] ): void;
	syncInput( info: InputInfo ): InputState;

	// requires settings permissions
	getBoolSetting( sectionName: string, settingName: string ): boolean;
	getNumberSetting( sectionName: string, settingName: string ): number;
	getStringSetting( sectionName: string, settingName: string ): string;
	setSetting( sectionName: string, settingName: string, newValue: number | string | boolean ): void;

	// requires application permissions
	registerSceneApplicationNotification( fn: () => void ): void;
	getCurrentSceneApplication(): SceneApplicationInfo | null;
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
	return window?.aardvark as Aardvark;
}
