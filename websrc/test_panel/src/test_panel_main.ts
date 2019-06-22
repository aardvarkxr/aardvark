import { AvPanelMouseEvent, AvPanelMouseEventType, Av, AvNodeType } from 'common/aardvark';


let myApp = Av().createApp( "Fnord the App" );

function updateSceneGraph()
{
	let sceneContext = myApp.startSceneContext();

	sceneContext.startNode( 1, "panelorigin", AvNodeType.Origin );
	sceneContext.setOriginPath( "/user/hand/left" );

		sceneContext.startNode( 2, "xform", AvNodeType.Transform );
		sceneContext.setScale( 0.4, 0.4, 0.4 );

			sceneContext.startNode( 3, "panel", AvNodeType.Panel );
			sceneContext.setTextureSource( "Fnord the App" ); 
			sceneContext.setInteractive( true );

			sceneContext.finishNode();
		sceneContext.finishNode();

	sceneContext.finishNode();

	sceneContext.finish();
}

function handleMouseEvent( evt: AvPanelMouseEvent )
{
	switch( evt.type )
	{
		case AvPanelMouseEventType.Down: 
			console.log( "mouse down: ", evt.panelId, evt.pokerId, evt.x, evt.y );
			break;
		case AvPanelMouseEventType.Up: 
			console.log( "mouse up: ", evt.panelId, evt.pokerId, evt.x, evt.y );
			break;
		case AvPanelMouseEventType.Enter: 
			console.log( "mouse enter: ", evt.panelId, evt.pokerId, evt.x, evt.y );
			break;
		case AvPanelMouseEventType.Leave: 
			console.log( "mouse leave: ", evt.panelId, evt.pokerId, evt.x, evt.y );
			break;
		case AvPanelMouseEventType.Move: 
//			console.log( "mouse move: ", evt.panelId, evt.pokerId, evt.x, evt.y );
			break;
	}

}

updateSceneGraph();
myApp.registerPanelHandler( 3, handleMouseEvent );
