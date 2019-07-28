import { AvGadget } from './aardvark_gadget';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvSceneContext, AvNodeType, AvGrabEventType, AvGrabEvent } from 'common/aardvark';
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

	public startNode( context:AvSceneContext )
	{
		context.startCustomNode( this.m_nodeId, "hook" + this.m_nodeId, "Hook" );
		context.setSphereVolume( this.props.radius );

		AvGadget.instance().setGrabEventProcessor( this.m_nodeId, this.onGrabEvent );
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
