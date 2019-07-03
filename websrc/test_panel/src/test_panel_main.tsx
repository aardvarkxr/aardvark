import * as React from 'react';
import  * as ReactDOM from 'react-dom';

import { AvApp } from 'common/aardvark-react/aardvark_app';
import { AvOrigin } from 'common/aardvark-react/aardvark_origin';
import { AvTransform } from 'common/aardvark-react/aardvark_transform';
import { AvPanel } from 'common/aardvark-react/aardvark_panel';
import bind from 'bind-decorator';
import { AvGrabbable, HighlightType } from 'common/aardvark-react/aardvark_grabbable';
import { AvSphereHandle } from 'common/aardvark-react/aardvark_handles';


interface TestPanelState
{
	count: number;
	grabbableHighlight: HighlightType;
}

class TestPanel extends React.Component< {}, TestPanelState >
{
	private m_panelId:number = 0;

	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
			count: 0,
			grabbableHighlight: HighlightType.None,
		};
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

	@bind public onHighlightGrabbable( highlight: HighlightType )
	{
		this.setState( { grabbableHighlight: highlight } );
	}
	public render()
	{
		let sDivClasses:string;
		switch( this.state.grabbableHighlight )
		{
			case HighlightType.None:
				sDivClasses = "FullPage NoGrabHighlight";
				break;

			case HighlightType.InRange:
				sDivClasses = "FullPage InRangeHighlight";
				break;

			case HighlightType.Grabbed:
				sDivClasses = "FullPage GrabbedHighlight";
				break;

		}

		return (
			<div className={ sDivClasses } >
				<AvApp name="Fnord the app">
					<AvOrigin path="/user/hand/left">
						<AvGrabbable updateHighlight={ this.onHighlightGrabbable }>
							<AvSphereHandle radius={0.1} />
							
							<AvTransform uniformScale={0.4}>
								<AvPanel interactive={true}
									onIdAssigned={ (id:number) => { this.m_panelId = id } }/>
							</AvTransform>
						</AvGrabbable>
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
