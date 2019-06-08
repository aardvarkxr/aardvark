var counter = 1;

function updateStuff()
{
	var oElem = document.getElementById( 'stuff' );
	oElem.innerHTML = "blah " + counter;
	counter++;

}

var t = setInterval( updateStuff, 1000 );

var myApp = window.aardvark.createApp( "Fnord the App" );
var myAppName = myApp.getName();
console.log( "My app is named", myAppName );

var sceneContext = myApp.startSceneContext();
var EAvSceneGraphNodeType = sceneContext.type;

sceneContext.startNode( 1, "origin", EAvSceneGraphNodeType.Origin );
sceneContext.setOriginPath( "/user/hand/right" );

	sceneContext.startNode( 2, "xform", EAvSceneGraphNodeType.Transform );
	sceneContext.setScale( 0.1, 0.1, 0.1 );

		sceneContext.startNode( 3, "panel", EAvSceneGraphNodeType.Panel );
		sceneContext.setTextureSource( "Fnord the App" ); 
		//sceneContext.startNode( 3, "model", EAvSceneGraphNodeType.Model );
		//sceneContext.setModelUri( "file:///d:/Downloads/gltf-sample-models-master/2.0/BoxAnimated/glTF-Binary/BoxAnimated.glb" );
		//sceneContext.setModelUri( "file:///d:/homedev/aardvark/data/models/panel/panel.glb" );

		sceneContext.finishNode();
	sceneContext.finishNode();

sceneContext.finishNode();
sceneContext.finish();

