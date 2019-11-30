import { AvGadget } from './aardvark_gadget';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import bind from 'bind-decorator';
import { endpointAddrsMatch, EndpointAddr, AvNodeType, AvGrabEventType, 
	AvGrabEvent, EVolumeType, ENodeFlags } from '@aardvarkxr/aardvark-shared';


/** The highlight states that a hook can be in. */
export enum HookHighlight
{
	/** The hook is not highlighted. Usually hooks are
	 * invisible in this state.
	 */
	None,

	/** There is a grab in progress. The hook should make
	 * itself visible.
	 */
	GrabInProgress,

	/** The grab in progress is in range of this hook. */
	InRange,

	/** The hook is occupied by a grabbable. */
	Occupied,
}


interface AvHookProps extends AvBaseNodeProps
{
	/** The updateHighlight function will be called whenever the highlight state
	 * of a hook changes.
	 */
	updateHighlight?: ( highlightType: HookHighlight ) => void;

	/** If this field is true dropping grabbables on the hook will preserve the 
	 * transform between the grabbable and the hook at the time of the drop. 
	 * 
	 * @default false
	 */
	preserveDropTransform?: boolean;

	/** For spherical hooks, this is the radius of the hook. If any AABB
	 * dimension is specified, this is ignore.
	*/
	radius?: number;

	/** Minimum x value for axis-aligned bounding box hook volumes. */
	xMin?: number;

	/** Maximum x value for axis-aligned bounding box hook volumes. */
	xMax?: number;

	/** Minimum y value for axis-aligned bounding box hook volumes. */
	yMin?: number;

	/** Maximum y value for axis-aligned bounding box hook volumes. */
	yMax?: number;

	/** Minimum z value for axis-aligned bounding box hook volumes. */
	zMin?: number;

	/** Maximum z value for axis-aligned bounding box hook volumes. */
	zMax?: number;
}


/** This node is a point in space where a grabbable can be attached at
 * the end of a grab operation.
 */
export class AvHook extends AvBaseNode< AvHookProps, {} >
{
	m_lastHighlight = HookHighlight.None;
	m_lastGrabbable: EndpointAddr = null;

	public buildNode()
	{
		AvGadget.instance().setGrabEventProcessor( this.m_nodeId, this.onGrabEvent );

		let node = this.createNodeObject( AvNodeType.Hook, this.m_nodeId );

		if( this.props.preserveDropTransform )
		{
			node.flags |= ENodeFlags.PreserveGrabTransform;
		}
		
		if( this.props.xMin || this.props.xMax 
			|| this.props.yMin || this.props.yMax 
			|| this.props.zMin || this.props.zMax )
		{
			node.propVolume = 
			{ 
				type: EVolumeType.AABB, 
				aabb:
				{
					xMin: this.props.xMin,
					xMax: this.props.xMax,
					yMin: this.props.yMin,
					yMax: this.props.yMax,
					zMin: this.props.zMin,
					zMax: this.props.zMax,
				},
			};
		}
		else
		{
			node.propVolume = 
			{ 
				type: EVolumeType.Sphere, 
				radius : this.props.radius ? this.props.radius : 0.1, 
			};
		}
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
