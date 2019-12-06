import { AvGadget } from './aardvark_gadget';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvNodeType, AvGrabEvent, EVolumeType, AvGrabEventType, GrabberHighlight } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';


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

/** Defines a grabber, which can be used to interact with grabbables.
 * This node will cause grab highlight updates when it enters the
 * volume of grabbable handles, and respond to the grab button on 
 * whatever hand it is parented to.
 */
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
