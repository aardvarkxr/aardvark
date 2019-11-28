import * as React from 'react';
import { AvTransform } from './aardvark_transform';
import bind from 'bind-decorator';
import { AvModel } from './aardvark_model';
import { HookHighlight, AvHook } from './aardvark_hook';
import { AvGadget } from './aardvark_gadget';
import { EHand } from '@aardvarkxr/aardvark-shared';


interface StandardHookProps
{
	/** The persistent name of this node when saving the user's state. 
	 * For AvHook and AvGrabbable nodes, this is required to associate persistent
	 * state with the same hook or grabbable from run to run.
	 */
	persistentName: string;

	/** The hand that this hook is parented to. This is used to determine whether or
	 * not the hook should be visible based on that hand's edit mode.
	 */
	hand?: EHand;
}

interface StandardHookState
{
	highlight: HookHighlight;
}

/** A hook for attaching grabbables to that uses a standard plus-in-circle icon and is made visible
 * whenever its parent hand is in edit mode.
 */
export class AvStandardHook extends React.Component< StandardHookProps, StandardHookState >
{
	private m_editModeHandle = 0;

	constructor( props: any )
	{
		super( props );

		this.state = 
		{ 
			highlight: HookHighlight.None,
		};

		this.m_editModeHandle = AvGadget.instance().listenForEditModeWithComponent( this )
	}

	componentWillUnmount()
	{
		AvGadget.instance().unlistenForEditMode( this.m_editModeHandle );
	}

	@bind updateHookHighlight( newHighlight: HookHighlight )
	{
		this.setState( { highlight: newHighlight } );
	}

	public renderModel()
	{
		let showHook = false;
		let hookScale = 1.0;
		switch( this.state.highlight )
		{
			default:
			case HookHighlight.None:
			case HookHighlight.Occupied:
				break;
			
			case HookHighlight.GrabInProgress:
				showHook = true;
				break;

			case HookHighlight.InRange:
				showHook = true;
		}

		if( showHook || AvGadget.instance().getEditModeForHand( this.props.hand ) )
		{
			return <AvTransform uniformScale={ hookScale }>
					<AvModel uri="https://aardvark.install/models/hook.glb" />
				</AvTransform>;
		}
	}


	public render()
	{
		return <div>
				<AvHook updateHighlight={ this.updateHookHighlight } radius={ 0.08 } 
					persistentName={ this.props.persistentName } />
				{ this.renderModel() }
			</div>;
	}
}

