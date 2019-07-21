import * as React from 'react';
import  * as ReactDOM from 'react-dom';

import { AvGadget } from 'common/aardvark-react/aardvark_gadget';
import { AvTransform } from 'common/aardvark-react/aardvark_transform';
import { AvPanel } from 'common/aardvark-react/aardvark_panel';
import bind from 'bind-decorator';
import { HookHighlight, AvHook } from 'common/aardvark-react/aardvark_hook';


interface CharmBraceletState
{
	hookHighlight: HookHighlight;
}

class CharmBracelet extends React.Component< {}, CharmBraceletState >
{
	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
			hookHighlight: HookHighlight.None,
		};
	}

	@bind public onHighlightHook( highlight: HookHighlight )
	{
		this.setState( { hookHighlight: highlight } );
	}

	public render()
	{
		let sDivClasses:string;
		switch( this.state.hookHighlight )
		{
			default:
			case HookHighlight.None:
				sDivClasses = "FullPage HookCircle NoHighlight";
				break;

			case HookHighlight.InRange:
				sDivClasses = "FullPage HookCircle InRangeHighlight";
				break;
		}

		return (
			<div className="FullPage" >
				<AvGadget name="Charm Bracelet">
					<AvTransform translateY={ -0.2 } translateZ = {0.2}>
						<AvHook updateHighlight= { this.onHighlightHook } radius={ 0.1 } />
						<AvTransform uniformScale={ 0.1 }>
							<AvPanel interactive={false} />
						</AvTransform>
					</AvTransform>
				</AvGadget>
				<div className={sDivClasses}><div className="PlusSign">+</div></div>
			</div>
		)
	}
}

ReactDOM.render( <CharmBracelet/>, document.getElementById( "root" ) );
