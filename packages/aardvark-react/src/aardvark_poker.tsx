import { AvGadget } from './aardvark_gadget';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import bind from 'bind-decorator';
import { EndpointAddr, endpointAddrsMatch, AvNodeType, AvPanelMouseEventType, PokerProximity } from './aardvark_protocol';

interface AvPokerProps extends AvBaseNodeProps
{
	updateHighlight?: (shouldHighlight: boolean ) => void;
}

export class AvPoker extends AvBaseNode< AvPokerProps, {} >
{
	m_lastActivePanel:EndpointAddr = null;
	m_mouseDown: boolean = false;
	m_lastX = 0;
	m_lastY = 0;
	m_lastHighlight = false;

	public buildNode()
	{
		AvGadget.instance().setPokerHandler( this.m_nodeId, this.proximityUpdate );
		return this.createNodeObject( AvNodeType.Poker, this.m_nodeId );
	}

	private sendMouseLeave( panelId: EndpointAddr )
	{
		AvGadget.instance().sendMouseEvent( this.endpointAddr(), panelId, AvPanelMouseEventType.Leave, 0, 0 );
	}
	private sendMouseEnter( panelId: EndpointAddr, x: number, y: number )
	{
		AvGadget.instance().sendMouseEvent( this.endpointAddr(), panelId, AvPanelMouseEventType.Enter, x, y );
	}

	private sendMouseMove( panelId: EndpointAddr, x: number, y: number )
	{
		AvGadget.instance().sendMouseEvent( this.endpointAddr(), panelId, AvPanelMouseEventType.Move, x, y );
	}

	private sendMouseDown( panelId: EndpointAddr, x: number, y: number )
	{
		AvGadget.instance().sendMouseEvent( this.endpointAddr(), panelId, AvPanelMouseEventType.Down, x, y );
	}

	private sendMouseUp( panelId: EndpointAddr, x: number, y: number )
	{
		AvGadget.instance().sendMouseEvent( this.endpointAddr(), panelId, AvPanelMouseEventType.Up, x, y );
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
				if( endpointAddrsMatch( prox.panelId, this.m_lastActivePanel ) )
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
