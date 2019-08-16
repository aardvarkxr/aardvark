import * as React from 'react';

import { AvGadget } from './aardvark_gadget';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvSceneContext, AvNodeType, AvPanelMouseEvent, AvPanelMouseEventType, AvPanelHandler, Av, AvSharedTextureInfo } from 'common/aardvark';
import bind from 'bind-decorator';

export interface AvPanelProps extends AvBaseNodeProps
{
	interactive: boolean;
	customMouseHandler?: AvPanelHandler;
}

export class AvPanel extends AvBaseNode< AvPanelProps, {} >
{
	private m_sharedTextureInfo: AvSharedTextureInfo = null;

	constructor( props: any )
	{
		super( props );

		Av().subscribeToBrowserTexture( this.onUpdateBrowserTexture );
	}

	@bind onUpdateBrowserTexture( info: AvSharedTextureInfo )
	{
		this.m_sharedTextureInfo = info;
		AvGadget.instance().markDirty();
	}

	public buildNode()
	{
		if( this.props.customMouseHandler )
		{
			AvGadget.instance().setPanelHandler( this.m_nodeId, this.props.customMouseHandler );
		}
		else
		{
			AvGadget.instance().enableDefaultPanelHandling( this.m_nodeId );
		}

		let node = this.createNodeObject( AvNodeType.Panel, this.m_nodeId );
		node.propInteractive = this.props.interactive;
		node.propSharedTexture = this.m_sharedTextureInfo;
		return node;
	}
}