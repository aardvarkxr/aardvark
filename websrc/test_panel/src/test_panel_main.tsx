import * as React from 'react';
import  * as ReactDOM from 'react-dom';

import { AvApp } from 'common/aardvark-react/aardvark_app';
import { AvOrigin } from 'common/aardvark-react/aardvark_origin';
import { AvTransform } from 'common/aardvark-react/aardvark_transform';
import { AvPanel } from 'common/aardvark-react/aardvark_panel';
import bind from 'bind-decorator';


interface TestPanelState
{
	count: number;
}
class TestPanel extends React.Component< {}, TestPanelState >
{
	constructor( props: any )
	{
		super( props );
		this.state = { count: 0 };
	}

	@bind public incrementCount()
	{
		this.setState( { count: this.state.count + 1 } );
	}

	public render()
	{
		return (
			<div>
				<AvApp name="Fnord the app">
					<AvOrigin path="/user/hand/left">
						<AvTransform uniformScale={0.4}>
							<AvPanel interactive={true}/>
						</AvTransform>
					</AvOrigin>
				</AvApp>
				<div className="Label">Count: { this.state.count }</div>
				<div className="Button" onMouseDown={ this.incrementCount }>Click Me!</div> 
			</div>
		)
	}
}

ReactDOM.render( <TestPanel/>, document.getElementById( "root" ) );
