/**
 * @jest-environment jsdom
 */
import { ActionSetState, ActionState } from '@aardvarkxr/aardvark-shared';
import { Action, InputInfo } from '@aardvarkxr/aardvark-shared';
import { ActionType, InputProcessor, twoHandBinding, InteractionProfile, Input, ActionSet, Device, InputState } from '@aardvarkxr/aardvark-shared';

jest.useFakeTimers();

beforeEach( async() =>
{
} );

afterEach( () =>
{
} );


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
				bindings: twoHandBinding( InteractionProfile.IndexController, Input.Trigger )
			},
			{
				name: "menu",
				localizedName: "Context Menu",
				type: ActionType.Boolean,
				bindings: twoHandBinding( InteractionProfile.IndexController, Input.A )
			},
			{
				name: "floattest",
				localizedName: "Context Menu",
				type: ActionType.Float,
				bindings: twoHandBinding( InteractionProfile.IndexController, Input.A )
			},
			{
				name: "vector2test",
				localizedName: "Context Menu",
				type: ActionType.Vector2,
				bindings: twoHandBinding( InteractionProfile.IndexController, Input.A )
			}
		]
	},

];

function getActionsFromSet( actionSetName: string ) : Action[]
{
	for( let as of k_actionSets )
	{
		if( as.name == actionSetName )
		{
			return as.actions;
		}
	}
	return null;
}

function defaultState()
{
	let state: InputState =
	{
		results:
		{
			default:
			{
				showRay :
				{
					left:
					{
						active: true,
						value: false,
					},
					right:
					{
						active: true,
						value: false,
					}
				}
			},
			interact:
			{
				grab :
				{
					left:
					{
						active: true,
						value: false,
					},
					right:
					{
						active: true,
						value: false,
					}
				},
				menu :
				{
					left:
					{
						active: true,
						value: false,
					},
					right:
					{
						active: true,
						value: false,
					}
				},
				floattest :
				{
					left:
					{
						active: true,
						value: 0,
					},
					right:
					{
						active: true,
						value: 0,
					}
				},
				vector2test :
				{
					left:
					{
						active: true,
						value: [ 0, 0 ],
					},
					right:
					{
						active: true,
						value: [ 0, 0],
					}
				}
			}
		}
	};

	return state;
}

function filterStateForActiveActionSets( state: InputState, info: InputInfo )
{
	let out: InputState = { results: {} };
	for( let activeSet of info.activeActionSets )
	{
		let outSet: ActionSetState = { };

		let actions = getActionsFromSet( activeSet.actionSetName );
		for( let action of actions )
		{
			let outAction: ActionState< boolean | number | [ number, number ] > = {};

			if( typeof activeSet.topLevelPaths == "object" && activeSet.topLevelPaths.length == 0)
			{
				throw new Error( "topLevelPaths can't be an empty array" );
			}
			
			let devicesWithDefaults = activeSet.topLevelPaths ?? [ Device.Left, Device.Right ];
			if( devicesWithDefaults.includes( Device.Left ) )
			{
				outAction.left = state.results[ activeSet.actionSetName ][ action.name ].left;
			}
			if( devicesWithDefaults.includes( Device.Right ) )
			{
				outAction.right = state.results[ activeSet.actionSetName ][ action.name ].right;
			}

			outSet[ action.name ] = outAction;
		}

		out.results[ activeSet.actionSetName ] = outSet;
	}

	return out;
}

