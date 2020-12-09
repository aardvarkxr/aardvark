import { ActionSet, ActionState, ActionType, Input, InteractionProfile, twoHandBinding, Device } from '@aardvarkxr/aardvark-shared';

export let k_actionSets: ActionSet[] =
[
	{
		name: "default",
		localizedName: "Default",
		suppressAppBindings: false,
		actions: 
		[
			{
				name: "showRay",
				localizedName: "Show Grab Ray",
				type: ActionType.Boolean,
				bindings: 
				[ 
					...twoHandBinding( InteractionProfile.IndexController, Input.TriggerTouch ),
					...twoHandBinding( InteractionProfile.TouchController, Input.TriggerTouch ),
					...twoHandBinding( InteractionProfile.MixedRealityController, Input.TriggerTouch ),
					...twoHandBinding( InteractionProfile.ViveController, Input.TriggerTouch ),
				]
			}
		]
	},
	{
		name: "interact",
		localizedName: "Grab and Click",
		suppressAppBindings: true,
		actions: 
		[
			{
				name: "grab",
				localizedName: "Grab and Click",
				type: ActionType.Boolean,
				bindings: 
				[ 
					...twoHandBinding( InteractionProfile.IndexController, Input.Trigger ),
					...twoHandBinding( InteractionProfile.TouchController, Input.Trigger ),
					...twoHandBinding( InteractionProfile.MixedRealityController, Input.Trigger ),
					...twoHandBinding( InteractionProfile.ViveController, Input.Trigger ),
				],
			},
			{
				name: "menu",
				localizedName: "Context Menu",
				type: ActionType.Boolean,
				bindings: 
				[ 
					...twoHandBinding( InteractionProfile.IndexController, Input.A ),
					{
						interactionProfile: InteractionProfile.TouchController,
						inputPath: Device.Left + Input.X,
					},
					{
						interactionProfile: InteractionProfile.TouchController,
						inputPath: Device.Right + Input.A,
					},
					...twoHandBinding( InteractionProfile.MixedRealityController, Input.Menu ),
					...twoHandBinding( InteractionProfile.ViveController, Input.Menu ),
				],
			}
		]
	},
	{
		name: "grabbed",
		localizedName: "Grabbed",
		suppressAppBindings: true,
		actions: 
		[
			{
				name: "move",
				localizedName: "Move",
				type: ActionType.Vector2,
				bindings: 
				[ 
					...twoHandBinding( InteractionProfile.IndexController, Input.Thumbstick ),
					...twoHandBinding( InteractionProfile.TouchController, Input.Thumbstick ),
					...twoHandBinding( InteractionProfile.MixedRealityController, Input.Thumbstick ),
					...twoHandBinding( InteractionProfile.ViveController, Input.Trackpad ),
				],
			},
		]
	},

];




export interface DefaultActionSet
{
	showRay: ActionState< boolean >;
}

export interface InteractActionSet
{
	grab: ActionState< boolean >;
	menu: ActionState< boolean >;
}

export interface HandResults
{
	default: DefaultActionSet;
	interact?: InteractActionSet;
}
