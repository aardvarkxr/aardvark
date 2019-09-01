import * as React from 'react';
import  * as ReactDOM from 'react-dom';
import { AvGadget, parseURL } from 'common/aardvark-react/aardvark_gadget';
import { AvOrigin } from 'common/aardvark-react/aardvark_origin';
import { AvTransform } from 'common/aardvark-react/aardvark_transform';
import { AvGrabber, GrabberHighlight } from 'common/aardvark-react/aardvark_grabber';
import bind from 'bind-decorator';
import { AvModel } from 'common/aardvark-react/aardvark_model';
import { AvPoker } from 'common/aardvark-react/aardvark_poker';
import { AvStandardHook } from 'common/aardvark-react/aardvark_standard_hook';


interface DefaultHandState
{
	grabberHighlight: GrabberHighlight;
	pokerHighlight: boolean;
}

class DefaultHand extends React.Component< {}, DefaultHandState >
{
	constructor( props: any )
	{
		super( props );

		let params = parseURL( window.location.href );
		if( params["initialHook"] == "/user/hand/left" )
		{
			window.document.title = "Left Hand";
		}
		else if( params["initialHook"] == "/user/hand/right" )
		{
			window.document.title = "Right Hand";
		}
		this.state = 
		{ 
			grabberHighlight: GrabberHighlight.None,
			pokerHighlight: false,
		};
	}

	@bind updateGrabberHighlight( newHighlight: GrabberHighlight )
	{
		this.setState( { grabberHighlight: newHighlight } );
	}

	@bind updatePokerHighlight( newHighlight: boolean )
	{
		this.setState( { pokerHighlight: newHighlight } );
	}

	
	public render()
	{
		let modelUri = "https://aardvark.install/models/sphere/sphere.glb";
		switch( this.state.grabberHighlight )
		{
			case GrabberHighlight.NearHook:
			case GrabberHighlight.Grabbed:
			case GrabberHighlight.WaitingForConfirmation:
			case GrabberHighlight.InRange:
					modelUri = "https://aardvark.install/models/sphere/sphere_highlight.glb";
					break;
		}

		// poker highlight takes priority
		if( this.state.pokerHighlight )
		{
			modelUri = "https://aardvark.install/models/sphere/sphere_highlight.glb";
		}

		return (
			<AvGadget>
				<AvTransform uniformScale= { 0.01 } >
					<AvModel uri={ modelUri }/>
				</AvTransform>

				<AvPoker updateHighlight = { this.updatePokerHighlight } />
				<AvGrabber updateHighlight = { this.updateGrabberHighlight }
					radius={0.001} />
				<AvStandardHook persistentName="base"/>
			</AvGadget>
		);
	}
}

ReactDOM.render( <DefaultHand/>, document.getElementById( "root" ) );
