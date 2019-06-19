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

updateSceneGraph();

