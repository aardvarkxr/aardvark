import * as React from 'react';
import  * as ReactDOM from 'react-dom';
import { AvApp } from 'common/aardvark-react/aardvark_app';
import { AvOrigin } from 'common/aardvark-react/aardvark_origin';
import { AvTransform } from 'common/aardvark-react/aardvark_transform';
import { AvPoker } from 'common/aardvark-react/aardvark_poker';
import bind from 'bind-decorator';
import { AvModel } from 'common/aardvark-react/aardvark_model';


interface DefaultPokerState
{
	highlight: boolean;
}

class DefaultPoker extends React.Component< {}, DefaultPokerState >
{
	constructor( props: any )
	{
		super( props );

		this.state = { highlight: false };
	}

	@bind updateHighlight( shouldHighlight: boolean )
	{
		this.setState( { highlight: shouldHighlight } );
	}

	public render()
	{
		return (
			<AvApp name="poker">
				<AvOrigin path="/user/hand/right">
					<AvTransform uniformScale= { 0.01 } >
						<AvModel uri={ this.state.highlight 
							? "file:///e:/homedev/aardvark/data/models/sphere/sphere_highlight.glb"
							: "file:///e:/homedev/aardvark/data/models/sphere/sphere.glb"
							}/>
					</AvTransform>

					<AvPoker updateHighlight = { this.updateHighlight } />
				</AvOrigin>
			</AvApp>
		);
	}
}

ReactDOM.render( <DefaultPoker/>, document.getElementById( "root" ) );
