import { InteractionProfile, Device, ActionBinding, Input, InputState, ActionType, Av, InputInfo, ActionSet, ActiveActionSet, Action } from './aardvark';


interface InputCallback
{
	id: number;
}

interface BooleanCallback extends InputCallback
{
	rising?: () => void;
	falling?: () => void;
}

interface FloatCallback extends InputCallback
{
	change: ( oldValue: number, newValue: number ) => void;
}

interface Vector2Callback extends InputCallback
{
	change: ( oldValue: [ number, number ], newValue: [ number, number ] ) => void;
}

interface ActionWithListeners extends Action
{
	leftCallbacks?: (BooleanCallback | FloatCallback | Vector2Callback )[];
	rightCallbacks?: (BooleanCallback | FloatCallback | Vector2Callback )[];
}


/** Helper class to allow registering callbacks for input state changes instead of polling state. */
export class InputProcessor
{
	private inputInfo: InputInfo =
	{
		activeActionSets: [],
	};
	private state: InputState;
	private inputIntervalMs: number;
	private inputTimer:number;
	private actionSets: ActionSet[];
	private nextCallbackId = 1;
	private syncInputOverride: ( info: InputInfo ) => InputState;

	constructor( actionSets: ActionSet[], inputIntervalMs?: number, 
		syncInputOverride?: ( info: InputInfo ) => InputState )
	{
		this.actionSets = actionSets;
		this.syncInputOverride = syncInputOverride;
		this.inputIntervalMs = inputIntervalMs ?? 30;
		Av()?.registerInput( actionSets );
	}

	/** Used by tests to force a state update */
	public TEST_UpdateState( newState: InputState )
	{
		this.applyNewState( JSON.parse( JSON.stringify( newState ) ) as InputState );
	}

	/**
	 * Activates an action set on the next action sync. if a list of devices is
	 * not supplied the action set is activated for all devices. If a single string
	 * is provided, that device is added to the existing list. If a list of devices 
	 * is provided, the list replaces the existing list.
 	 */
	public activateActionSet( actionSetName: string, devices?: Device | Device[]) 
	{
		let activeSet: ActiveActionSet;
		for( let as of this.inputInfo.activeActionSets )
		{
			if( as.actionSetName == actionSetName )
			{
				activeSet = as;
				break;
			}
		}
		
		if( activeSet )
		{
			if( typeof devices == "string" )
			{
				if( !activeSet.topLevelPaths )
				{
					activeSet.topLevelPaths = [ devices ];
				}
				else
				{
					activeSet.topLevelPaths.push( devices );
				}
			}
			else
			{
				activeSet.topLevelPaths = devices;
			}
		}
		else
		{
			let topLevelPaths: Device[];
			if( typeof devices == "object" )
			{
				topLevelPaths = devices;
			}
			else if( devices )
			{
				topLevelPaths = [ devices ];
			}

			this.inputInfo.activeActionSets.push(
				{
					actionSetName,
					topLevelPaths,
				}
			);

			if( !this.inputTimer && this.inputIntervalMs )
			{
				this.inputTimer = window.setTimeout( () => this.onInputTick(), this.inputIntervalMs );
			}
		}
	}

	/**
	 * Deactivates an action set on the next action sync. If a device list
	 * is not supplied, the action set is deactivated for all devices.
 	 */
	public deactivateActionSet( actionSetName: string, device?: Device) 
	{
		for( let i = 0; i < this.inputInfo.activeActionSets.length; i++ )
		{
			let as = this.inputInfo.activeActionSets[i];
			if( as.actionSetName == actionSetName )
			{
				if( !device )
				{
					// remove for all devices
					this.inputInfo.activeActionSets.splice( i, 1 );
				}
				else
				{
					as.topLevelPaths = as.topLevelPaths.filter( ( dev: Device ) => dev != device );

					if( as.topLevelPaths.length == 0 )
					{
						this.inputInfo.activeActionSets.splice( i, 1 );
					}
				}
				return;
			}
		}

		// if we didn't find the action set in our list there's nothing to remove
	}
 
	/** Registers boolean callbacks for an action and device */
	public registerBooleanCallbacks( actionSetName: string, actionName: string, device: Device, 
		rising: () => void, falling?: ()=> void )
	{
		let cb: BooleanCallback =
		{
			id: this.nextCallbackId++,
			rising,
			falling,
		};

		return this.registerCallback( actionSetName, actionName, device, cb );
	}

	/** Registers float callbacks for an action and device */
	public registerFloatCallback( actionSetName: string, actionName: string, device: Device, 
		change: ( oldValue: number, newValue: number ) => void )
	{
		let cb: FloatCallback =
		{
			id: this.nextCallbackId++,
			change,
		};
		return this.registerCallback( actionSetName, actionName, device, cb );
	}

	/** Registers float callbacks for an action and device */
	public registerVector2Callback( actionSetName: string, actionName: string, device: Device, 
		change: ( oldValue: [ number, number ], newValue: [ number, number ] ) => void )
	{
		let cb: Vector2Callback =
		{
			id: this.nextCallbackId++,
			change,
		};
		return this.registerCallback( actionSetName, actionName, device, cb );
	}

