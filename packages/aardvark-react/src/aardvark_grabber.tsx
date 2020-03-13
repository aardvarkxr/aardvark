import * as React from 'react';
import { AvGadget } from './aardvark_gadget';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvNodeType, AvGrabEvent, EVolumeType, AvGrabEventType, GrabberHighlight, 
	EndpointAddr, ENodeFlags } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import { AvDropIndicator } from './aardvark_drop_indicator';


interface AvGrabberProps extends AvBaseNodeProps
{
	/** This callback is called when the grabber's highlight state
	 * has changed.
	 * 
	 * @default grabber will not highlight
	 */
	updateHighlight?: ( highlightType: GrabberHighlight ) => void;

	/** The radius of the grabber. The grabber must be within this
	 * radius of a grabbable's handle's volume in order to interact with it.
	 */
	radius: number;
}

interface AvGrabberState
{
	highlight?: GrabberHighlight;
	grabbableId?: EndpointAddr;
	grabbableFlags?: number;
	hookId?: EndpointAddr;
}


/** Defines a grabber, which can be used to interact with grabbables.
 * This node will cause grab highlight updates when it enters the
 * volume of grabbable handles, and respond to the grab button on 
 * whatever hand it is parented to.
 */
export class AvGrabber extends AvBaseNode< AvGrabberProps, AvGrabberState >
{
	constructor( props: any )
	{
		super( props );
		this.state = {}
	}

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

					this.setState(
						{
							highlight: evt.highlight,
							grabbableId: evt.grabbableId,
							grabbableFlags: evt.grabbableFlags,
							hookId: evt.hookId,
						}
					)
				}
		}
	}

	private allowStageDrop()
	{
		if( !this.state.grabbableFlags )
			return false;
		else
			return 0 != ( ENodeFlags.PreserveGrabTransform & this.state.grabbableFlags );
	}

	private tethered()
	{
		if( !this.state.grabbableFlags )
			return false;
		else
			return 0 != ( ENodeFlags.Tethered & this.state.grabbableFlags );
	}
	
	renderDropIndicator()
	{
		if( !this.state.grabbableFlags || 0 == ( ENodeFlags.ShowGrabIndicator & this.state.grabbableFlags ) )
		{
			return null;
		}

		switch( this.state.highlight )
		{
			default:
				return null;

			case GrabberHighlight.Grabbed:
			case GrabberHighlight.NearHook:
				return <AvDropIndicator grabbable={ this.state.grabbableId }
					hook={ this.state.hookId }
					allowStageDrop={ this.allowStageDrop() }
					tethered={ this.tethered() }
					/>;
		}
	}

	render()
	{
		return <>
			{ this.baseNodeRender( this, this.props.children ) }
			{ this.renderDropIndicator() }
		</>;
	}
}
