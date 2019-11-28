import * as React from 'react';

import { AvNodeType, EVolumeType, AvConstraint, AvGrabEvent, 
	EndpointAddr, AvGrabEventType, ENodeFlags } from '@aardvarkxr/aardvark-shared';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { HighlightType } from './aardvark_grabbable';
import bind from 'bind-decorator';
import { AvGadget } from './aardvark_gadget';

interface AvBaseHandleProps extends AvBaseNodeProps
{
	/** This callback is called when the handle's highlight state changes.
	 * Implement it to provide per-handle highlighting. UpdateHighlight on
	 * the containing AvGrabbable will also be called.
	 */
	updateHighlight?: ( highlightType: HighlightType ) => void;

	/** The transform constraint on this handle. 
	 * 
	 * @default no constraint
	 */
	constraint?: AvConstraint;

	/** If this property is true, the handle will enter the InRange highlight
	 * type, but will never actually be grabbed.
	 * 
	 * @default false
	 */
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
	/** The radius of the sphere for this handle */
	radius: number;
}

/** This is spherical grabbable handle. It must be contained
 * inside an AvGrabbable node.
 */
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
	/** The URI of the GLTF model to use to define the bounding box for this handle. */
	uri: string;
}

/** This is grabbable handle whose grab region is defined by the bounding box
 * of a model. It must be contained inside an AvGrabbable node.
 */
export class AvModelBoxHandle extends AvBaseHandle< AvModelBoxHandleProps, {} > 
{
	public buildNode()
	{
		let node = this.buildBaseHandle();
		node.propVolume = { type: EVolumeType.ModelBox, uri : this.props.uri };
		return node;
	}
}
