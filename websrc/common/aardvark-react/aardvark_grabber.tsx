import * as React from 'react';

import { AvGadget } from './aardvark_gadget';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvNodeType, AvGrabEvent, EVolumeType } from 'common/aardvark';
import bind from 'bind-decorator';
import { EndpointAddr, indexOfEndpointAddrs, endpointAddrsMatch, endpointAddrToString } from './aardvark_protocol';
import { GrabberHighlight, CGrabStateProcessor } from './grab_state_processor';


interface AvGrabberProps extends AvBaseNodeProps
{
	updateHighlight?: ( highlightType: GrabberHighlight ) => void;
	radius: number;
}

export class AvGrabber extends AvBaseNode< AvGrabberProps, {} >
{
	m_processor: CGrabStateProcessor;
	
	public buildNode()
	{
		AvGadget.instance().setGrabberProcessor( this.m_nodeId, this.onGrabberIntersections );
		AvGadget.instance().setGrabEventProcessor( this.m_nodeId, this.onGrabEvent );

		if( !this.m_processor )
		{
			this.m_processor = new CGrabStateProcessor(
				{
					updateHighlight: this.props.updateHighlight,
					sendGrabEvent: ( event: AvGrabEvent ) => { AvGadget.instance().sendGrabEvent( event ) },
					grabberEpa: this.endpointAddr()
				}
			)
		}

		let node = this.createNodeObject( AvNodeType.Grabber, this.m_nodeId );
		node.propVolume = { type: EVolumeType.Sphere, radius : this.props.radius };
		return node;
	}

	@bind private onGrabEvent( evt: AvGrabEvent )
	{
		this.m_processor.onGrabEvent( evt );
	}

	@bind private onGrabberIntersections( isPressed: boolean, grabbableIds: EndpointAddr[], 
		hookIds: EndpointAddr[] )
	{
		this.m_processor.onGrabberIntersections( isPressed, grabbableIds, hookIds );
	}
}
