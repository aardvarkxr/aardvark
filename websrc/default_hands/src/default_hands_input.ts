import { ActionSet, ActionState, ActionType, Input, InteractionProfile, twoHandBinding } from '@aardvarkxr/aardvark-shared';

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
				bindings: twoHandBinding( InteractionProfile.IndexController, Input.TriggerTouch )
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
				bindings: twoHandBinding( InteractionProfile.IndexController, Input.Trigger ),
			},
			{
				name: "menu",
				localizedName: "Context Menu",
				type: ActionType.Boolean,
				bindings: twoHandBinding( InteractionProfile.IndexController, Input.A ),
			}
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
