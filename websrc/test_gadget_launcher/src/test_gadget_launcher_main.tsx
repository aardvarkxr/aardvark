import * as React from 'react';
import  * as ReactDOM from 'react-dom';

import { AvGadget } from 'common/aardvark-react/aardvark_gadget';
import { AvOrigin } from 'common/aardvark-react/aardvark_origin';
import { AvTransform } from 'common/aardvark-react/aardvark_transform';
import { AvPanel } from 'common/aardvark-react/aardvark_panel';
import bind from 'bind-decorator';
import { AvGrabbable, HighlightType, GrabResponse } from 'common/aardvark-react/aardvark_grabbable';
import { AvSphereHandle } from 'common/aardvark-react/aardvark_handles';
import { AvGrabEvent, Av } from 'common/aardvark';
import { AvModel } from 'common/aardvark-react/aardvark_model';
import { GrabberHighlight } from 'common/aardvark-react/aardvark_grabber';


interface TestGadgetLauncherState
{
	count: number;
	grabbableHighlight: HighlightType;
}

class TestGadgetLauncher extends React.Component< {}, TestGadgetLauncherState >
{
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
		AvGadget.instance().sendHapticEventFromPanel( 1234, 1, 1, 0 );
		this.setState( { count: this.state.count + 1 } );
	}

	@bind onMouseEnterOrLeave()
	{
		AvGadget.instance().sendHapticEventFromPanel( 1234, 0.05, 1, 0 );
	}

	@bind public onGrabRequest( grabRequest: AvGrabEvent ): Promise< GrabResponse >
	{
		return new Promise<GrabResponse>( ( resolve, reject ) =>
		{
			Av().startGadget( "https://aardvark.install/gadgets/test_panel", "",
			( success: boolean, mainGrabbableId: string ) =>
			{
				if( success )
				{
					let response: GrabResponse =
					{
						allowed: true,
						proxyGrabbableGlobalId: mainGrabbableId,
					};
					resolve( response );
				}
				else
				{
					reject( "startGadget failed");
				}
			});
		} );
	}

	@bind public onGadgetStarted( success: boolean, mainGrabbableId: string ) 
	{
		console.log( "main grabbable id was "+ mainGrabbableId );
	}
	
	@bind public onHighlightGrabbable( highlight: HighlightType )
	{
		this.setState( { grabbableHighlight: highlight } );
	}

	public render()
	{
		let scale:number;
		switch( this.state.grabbableHighlight )
		{
			case HighlightType.None:
				scale = 0.2;
				break;

			default:
				scale = 0.25;
				break;
		}
		return (
			<div >
				<AvGadget name="Test App Launcher">
					<AvGrabbable updateHighlight={ this.onHighlightGrabbable }
						onGrabRequest={ this.onGrabRequest }>
						<AvTransform translateX={ scale }>
							<AvSphereHandle radius={0.1} />
							
							<AvTransform uniformScale={0.3}>
								<AvModel uri="https://aardvark.install/models/DamagedHelmet/glTF-Embedded/DamagedHelmet.gltf" />
							</AvTransform>
						</AvTransform>
					</AvGrabbable>
				</AvGadget>
			</div>
		)
	}
}

ReactDOM.render( <TestGadgetLauncher/>, document.getElementById( "root" ) );
