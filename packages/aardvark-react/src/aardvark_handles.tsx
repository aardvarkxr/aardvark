import * as React from 'react';

import { AvNodeType, EVolumeType, AvConstraint, AvGrabEvent, 
	EndpointAddr, AvGrabEventType, ENodeFlags } from './aardvark_protocol';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { HighlightType } from './aardvark_grabbable';
import bind from 'bind-decorator';
import { AvGadget } from './aardvark_gadget';

interface AvBaseHandleProps extends AvBaseNodeProps
{
	updateHighlight?: ( highlightType: HighlightType ) => void;
	constraint?: AvConstraint;
	proximityOnly?: boolean;
}

interface AvBaseHandleState
{

}

export abstract class AvBaseHandle<TProps, TState> extends AvBaseNode<TProps, TState> 
{
	m_lastHighlight = HighlightType.None;

	protected get handleProps()
	{
		return this.props as AvBaseHandleProps;
	}

	protected buildBaseHandle()
	{
		let node = this.createNodeObject( AvNodeType.Handle, this.m_nodeId );
		node.propConstraint = this.handleProps.constraint;
		AvGadget.instance().setGrabEventProcessor( this.m_nodeId, this.onGrabEvent );

		if( this.handleProps.proximityOnly )
		{
			node.flags |= ENodeFlags.NotifyProximityWithoutGrab;
		}

		return node;
	}

	@bind protected onGrabEvent( evt: AvGrabEvent )
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
			if( this.handleProps.updateHighlight )
			{
				this.handleProps.updateHighlight( this.m_lastHighlight );
			}
		}
	}

	public grabInProgress( grabber: EndpointAddr ):void
	{
		this.m_lastHighlight = HighlightType.Grabbed;
		if( this.handleProps.updateHighlight )
		{
			this.handleProps.updateHighlight( this.m_lastHighlight );
		}
	}


}


interface AvSphereHandleProps extends AvBaseHandleProps
{
	radius: number;
}

export class AvSphereHandle extends AvBaseHandle< AvSphereHandleProps, {} > 
{
	public buildNode()
	{
		let node = this.buildBaseHandle();
		node.propVolume = { type: EVolumeType.Sphere, radius : this.props.radius };
		return node;
	}
}

interface AvModelBoxHandleProps extends AvBaseHandleProps
{
	uri: string;
}

export class AvModelBoxHandle extends AvBaseHandle< AvModelBoxHandleProps, {} > 
{
	public buildNode()
	{
		let node = this.buildBaseHandle();
		node.propVolume = { type: EVolumeType.ModelBox, uri : this.props.uri };
		return node;
	}
}
