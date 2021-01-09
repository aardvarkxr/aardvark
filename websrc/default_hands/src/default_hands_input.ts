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
					// ...twoHandBinding( InteractionProfile.IndexController, Input.TriggerTouch ),
					// ...twoHandBinding( InteractionProfile.TouchController, Input.TriggerTouch ),
					// ...twoHandBinding( InteractionProfile.MixedRealityController, Input.TriggerTouch ),
					// ...twoHandBinding( InteractionProfile.ViveController, Input.TriggerTouch ),
					// ...twoHandBinding( InteractionProfile.ReverbG2Controller, Input.TriggerTouch ),
				]
			}
		]
	},
	{
		name: "interact",
		localizedName: "Grab",
		suppressAppBindings: true,
		actions: 
		[
			{
				name: "grab",
				localizedName: "Grab",
				type: ActionType.Boolean,
				bindings: 
				[ 
					...twoHandBinding( InteractionProfile.IndexController, Input.Squeeze ),
					...twoHandBinding( InteractionProfile.IndexController, Input.Trigger ),

					...twoHandBinding( InteractionProfile.TouchController, Input.Squeeze ),
					...twoHandBinding( InteractionProfile.TouchController, Input.Trigger ),

					...twoHandBinding( InteractionProfile.MixedRealityController, Input.Squeeze ),
					...twoHandBinding( InteractionProfile.MixedRealityController, Input.Trigger ),

					...twoHandBinding( InteractionProfile.ViveController, Input.Trigger ),
					
					...twoHandBinding( InteractionProfile.ReverbG2Controller, Input.Squeeze ),
					...twoHandBinding( InteractionProfile.ReverbG2Controller, Input.Trigger ),
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
					{
						interactionProfile: InteractionProfile.ReverbG2Controller,
						inputPath: Device.Left + Input.X,
					},
					{
						interactionProfile: InteractionProfile.ReverbG2Controller,
						inputPath: Device.Right + Input.A,
					},
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
					...twoHandBinding( InteractionProfile.ReverbG2Controller, Input.Thumbstick ),
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