describe( "InputProcessor ", () =>
{
	it( "boolean with values", async () =>
	{
		let ip = new InputProcessor( k_actionSets );

		let rcb = 0;
		let fcb = 0;
		ip.registerBooleanCallbacks("default", "showRay", Device.Left, () => rcb++, () => fcb++ );

		let state = defaultState();

		ip.TEST_UpdateState( state );

		expect( rcb ).toBe( 0 );
		expect( fcb ).toBe( 0 );

		state.results.default.showRay.left.value = true;
		ip.TEST_UpdateState( state );

		expect( rcb ).toBe( 1 );
		expect( fcb ).toBe( 0 );

		ip.TEST_UpdateState( state );

		expect( rcb ).toBe( 1 );
		expect( fcb ).toBe( 0 );

		state.results.default.showRay.left.value = false;
		ip.TEST_UpdateState( state );

		expect( rcb ).toBe( 1 );
		expect( fcb ).toBe( 1 );

		state.results.default.showRay.left.value = true;
		ip.TEST_UpdateState( state );
		state.results.default.showRay.left.value = false;
		ip.TEST_UpdateState( state );

		state.results.default.showRay.left.value = true;
		ip.TEST_UpdateState( state );
		state.results.default.showRay.left.value = false;
		ip.TEST_UpdateState( state );

		state.results.default.showRay.left.value = true;
		ip.TEST_UpdateState( state );
		state.results.default.showRay.left.value = false;
		ip.TEST_UpdateState( state );

		expect( rcb ).toBe( 4 );
		expect( fcb ).toBe( 4 );
	});

	it( "boolean with undefined", async () =>
	{
		let ip = new InputProcessor( k_actionSets );

		let rcb = 0;
		let fcb = 0;
		ip.registerBooleanCallbacks("default", "showRay", Device.Left, () => rcb++, () => fcb++ );

		let state = defaultState();
		delete state.results.default;

		ip.TEST_UpdateState( state );

		expect( rcb ).toBe( 0 );
		expect( fcb ).toBe( 0 );

		state.results.default = { showRay: { left: { value : true, active: true } } };		
		ip.TEST_UpdateState( state );

		expect( rcb ).toBe( 1 );
		expect( fcb ).toBe( 0 );

		ip.TEST_UpdateState( state );

		expect( rcb ).toBe( 1 );
		expect( fcb ).toBe( 0 );

		state.results.default.showRay.left.value = false;
		ip.TEST_UpdateState( state );

		expect( rcb ).toBe( 1 );
		expect( fcb ).toBe( 1 );

		state.results.default.showRay.left.value = true;
		ip.TEST_UpdateState( state );
		delete state.results.default;
		ip.TEST_UpdateState( state );

		expect( rcb ).toBe( 2 );
		expect( fcb ).toBe( 2 );
	});

	it( "float with values", async () =>
	{
		let ip = new InputProcessor( k_actionSets );

		let lastFloat:number;
		let calls = 0;

		ip.registerFloatCallback("interact", "floattest", Device.Left, 
			( o: number, n: number ) => 
			{ 
				lastFloat = n; 
				calls++;
			} );

		let state = defaultState();

		ip.TEST_UpdateState( state );

		expect( lastFloat ).toBeUndefined();
		expect( calls ).toBe( 0 );

		state.results.interact.floattest.left.value = 0.47;
		ip.TEST_UpdateState( state );

		expect( lastFloat ).toBe( 0.47 );
		expect( calls ).toBe( 1 );

		ip.TEST_UpdateState( state );

		expect( lastFloat ).toBe( 0.47 );
		expect( calls ).toBe( 1 );

		state.results.interact.floattest.left.value = 0;
		ip.TEST_UpdateState( state );

		expect( lastFloat ).toBe( 0 );
		expect( calls ).toBe( 2 );

	});

	it( "vector2 with values", async () =>
	{
		let ip = new InputProcessor( k_actionSets );

		let lastValue: [ number, number ];
		let calls = 0;

		ip.registerVector2Callback("interact", "vector2test", Device.Left, 
			( o: [ number, number ], n: [ number, number ] ) => 
			{ 
				lastValue = n; 
				calls++;
			} );

		let state = defaultState();

		ip.TEST_UpdateState( state );

		expect( lastValue ).toBeUndefined();
		expect( calls ).toBe( 0 );

		state.results.interact.vector2test.left.value = [ 0.147, -0.23 ];
		ip.TEST_UpdateState( state );

		expect( lastValue[0] ).toBe( 0.147 );
		expect( lastValue[1] ).toBe( -0.23 );
		expect( calls ).toBe( 1 );

		ip.TEST_UpdateState( state );

		expect( lastValue[0] ).toBe( 0.147 );
		expect( lastValue[1] ).toBe( -0.23 );
		expect( calls ).toBe( 1 );

		state.results.interact.vector2test.left.value = [ 0, 0 ];
		
		ip.TEST_UpdateState( state );

		expect( lastValue[0] ).toBe( 0 );
		expect( lastValue[1] ).toBe( 0 );
		expect( calls ).toBe( 2 );

	});

	it( "action set registration", async () =>
	{
		let state = defaultState();

		// set everything to true and let action set active state per device control what callbacks we get
		state.results.default.showRay.left.value = true;
		state.results.interact.grab.left.value = true;
		state.results.interact.menu.left.value = true;
		state.results.interact.floattest.left.value = 0.47;
		state.results.interact.vector2test.left.value = [ 0.123, 0.456 ];
		state.results.default.showRay.right.value = true;
		state.results.interact.grab.right.value = true;
		state.results.interact.menu.right.value = true;
		state.results.interact.floattest.right.value = 0.47;
		state.results.interact.vector2test.right.value = [ 0.123, 0.456 ];

		let ip = new InputProcessor( k_actionSets, 1, ( info: InputInfo ) =>
			{
				return filterStateForActiveActionSets( 
					JSON.parse( JSON.stringify( state ) ) as InputState, info );
			} );

		let rcbShowRay = 0;
		let fcbShowRay = 0;
		ip.registerBooleanCallbacks("default", "showRay", Device.Left, () => rcbShowRay++, () => fcbShowRay++ );

		let rcbGrab = 0;
		let fcbGrab = 0;
		ip.registerBooleanCallbacks("interact", "grab", Device.Right, () => rcbGrab++, () => fcbGrab++ );

		// advance the timer, but it shouldn't be registered yet
		jest.advanceTimersToNextTimer();

		expect( rcbShowRay ).toBe( 0 );
		expect( fcbShowRay ).toBe( 0 );
		expect( rcbGrab ).toBe( 0 );
		expect( fcbGrab ).toBe( 0 );
		
		ip.activateActionSet( "default" );
		jest.advanceTimersToNextTimer();

		// after initial activation, the callback won't be called
		expect( rcbShowRay ).toBe( 0 );
		expect( fcbShowRay ).toBe( 0 );

		state.results.default.showRay.left.value = false;
		jest.advanceTimersToNextTimer();

		// still nothing because the release is suppressed too
		expect( rcbShowRay ).toBe( 0 );
		expect( fcbShowRay ).toBe( 0 );

		state.results.default.showRay.left.value = true;
		jest.advanceTimersToNextTimer();

		expect( rcbShowRay ).toBe( 1 );
		expect( fcbShowRay ).toBe( 0 );

		ip.deactivateActionSet( "default" );
		jest.advanceTimersToNextTimer();
		
		expect( rcbShowRay ).toBe( 1 );
		expect( fcbShowRay ).toBe( 1 );

		ip.activateActionSet( "interact", Device.Left );
		jest.advanceTimersToNextTimer();
		
		expect( rcbShowRay ).toBe( 1 );
		expect( fcbShowRay ).toBe( 1 );
		expect( rcbGrab ).toBe( 0 ); // these are 0 because the callback is on the right
		expect( fcbGrab ).toBe( 0 );

		ip.activateActionSet( "interact", Device.Right );
		jest.advanceTimersToNextTimer();
		
		expect( rcbGrab ).toBe( 0 ); // still 0 because of suppression
		expect( fcbGrab ).toBe( 0 );

		state.results.interact.grab.right.value = false;
		jest.advanceTimersToNextTimer();
		state.results.interact.grab.right.value = true;
		jest.advanceTimersToNextTimer();

		expect( rcbShowRay ).toBe( 1 );
		expect( fcbShowRay ).toBe( 1 );
		expect( rcbGrab ).toBe( 1 ); 
		expect( fcbGrab ).toBe( 0 );

		ip.deactivateActionSet( "interact", Device.Left );
		jest.advanceTimersToNextTimer();
		
		expect( rcbShowRay ).toBe( 1 );
		expect( fcbShowRay ).toBe( 1 );
		expect( rcbGrab ).toBe( 1 ); 
		expect( fcbGrab ).toBe( 0 );

		ip.deactivateActionSet( "interact", Device.Right );
		jest.advanceTimersToNextTimer();
		
		// release is 1 because we don't suppress the release when an action set is deactivated
		expect( rcbShowRay ).toBe( 1 );
		expect( fcbShowRay ).toBe( 1 );
		expect( rcbGrab ).toBe( 1 ); 
		expect( fcbGrab ).toBe( 1 ); 

		ip.activateActionSet( "interact", [ Device.Left, Device.Right ] );
		jest.advanceTimersToNextTimer();
		
		state.results.interact.grab.right.value = false;
		jest.advanceTimersToNextTimer();
		state.results.interact.grab.right.value = true;
		jest.advanceTimersToNextTimer();
		
		expect( rcbShowRay ).toBe( 1 );
		expect( fcbShowRay ).toBe( 1 );
		expect( rcbGrab ).toBe( 2 ); 
		expect( fcbGrab ).toBe( 1 );

		ip.deactivateActionSet( "interact" );
		jest.advanceTimersToNextTimer();
		
		expect( rcbShowRay ).toBe( 1 );
		expect( fcbShowRay ).toBe( 1 );
		expect( rcbGrab ).toBe( 2 ); 
		expect( fcbGrab ).toBe( 2 );

		
	});

} );



