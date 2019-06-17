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

	sceneContext.startNode( 11, "pokerorigin", EAvSceneGraphNodeType.Origin );
	sceneContext.setOriginPath( "/user/hand/right" );

		sceneContext.startNode( 12, "pokerxform", EAvSceneGraphNodeType.Transform );
		sceneContext.setScale( 0.01, 0.01, 0.01 );

			sceneContext.startNode( 13, "pokermodel", EAvSceneGraphNodeType.Model );
			if( shouldHighlight )
			{
				sceneContext.setModelUri( "file:///e:/homedev/aardvark/data/models/sphere/sphere_highlight.glb" );
			}
			else
			{
				sceneContext.setModelUri( "file:///e:/homedev/aardvark/data/models/sphere/sphere.glb" );
			}
			sceneContext.finishNode();

		sceneContext.finishNode();

		sceneContext.startNode( 14, "poker", EAvSceneGraphNodeType.Poker );
		sceneContext.finishNode();

	sceneContext.finishNode();


	sceneContext.finish();
}

function proximityUpdate( proxArray )
{
	var oElem = document.getElementById( 'stuff' );
	var oldHighlight = shouldHighlight;
	if( proxArray.length == 0 )
	{
		oElem.innerHTML = "No prox";
		shouldHighlight = false;
	}
	else
	{
		oElem.innerHTML = ""
			+ proxArray[0].x.toFixed(2) + ", "
			+ proxArray[0].y.toFixed(2) + ", "
			+ proxArray[0].distance.toFixed(2);
		shouldHighlight = true;
	}

	if( oldHighlight != shouldHighlight )
	{
		updateSceneGraph();
	}
}


updateSceneGraph();
myApp.registerPokerHandler( 14, proximityUpdate );