	private registerCallback( actionSetName: string, actionName: string, device: Device, 
		cb: BooleanCallback | FloatCallback | Vector2Callback )
	{
		let action = this.getAction( actionSetName, actionName );
		if( !action )
		{
			throw new Error( `Unknown action ${ actionName } in action set ${ actionSetName }` );
		}

		switch( device )
		{
			case Device.Left:
				action.leftCallbacks = [ ...( action.leftCallbacks ?? [] ), cb ];
				break;

			case Device.Right:
				action.rightCallbacks = [ ...( action.rightCallbacks ?? [] ), cb ];
				break;
		}
		return cb.id;
	}

	/** Unregisters a callback by id */
	public unregisterCallback( id: number )
	{
		for( let actionSet of this.actionSets )
		{
			for( let baseAction of actionSet.actions ?? [] )
			{
				let action = baseAction as ActionWithListeners;

				action.leftCallbacks = action.leftCallbacks?.filter( ( cb ) => cb.id != id );
				action.rightCallbacks = action.rightCallbacks?.filter( ( cb ) => cb.id != id );
			}
		}
	}


	private onInputTick()
	{
		try
		{
			let state = this.syncInputOverride ? this.syncInputOverride( this.inputInfo ) 
				:Av().syncInput( this.inputInfo );
			this.applyNewState( state );
		}
		catch( e )
		{
			console.log( "failed to sync input" );
		}

		if( this.inputInfo.activeActionSets.length > 0 && this.inputIntervalMs)
		{
			this.inputTimer = window.setTimeout( () => this.onInputTick(), this.inputIntervalMs );
		}
		else
		{
			this.inputTimer = undefined;
		}
	}

	private getAction( actionSetName: string, actionName: string ): ActionWithListeners | undefined
	{
		for( let actionSet of this.actionSets )
		{
			if( actionSet.name != actionSetName )
				continue;

			for( let action of actionSet.actions ?? [] )
			{
				if( action.name == actionName )
				{
					return action;
				}
			}
		}

		return undefined;
	}

	private applyNewState( newState: InputState )
	{
		this.processDiffs( this.state, newState );
		this.state = newState;
	}

	private callCallback( cb: BooleanCallback | FloatCallback | Vector2Callback,
		oldValue: boolean | number | [ number, number ],
		newValue: boolean | number | [ number, number ],
		type: ActionType )
	{
		switch( type )
		{
			case ActionType.Boolean:
			{
				let bcb = cb as BooleanCallback;
				if( oldValue && !newValue )
				{
					bcb.falling?.();
				}
				else if( !oldValue && newValue )
				{
					bcb.rising?.();
				}
			}
			break;

			case ActionType.Float:
			{
				let fcb = cb as FloatCallback;
				let oldFloat = typeof oldValue == "number" ? oldValue as number : 0;
				let newFloat = typeof newValue == "number" ? newValue as number : 0;
				if( oldFloat != newFloat )
				{
					fcb.change( oldFloat, newFloat );
				}
			}
			break;

			case ActionType.Vector2:
			{
				const [ ox, oy ] = oldValue as [ number, number ] ?? [ 0, 0 ];
				const [ nx, ny ] = newValue as [ number, number ] ?? [ 0, 0 ];

				let vcb = cb as Vector2Callback;
				if( ox != nx || oy != ny )
				{
					vcb.change( [ ox, oy ], [ nx, ny ] );
				}
			}
			break;
		}
	}

	private processDiffs( old: InputState, newState: InputState )
	{
		for( let actionSet of this.actionSets )
		{
			if( old && newState && !old.results[ actionSet.name ] && newState.results[ actionSet.name ])
			{
				// the action set just became active. pretend it had the new state all along
				// to avoid spurious rising edges.
				old.results[ actionSet.name ] = newState.results[ actionSet.name ];

				// TODO: Maybe this should be optional?
			}

			for( let baseAction of actionSet.actions ?? [] )
			{
				let action = baseAction as ActionWithListeners;
				let oldAction = old?.results[ actionSet.name ]?.[ action.name ];
				let newAction = newState.results[ actionSet.name ]?.[ action.name ];
				let oldLeft  = oldAction?.left?.value;
				let oldRight = oldAction?.right?.value;

				let newLeft  = newAction?.left?.value;
				let newRight = newAction?.right?.value;

				for( let cb of action.leftCallbacks ?? [] )
				{
					this.callCallback( cb, oldLeft, newLeft, action.type );
				}
				for( let cb of action.rightCallbacks ?? [] )
				{
					this.callCallback( cb, oldRight, newRight, action.type );
				}
			}
		}
	}

}

/** Helper to create the same binding on multiple devices */
export function multiDeviceBinding( interactionProfile: InteractionProfile, devicePaths: Device[], 
	componentPath: Input ) :ActionBinding[]
{
	return devicePaths.map( (value: string) => 
	{
		return {
			interactionProfile,
			inputPath: value + componentPath,
		};
	} );
}

/** Helper to create the same binding on both hands */
export function twoHandBinding( interactionProfile: InteractionProfile, componentPath: Input )
{
	return multiDeviceBinding(interactionProfile, [ Device.Left, Device.Right ], componentPath );
}
