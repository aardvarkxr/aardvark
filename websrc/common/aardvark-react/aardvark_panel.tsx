import * as React from 'react';

import { AvGadget } from './aardvark_gadget';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvSceneContext, AvNodeType, AvPanelMouseEvent, AvPanelMouseEventType, AvPanelHandler } from 'common/aardvark';
import bind from 'bind-decorator';

export interface AvPanelProps extends AvBaseNodeProps
{
	interactive: boolean;
	customMouseHandler?: AvPanelHandler;
}

export class AvPanel extends AvBaseNode< AvPanelProps, {} >
{
	public startNode( context:AvSceneContext )
	{
		context.startNode( this.m_nodeId, "panel" + this.m_nodeId, AvNodeType.Panel );
		context.setTextureSource( AvGadget.instance().getName() );
		context.setInteractive( this.props.interactive );

		if( this.props.customMouseHandler )
		{
			AvGadget.instance().setPanelHandler( this.m_nodeId, this.props.customMouseHandler );
		}
		else
		{
			AvGadget.instance().enableDefaultPanelHandling( this.m_nodeId );
		}
	}

}