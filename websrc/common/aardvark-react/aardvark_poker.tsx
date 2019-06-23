import * as React from 'react';

import { AvApp } from './aardvark_app';
import { AvBaseNode } from './aardvark_base_node';
import { AvSceneContext, AvNodeType, AvPanelMouseEvent, AvPanelMouseEventType, PokerProximity } from 'common/aardvark';
import bind from 'bind-decorator';

interface AvPokerProps
{
	updateHighlight?: (shouldHighlight: boolean ) => void;
}

export class AvPoker extends AvBaseNode< AvPokerProps, {} >
{
	m_lastActivePanel:string = null;
	m_mouseDown: boolean = false;
	m_lastX = 0;
	m_lastY = 0;
	m_lastHighlight = false;

	public startNode( context:AvSceneContext )
	{
		context.startNode( this.m_nodeId, "poker" + this.m_nodeId, AvNodeType.Poker );

		AvApp.instance().setPokerHandler( this.m_nodeId, this.proximityUpdate );
	}

	private sendMouseLeave( panelId: string )
	{
		AvApp.instance().sendMouseEvent( this.m_nodeId, panelId, AvPanelMouseEventType.Leave, 0, 0 );
	}
	private sendMouseEnter( panelId: string, x: number, y: number )
	{
		AvApp.instance().sendMouseEvent( this.m_nodeId, panelId, AvPanelMouseEventType.Enter, x, y );
	}

	private sendMouseMove( panelId: string, x: number, y: number )
	{
		AvApp.instance().sendMouseEvent( this.m_nodeId, panelId, AvPanelMouseEventType.Move, x, y );
	}

	private sendMouseDown( panelId: string, x: number, y: number )
	{
		AvApp.instance().sendMouseEvent( this.m_nodeId, panelId, AvPanelMouseEventType.Down, x, y );
	}

	private sendMouseUp( panelId: string, x: number, y: number )
	{
		AvApp.instance().sendMouseEvent( this.m_nodeId, panelId, AvPanelMouseEventType.Up, x, y );
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

	
		if( shouldHighlight != this.m_lastHighlight )
		{
			this.m_lastHighlight = shouldHighlight;
			if( this.props.updateHighlight )
			{
				this.props.updateHighlight( this.m_lastHighlight );
			}
		}
	}

}
