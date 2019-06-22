var counter = 1;

//function updateStuff()
//{
//	var oElem = document.getElementById( 'stuff' );
//	oElem.innerHTML = "blah " + counter;
//	counter++;
//
//}
//
//var t = setInterval( updateStuff, 1000 );

var myApp = window.aardvark.createApp( "Fnord the App" );
var myAppName = myApp.getName();
console.log( "My app is named", myAppName );
var shouldHighlight = false;

function updateSceneGraph()
{
	var sceneContext = myApp.startSceneContext();
	var EAvSceneGraphNodeType = sceneContext.type;

	sceneContext.startNode( 1, "panelorigin", EAvSceneGraphNodeType.Origin );
	sceneContext.setOriginPath( "/user/hand/left" );

		sceneContext.startNode( 2, "xform", EAvSceneGraphNodeType.Transform );
		sceneContext.setScale( 0.4, 0.4, 0.4 );

			sceneContext.startNode( 3, "panel", EAvSceneGraphNodeType.Panel );
			sceneContext.setTextureSource( "Fnord the App" ); 
			sceneContext.setInteractive( true );

			sceneContext.finishNode();
		sceneContext.finishNode();

	sceneContext.finishNode();

	sceneContext.finish();
}

function handleMouseEvent( evt )
{
	switch( evt.type )
	{
		case 1: 
			console.log( "mouse down: ", evt.panelId, evt.pokerId, evt.x, evt.y );
			break;
		case 2: 
			console.log( "mouse up: ", evt.panelId, evt.pokerId, evt.x, evt.y );
			break;
		case 3: 
			console.log( "mouse enter: ", evt.panelId, evt.pokerId, evt.x, evt.y );
			break;
		case 4: 
			console.log( "mouse leave: ", evt.panelId, evt.pokerId, evt.x, evt.y );
			break;
		case 5: 
//			console.log( "mouse move: ", evt.panelId, evt.pokerId, evt.x, evt.y );
			break;
	}

}

updateSceneGraph();
myApp.registerPanelHandler( 3, handleMouseEvent );

