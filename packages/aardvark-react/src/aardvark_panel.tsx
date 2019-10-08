import * as React from 'react';

import { AvGadget } from './aardvark_gadget';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { Av } from './aardvark';
import bind from 'bind-decorator';
import { AvNodeType, AvPanelMouseEvent, AvPanelMouseEventType, AvPanelHandler, 
	AvSharedTextureInfo } from './aardvark_protocol';

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

	@bind onDefaultMouseEvent( event: AvPanelMouseEvent )
	{
		let hapticAmplitude = 0;
		switch( event.type )
		{
			case AvPanelMouseEventType.Enter:
			case AvPanelMouseEventType.Leave:
				hapticAmplitude = 0.05;
				break;

			case AvPanelMouseEventType.Down:
				hapticAmplitude = 1;
				break;
		}

		if( hapticAmplitude > 0 )
		{
			AvGadget.instance().sendHapticEvent( event.pokerId, hapticAmplitude, 1, 0 );
		}

		Av().spoofMouseEvent( event.type, event.x, event.y );
	}

	public buildNode()
	{
		if( this.props.customMouseHandler )
		{
			AvGadget.instance().setPanelHandler( this.m_nodeId, this.props.customMouseHandler );
		}
		else
		{
			AvGadget.instance().setPanelHandler( this.m_nodeId, this.onDefaultMouseEvent );
		}

		let node = this.createNodeObject( AvNodeType.Panel, this.m_nodeId );
		node.propInteractive = this.props.interactive;
		node.propSharedTexture = this.m_sharedTextureInfo;
		return node;
	}
}