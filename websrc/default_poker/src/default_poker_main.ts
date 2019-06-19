import {Av, PokerProximity} from '../../common/aardvark';

var myApp = Av().createApp( "default_poker" );
var shouldHighlight = false;

function updateSceneGraph()
{
	var sceneContext = myApp.startSceneContext();
	var EAvSceneGraphNodeType = sceneContext.type;

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

function proximityUpdate( proxArray: PokerProximity[] )
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
