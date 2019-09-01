import * as React from 'react';
import  * as ReactDOM from 'react-dom';

import { AvGadget } from 'common/aardvark-react/aardvark_gadget';
import { AvTransform } from 'common/aardvark-react/aardvark_transform';
import bind from 'bind-decorator';
import { AvGrabbable, HighlightType } from 'common/aardvark-react/aardvark_grabbable';
import { AvStandardHook } from 'common/aardvark-react/aardvark_standard_hook';
import { AvSphereHandle } from 'common/aardvark-react/aardvark_handles';
import { AvModel } from 'common/aardvark-react/aardvark_model';
import { endpointAddrToString } from 'common/aardvark-react/aardvark_protocol';


interface CharmBraceletState
{
	highlight: HighlightType;
}

class CharmBracelet extends React.Component< {}, CharmBraceletState >
{
	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
			highlight: HighlightType.None,
		};
	}

	@bind onGrabbableHighlight( newHighlight: HighlightType )
	{
		this.setState( { highlight: newHighlight } );
	}

	public render()
	{
		let grabbedMode = this.state.highlight == HighlightType.Grabbed;
		return (
			<div className="FullPage" >
				<AvGadget>
					<AvGrabbable updateHighlight={ this.onGrabbableHighlight }>
						<AvSphereHandle radius={0.1} />
						<AvTransform translateY={ -0.2 } translateZ = {0.2} visible={ !grabbedMode }>
							<AvStandardHook persistentName="hook0" />
						</AvTransform>
						{ grabbedMode && <AvModel uri="http://aardvark.install/models/bracelet.glb" /> }
					</AvGrabbable>
				</AvGadget>
			</div>
		)
	}
}

ReactDOM.render( <CharmBracelet/>, document.getElementById( "root" ) );
