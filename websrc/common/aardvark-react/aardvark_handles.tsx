import * as React from 'react';

import { AvNodeType, EVolumeType, AvConstraint, AvGrabEvent, AvGrabEventType } from 'common/aardvark';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { HighlightType } from './aardvark_grabbable';
import bind from 'bind-decorator';
import { AvGadget } from './aardvark_gadget';
import { EndpointAddr } from './aardvark_protocol';

interface AvSphereHandleProps extends AvBaseNodeProps
{
	radius: number;
	updateHighlight?: ( highlightType: HighlightType ) => void;
	constraint?: AvConstraint;
}

export class AvSphereHandle extends AvBaseNode< AvSphereHandleProps, {} > 
{
	m_lastHighlight = HighlightType.None;

	@bind private onGrabEvent( evt: AvGrabEvent )
	{
		// by default, don't change the highlight
		var newHighlight = this.m_lastHighlight;

		switch( evt.type )
		{
			case AvGrabEventType.EnterRange:
				newHighlight = HighlightType.InRange;
				break;

			case AvGrabEventType.LeaveRange:
				newHighlight = HighlightType.None;
				break;

			case AvGrabEventType.StartGrab:
				newHighlight = HighlightType.Grabbed;
				break;

			case AvGrabEventType.EndGrab:
				newHighlight = HighlightType.InRange;
				break;

			case AvGrabEventType.EnterHookRange:
				newHighlight = HighlightType.InHookRange;
				break;

			case AvGrabEventType.LeaveHookRange:
				newHighlight = HighlightType.Grabbed;
				break;
		}

		if( newHighlight != this.m_lastHighlight )
		{
			this.m_lastHighlight = newHighlight;
			if( this.props.updateHighlight )
			{
				this.props.updateHighlight( this.m_lastHighlight );
			}
		}
	}

	public grabInProgress( grabber: EndpointAddr ):void
	{
		this.m_lastHighlight = HighlightType.Grabbed;
		if( this.props.updateHighlight )
		{
			this.props.updateHighlight( this.m_lastHighlight );
		}
	}


	public buildNode()
	{
		let node = this.createNodeObject( AvNodeType.Handle, this.m_nodeId );
		node.propVolume = { type: EVolumeType.Sphere, radius : this.props.radius };
		node.propConstraint = this.props.constraint;
		AvGadget.instance().setGrabEventProcessor( this.m_nodeId, this.onGrabEvent );
		return node;
	}
}

