import * as React from 'react';
import  * as ReactDOM from 'react-dom';
import { AvApp } from 'common/aardvark-react/aardvark_app';
import { AvOrigin } from 'common/aardvark-react/aardvark_origin';
import { AvTransform } from 'common/aardvark-react/aardvark_transform';
import { AvGrabber, GrabberHighlight } from 'common/aardvark-react/aardvark_grabber';
import bind from 'bind-decorator';
import { AvModel } from 'common/aardvark-react/aardvark_model';


interface DefaultGrabberState
{
	highlight: GrabberHighlight;
}

class DefaultGrabber extends React.Component< {}, DefaultGrabberState >
{
	constructor( props: any )
	{
		super( props );

		this.state = { highlight: GrabberHighlight.None };
	}

	@bind updateHighlight( newHighlight: GrabberHighlight )
	{
		this.setState( { highlight: newHighlight } );
	}

	public render()
	{
		let modelUri = "file:///e:/homedev/aardvark/data/models/sphere/sphere.glb";
		switch( this.state.highlight )
		{
			case GrabberHighlight.None:
					modelUri = "file:///e:/homedev/aardvark/data/models/sphere/sphere.glb";
					break;
			case GrabberHighlight.InRange:
					modelUri = "file:///e:/homedev/aardvark/data/models/sphere/sphere_highlight.glb";
					break;
			case GrabberHighlight.InRange:
					modelUri = "file:///e:/homedev/aardvark/data/models/sphere/sphere_highlight.glb";
					break;
		}

		return (
			<AvApp name="Grabber">
				<AvOrigin path="/user/hand/right">
					<AvTransform uniformScale= { 0.01 } >
						<AvModel uri={ modelUri }/>
					</AvTransform>

					<AvGrabber updateHighlight = { this.updateHighlight }
						radius={0.1} />
				</AvOrigin>
			</AvApp>
		);
	}
}

ReactDOM.render( <DefaultGrabber/>, document.getElementById( "root" ) );
