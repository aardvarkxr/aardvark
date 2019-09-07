import * as React from 'react';
import { AvTransform } from 'common/aardvark-react/aardvark_transform';
import bind from 'bind-decorator';
import { AvModel } from 'common/aardvark-react/aardvark_model';
import { HookHighlight, AvHook } from './aardvark_hook';


interface StandardHookProps
{
	persistentName: string;
}

interface StandardHookState
{
	highlight: HookHighlight;
	editMode: boolean;
}

export class AvStandardHook extends React.Component< StandardHookProps, StandardHookState >
{
	constructor( props: any )
	{
		super( props );

		this.state = 
		{ 
			highlight: HookHighlight.None,
			editMode: false,
		};
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

		if( showHook || this.state.editMode )
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
					persistentName={ this.props.persistentName } 
					onEditMode = { ( editMode: boolean ) => { this.setState( { editMode } ); } }/>
				{ this.renderModel() }
			</div>;
	}
}

