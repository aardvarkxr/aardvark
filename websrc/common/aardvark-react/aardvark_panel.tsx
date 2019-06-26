import * as React from 'react';

import { AvApp } from './aardvark_app';
import { AvBaseNode } from './aardvark_base_node';
import { AvSceneContext, AvNodeType, AvPanelMouseEvent, AvPanelMouseEventType, AvPanelHandler } from 'common/aardvark';
import bind from 'bind-decorator';

interface AvPanelProps
{
	interactive: boolean;
	customMouseHandler?: AvPanelHandler;
}

export class AvPanel extends AvBaseNode< AvPanelProps, {} >
{
	public startNode( context:AvSceneContext )
	{
		context.startNode( this.m_nodeId, "panel" + this.m_nodeId, AvNodeType.Panel );
		context.setTextureSource( AvApp.instance().getName() );
		context.setInteractive( this.props.interactive );

		if( this.props.customMouseHandler )
		{
			AvApp.instance().setPanelHandler( this.m_nodeId, this.props.customMouseHandler );
		}
		else
		{
			AvApp.instance().enableDefaultPanelHandling( this.m_nodeId );
		}
	}

}