import * as React from 'react';
import  * as ReactDOM from 'react-dom';

import { AvGadget } from 'common/aardvark-react/aardvark_gadget';
import { AvOrigin } from 'common/aardvark-react/aardvark_origin';
import { AvTransform } from 'common/aardvark-react/aardvark_transform';
import { AvPanel } from 'common/aardvark-react/aardvark_panel';
import bind from 'bind-decorator';
import { AvGrabbable, HighlightType, GrabResponse } from 'common/aardvark-react/aardvark_grabbable';
import { AvSphereHandle } from 'common/aardvark-react/aardvark_handles';
import { AvGrabEvent } from 'common/aardvark';
import { EndpointAddr } from 'common/aardvark-react/aardvark_protocol';


interface TestPanelState
{
	count: number;
	grabbableHighlight: HighlightType;
}

class TestPanel extends React.Component< {}, TestPanelState >
{
	private m_panelId: EndpointAddr;

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
		this.setState( { count: this.state.count + 1 } );
	}

	@bind public onHighlightGrabbable( highlight: HighlightType )
	{
		this.setState( { grabbableHighlight: highlight } );
	}

	@bind public onGrabRequest( grabRequest: AvGrabEvent ): Promise< GrabResponse >
	{
		// this is totally unnecessary, but a good test of the plumbing.
		let response: GrabResponse =
		{
			allowed: true,
		};
		return Promise.resolve( response );
	}

	public render()
	{
		let sDivClasses:string;
		let scale = 0.4;
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

			case HighlightType.InHookRange:
				sDivClasses = "FullPage GrabbedHighlight";
				scale = 0.05;
				break;
		
		}

		return (
			<div className={ sDivClasses } >
				<AvGadget gadgetUri="">
					<AvGrabbable updateHighlight={ this.onHighlightGrabbable }
						onGrabRequest={ this.onGrabRequest }>
						<AvSphereHandle radius={0.1} />
						
						<AvTransform uniformScale={ scale }>
							<AvPanel interactive={true}
								onIdAssigned={ (id: EndpointAddr) => { this.m_panelId = id } }/>
						</AvTransform>
					</AvGrabbable>
				</AvGadget>
				<div className="Label">Count: { this.state.count }</div>
				<div className="Button" onMouseDown={ this.incrementCount }>
					Click Me!
					</div> 
			</div>
		)
	}
}

ReactDOM.render( <TestPanel/>, document.getElementById( "root" ) );
