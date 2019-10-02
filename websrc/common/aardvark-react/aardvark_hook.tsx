import { AvGadget } from './aardvark_gadget';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvNodeType, AvGrabEventType, AvGrabEvent, EVolumeType } from 'common/aardvark';
import bind from 'bind-decorator';
import { endpointAddrsMatch, EndpointAddr } from './aardvark_protocol';


export enum HookHighlight
{
	None,
	GrabInProgress,
	InRange,
	Occupied,
}

interface AvHookProps extends AvBaseNodeProps
{
	updateHighlight?: ( highlightType: HookHighlight ) => void;
	radius: number;
}

export class AvHook extends AvBaseNode< AvHookProps, {} >
{
	m_lastHighlight = HookHighlight.None;
	m_lastGrabbable: EndpointAddr = null;

	public buildNode()
	{
		AvGadget.instance().setGrabEventProcessor( this.m_nodeId, this.onGrabEvent );

		let node = this.createNodeObject( AvNodeType.Hook, this.m_nodeId );
		node.propVolume = { type: EVolumeType.Sphere, radius : this.props.radius };
		return node;
	}

	@bind private onGrabEvent( evt: AvGrabEvent )
	{
		let newHighlight: HookHighlight = null;
	
		switch( evt.type )
		{
			case AvGrabEventType.StartGrab:
				if( evt.grabberId.endpointId != AvGadget.instance().getEndpointId() 
					&& ( !this.m_lastGrabbable || endpointAddrsMatch( this.m_lastGrabbable, evt.grabbableId ) ) )
				{
					newHighlight = HookHighlight.GrabInProgress;
					this.m_lastGrabbable = null;
				}
				break;

			case AvGrabEventType.EndGrab:
				if( endpointAddrsMatch( evt.hookId, this.endpointAddr() ) )
				{
					newHighlight = HookHighlight.Occupied;
					this.m_lastGrabbable = evt.grabbableId;
				}
				else
				{
					newHighlight = HookHighlight.None;
				}
				break;

			case AvGrabEventType.EnterHookRange:
				newHighlight = HookHighlight.InRange;
				break;

			case AvGrabEventType.LeaveHookRange:
				newHighlight = HookHighlight.GrabInProgress;
				break;
		}

		if( newHighlight != null && newHighlight != this.m_lastHighlight )
		{
			this.m_lastHighlight = newHighlight;
			if( this.props.updateHighlight )
			{
				this.props.updateHighlight( this.m_lastHighlight );
			}
		}
	}

}
