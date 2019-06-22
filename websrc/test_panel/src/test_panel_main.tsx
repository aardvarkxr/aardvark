import * as React from 'react';
import  * as ReactDOM from 'react-dom';

import { AvApp } from 'common/aardvark-react/aardvark_app';
import { AvOrigin } from 'common/aardvark-react/aardvark_origin';
import { AvTransform } from 'common/aardvark-react/aardvark_transform';
import { AvPanel } from 'common/aardvark-react/aardvark_panel';


class TestPanel extends React.Component
{
	constructor( props: any )
	{
		super( props );
	}

	public render()
	{
		return (
			<AvApp name="Fnord the app">
				<AvOrigin path="/user/hand/left">
					<AvTransform uniformScale={0.4}>
						<AvPanel interactive={true}/>
					</AvTransform>
				</AvOrigin>
			</AvApp>
		)
		// let myApp = Av().createApp( "Fnord the App" );

	// 	function updateSceneGraph()
	// 	{
	// 		let sceneContext = myApp.startSceneContext();
		
	// 		sceneContext.startNode( 1, "panelorigin", AvNodeType.Origin );
	// 		sceneContext.setOriginPath( "/user/hand/left" );
		
	// 			sceneContext.startNode( 2, "xform", AvNodeType.Transform );
	// 			sceneContext.setScale( 0.4, 0.4, 0.4 );
		
	// 				sceneContext.startNode( 3, "panel", AvNodeType.Panel );
	// 				sceneContext.setTextureSource( "Fnord the App" ); 
	// 				sceneContext.setInteractive( true );
		
	// 				sceneContext.finishNode();
	// 			sceneContext.finishNode();
		
	// 		sceneContext.finishNode();
		
	// 		sceneContext.finish();
		
	// }
	}
}

ReactDOM.render( <TestPanel/>, document.getElementById( "root" ) );
