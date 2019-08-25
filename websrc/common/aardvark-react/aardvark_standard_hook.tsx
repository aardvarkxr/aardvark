import * as React from 'react';
import { AvTransform } from 'common/aardvark-react/aardvark_transform';
import bind from 'bind-decorator';
import { AvModel } from 'common/aardvark-react/aardvark_model';
import { HookHighlight, AvHook } from './aardvark_hook';


interface StandardHookState
{
	highlight: HookHighlight;
}

export class AvStandardHook extends React.Component< {}, StandardHookState >
{
	constructor( props: any )
	{
		super( props );

		this.state = 
		{ 
			highlight: HookHighlight.None,
		};
	}

	@bind updateHookHighlight( newHighlight: HookHighlight )
	{
		this.setState( { highlight: newHighlight } );
	}

	public renderModel()
	{
		switch( this.state.highlight )
		{
			default:
			case HookHighlight.None:
				return null;
			
			case HookHighlight.GrabInProgress:
				return <AvTransform uniformScale={0.1}>
						<AvModel uri="https://aardvark.install/models/hook.glb" />
					</AvTransform>;

			case HookHighlight.InRange:
				return <AvTransform uniformScale={0.15}>
						<AvModel uri="https://aardvark.install/models/hook.glb" />
					</AvTransform>;
		}
	}


	public render()
	{
		return <div>
				<AvHook updateHighlight={ this.updateHookHighlight } radius={ 0.05 } />
				{ this.renderModel() }
			</div>;
	}
}

