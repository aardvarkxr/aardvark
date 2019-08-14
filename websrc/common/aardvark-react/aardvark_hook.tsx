import { AvGadget } from './aardvark_gadget';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvNodeType, AvGrabEventType, AvGrabEvent, EVolumeType } from 'common/aardvark';
import bind from 'bind-decorator';


export enum HookHighlight
{
	None,
	InRange,
}

interface AvHookProps extends AvBaseNodeProps
{
	updateHighlight?: ( highlightType: HookHighlight ) => void;
	radius: number;
}

export class AvHook extends AvBaseNode< AvHookProps, {} >
{
	m_lastHighlight = HookHighlight.None;

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
			case AvGrabEventType.EnterHookRange:
				newHighlight = HookHighlight.InRange;
				break;

			case AvGrabEventType.LeaveHookRange:
				newHighlight = HookHighlight.None;
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
