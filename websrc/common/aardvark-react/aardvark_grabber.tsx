import * as React from 'react';

import { AvGadget } from './aardvark_gadget';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvNodeType, AvGrabEvent, EVolumeType, AvGrabEventType, GrabberHighlight } from 'common/aardvark';
import bind from 'bind-decorator';


interface AvGrabberProps extends AvBaseNodeProps
{
	updateHighlight?: ( highlightType: GrabberHighlight ) => void;
	radius: number;
}

export class AvGrabber extends AvBaseNode< AvGrabberProps, {} >
{
	public buildNode()
	{
		AvGadget.instance().setGrabEventProcessor( this.m_nodeId, this.onGrabEvent );

		let node = this.createNodeObject( AvNodeType.Grabber, this.m_nodeId );
		node.propVolume = { type: EVolumeType.Sphere, radius : this.props.radius };
		return node;
	}

	@bind private onGrabEvent( evt: AvGrabEvent )
	{
		switch( evt.type )
		{
			case AvGrabEventType.UpdateGrabberHighlight:
				{
					if( this.props.updateHighlight )
					{
						this.props.updateHighlight( evt.highlight );
					}
				}
		}
	}
}
