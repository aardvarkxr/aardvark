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
	private m_panelId:number = 0;

	constructor( props: any )
	{
		super( props );
		this.state = { count: 0 };
	}

	@bind public incrementCount()
	{
		AvApp.instance().sendHapticEventFromPanel( 1234, 1, 1, 0 );
//		AvApp.instance().sendHapticEventFromPanel( 1234, 1, 30, 2 );
		this.setState( { count: this.state.count + 1 } );
	}

	@bind onMouseEnterOrLeave()
	{
		AvApp.instance().sendHapticEventFromPanel( 1234, 0.05, 1, 0 );
//		AvApp.instance().sendHapticEventFromPanel( 1234, 1, 30, 2 );
	}

	public render()
	{
		return (
			<div>
				<AvApp name="Fnord the app">
					<AvOrigin path="/user/hand/left">
						<AvTransform uniformScale={0.4}>
							<AvPanel interactive={true}
								onIdAssigned={ (id:number) => { this.m_panelId = id } }/>
						</AvTransform>
					</AvOrigin>
				</AvApp>
				<div className="Label">Count: { this.state.count }</div>
				<div className="Button" onMouseDown={ this.incrementCount }
					onMouseEnter={ this.onMouseEnterOrLeave } 
					onMouseLeave={ this.onMouseEnterOrLeave }>
					Click Me!
					</div> 
			</div>
		)
	}
}

ReactDOM.render( <TestPanel/>, document.getElementById( "root" ) );
