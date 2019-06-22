import * as React from 'react';

import { AvApp } from './aardvark_app';
import { AvBaseNode } from './aardvark_base_node';
import { AvSceneContext, AvNodeType, AvPanelMouseEvent, AvPanelMouseEventType } from 'common/aardvark';
import bind from 'bind-decorator';

interface AvPanelProps
{
	interactive: boolean;
}

export class AvPanel extends AvBaseNode< AvPanelProps, {} >
{
	public startNode( context:AvSceneContext )
	{
		context.startNode( this.m_nodeId, "panel" + this.m_nodeId, AvNodeType.Panel );
		context.setTextureSource( AvApp.instance().getName() );
		context.setInteractive( this.props.interactive );

		if( this.props.interactive )
		{
			AvApp.instance().setPanelHandler( this.m_nodeId, this.handleMouseEvent );
		}
	}

	@bind public handleMouseEvent( evt: AvPanelMouseEvent )
	{
		switch( evt.type )
		{
			case AvPanelMouseEventType.Down: 
				console.log( "mouse down: ", evt.panelId, evt.pokerId, evt.x, evt.y );
				break;
			case AvPanelMouseEventType.Up: 
				console.log( "mouse up: ", evt.panelId, evt.pokerId, evt.x, evt.y );
				break;
			case AvPanelMouseEventType.Enter: 
				console.log( "mouse enter: ", evt.panelId, evt.pokerId, evt.x, evt.y );
				break;
			case AvPanelMouseEventType.Leave: 
				console.log( "mouse leave: ", evt.panelId, evt.pokerId, evt.x, evt.y );
				break;
			case AvPanelMouseEventType.Move: 
	//			console.log( "mouse move: ", evt.panelId, evt.pokerId, evt.x, evt.y );
				break;
		}

	}

}