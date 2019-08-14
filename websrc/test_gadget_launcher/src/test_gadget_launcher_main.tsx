import * as React from 'react';
import  * as ReactDOM from 'react-dom';

import { AvGadget } from 'common/aardvark-react/aardvark_gadget';
import { AvTransform } from 'common/aardvark-react/aardvark_transform';
import { AvGadgetSeed } from 'common/aardvark-react/aardvark_gadget_seed';


class TestGadgetLauncher extends React.Component< {}, {} >
{
	constructor( props: any )
	{
		super( props );
	}

	public render()
	{
		return (
			<div >
				<AvGadget>
					<AvTransform translateX={0.5}>
						<AvGadgetSeed uri="https://aardvark.install/gadgets/test_panel" />
					</AvTransform>
				</AvGadget>
			</div>
		)
	}
}

ReactDOM.render( <TestGadgetLauncher/>, document.getElementById( "root" ) );
