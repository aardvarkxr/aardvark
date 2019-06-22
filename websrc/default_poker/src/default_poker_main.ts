import {Av, PokerProximity, AvNodeType, AvApp} from 'common/aardvark';
import bind from 'bind-decorator';

class CDefaultPoker
{
	m_shouldHighlight = false;
	m_baseId:number;
	m_pokerId:number;
	m_app:AvApp;

	constructor( baseId: number, app:AvApp )
	{
		this.m_baseId = baseId;
		this.m_pokerId = baseId + 4;
		this.m_app = app;

		this.updateSceneGraph();
	}

	private updateSceneGraph()
	{
		// TODO: Move this to be global
		var sceneContext = myApp.startSceneContext();
	
		sceneContext.startNode( this.m_baseId + 1, "pokerorigin", AvNodeType.Origin );
		sceneContext.setOriginPath( "/user/hand/right" );
	
			sceneContext.startNode( this.m_baseId + 2, "pokerxform", AvNodeType.Transform );
			sceneContext.setScale( 0.01, 0.01, 0.01 );
	
				sceneContext.startNode( this.m_baseId + 3, "pokermodel", AvNodeType.Model );
				if( this.m_shouldHighlight )
				{
					sceneContext.setModelUri( "file:///e:/homedev/aardvark/data/models/sphere/sphere_highlight.glb" );
				}
				else
				{
					sceneContext.setModelUri( "file:///e:/homedev/aardvark/data/models/sphere/sphere.glb" );
				}
				sceneContext.finishNode();
	
			sceneContext.finishNode();
	
			sceneContext.startNode( this.m_pokerId, "poker", AvNodeType.Poker );
			sceneContext.finishNode();
	
		sceneContext.finishNode();
	
	
		sceneContext.finish();

		myApp.registerPokerHandler( 14, this.proximityUpdate );
	}
	
	@bind private proximityUpdate( proxArray: PokerProximity[] )
	{
		var oElem = document.getElementById( 'stuff' );
		var oldHighlight = this.m_shouldHighlight;
		if( proxArray.length == 0 )
		{
			this.m_shouldHighlight = false;
		}
		else
		{
			this.m_shouldHighlight = true;
		}
	
		if( oldHighlight != this.m_shouldHighlight )
		{
			this.updateSceneGraph();
		}
	}
		
}

var myApp = Av().createApp( "default_poker" );

var defaultPoker = new CDefaultPoker( 10, myApp );
