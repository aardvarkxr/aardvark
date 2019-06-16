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

function proximityUpdate( proxArray )
{
	var oElem = document.getElementById( 'stuff' );
	oElem.innerHTML = "Coords "
		+ proxArray[0].x + ", "
		+ proxArray[0].y + ", "
		+ proxArray[0].distance;
}


var myApp = window.aardvark.createApp( "Fnord the App" );
var myAppName = myApp.getName();
console.log( "My app is named", myAppName );

var sceneContext = myApp.startSceneContext();
var EAvSceneGraphNodeType = sceneContext.type;

sceneContext.startNode( 1, "panelorigin", EAvSceneGraphNodeType.Origin );
sceneContext.setOriginPath( "/user/hand/left" );

	sceneContext.startNode( 2, "xform", EAvSceneGraphNodeType.Transform );
	//sceneContext.setScale( 0.1, 0.1, 0.1 );

		sceneContext.startNode( 3, "panel", EAvSceneGraphNodeType.Panel );
		sceneContext.setTextureSource( "Fnord the App" ); 
		sceneContext.setInteractive( true );

		sceneContext.finishNode();
	sceneContext.finishNode();

sceneContext.finishNode();

sceneContext.startNode( 11, "pokerorigin", EAvSceneGraphNodeType.Origin );
sceneContext.setOriginPath( "/user/hand/right" );

	sceneContext.startNode( 12, "pokerxform", EAvSceneGraphNodeType.Transform );
	sceneContext.setScale( 0.03, 0.03, 0.03 );

		sceneContext.startNode( 13, "pokermodel", EAvSceneGraphNodeType.Model );
		sceneContext.setModelUri( "file:///e:/homedev/aardvark/data/models/sphere/sphere.glb" );
		sceneContext.finishNode();

	sceneContext.finishNode();

	sceneContext.startNode( 14, "poker", EAvSceneGraphNodeType.Poker );
	sceneContext.finishNode();

sceneContext.finishNode();


sceneContext.finish();

myApp.registerPokerHandler( 14, proximityUpdate );

