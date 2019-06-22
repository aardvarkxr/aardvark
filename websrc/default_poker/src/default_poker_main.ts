import {Av, PokerProximity, AvNodeType, AvApp, AvPanelMouseEventType} from 'common/aardvark';
import bind from 'bind-decorator';

class CDefaultPoker
{
	m_shouldHighlight = false;
	m_baseId:number;
	m_pokerId:number;
	m_app:AvApp;
	m_lastActivePanel:string = null;
	m_mouseDown: boolean = false;
	m_lastX = 0;
	m_lastY = 0;

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
		var sceneContext = this.m_app.startSceneContext();
	
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

		this.m_app.registerPokerHandler( 14, this.proximityUpdate );
	}
	
	private sendMouseLeave( panelId: string )
	{
		this.m_app.sendMouseEvent( this.m_pokerId, panelId, AvPanelMouseEventType.Leave, 0, 0 );
	}
	private sendMouseEnter( panelId: string, x: number, y: number )
	{
		this.m_app.sendMouseEvent( this.m_pokerId, panelId, AvPanelMouseEventType.Enter, x, y );
	}

	private sendMouseMove( panelId: string, x: number, y: number )
	{
		this.m_app.sendMouseEvent( this.m_pokerId, panelId, AvPanelMouseEventType.Move, x, y );
	}

	private sendMouseDown( panelId: string, x: number, y: number )
	{
		this.m_app.sendMouseEvent( this.m_pokerId, panelId, AvPanelMouseEventType.Down, x, y );
	}

	private sendMouseUp( panelId: string, x: number, y: number )
	{
		this.m_app.sendMouseEvent( this.m_pokerId, panelId, AvPanelMouseEventType.Up, x, y );
	}

	@bind private proximityUpdate( proxArray: PokerProximity[] )
	{
		var shouldHighlight = false;

		let activePanelProx: PokerProximity = null;
		if( this.m_lastActivePanel )
		{
			// find the active panel from last frame
			for( let prox of proxArray )
			{
				if( prox.panelId == this.m_lastActivePanel )
				{
					activePanelProx = prox;
					break;
				}
			}

			// if it isn't nearby anymore, clean it up
			if( !activePanelProx )
			{
				if( this.m_mouseDown )
				{
					this.sendMouseUp( this.m_lastActivePanel, this.m_lastX, this.m_lastY );
					this.m_mouseDown = false;
				}
				this.sendMouseLeave( this.m_lastActivePanel );
				this.m_lastActivePanel = null;
			}
		}

		// if we aren't already locked to a panel, pick a new one
		if( !activePanelProx )
		{
			for( let prox of proxArray )
			{
				if( !activePanelProx || prox.distance < activePanelProx.distance )
				{
					activePanelProx = prox;
				}
			}

			// tell the new panel that it's the new panel
			if( activePanelProx )
			{
				this.m_lastActivePanel = activePanelProx.panelId;
				this.sendMouseEnter( activePanelProx.panelId, activePanelProx.x, activePanelProx.y );
			}
		}

		if( activePanelProx )
		{
			shouldHighlight = true;
			this.sendMouseMove( activePanelProx.panelId, activePanelProx.x, activePanelProx.y );
			this.m_lastX = activePanelProx.x;
			this.m_lastY = activePanelProx.y;
			
			if( !this.m_mouseDown && activePanelProx.distance < 0.1 )
			{
				this.m_mouseDown = true;
				this.sendMouseDown( activePanelProx.panelId, activePanelProx.x, activePanelProx.y );
			}
			else if( this.m_mouseDown && activePanelProx.distance > 0.15 )
			{
				this.m_mouseDown = false;
				this.sendMouseUp( activePanelProx.panelId, activePanelProx.x, activePanelProx.y );
			}
		}

	
		if( shouldHighlight != this.m_shouldHighlight )
		{
			this.m_shouldHighlight = shouldHighlight;
			this.updateSceneGraph();
		}
	}
}

var myApp = Av().createApp( "default_poker" );

var defaultPoker = new CDefaultPoker( 10, myApp );
