import { AvGadget } from './aardvark_gadget';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import bind from 'bind-decorator';
import { endpointAddrsMatch, EndpointAddr, AvNodeType, AvGrabEventType, 
	AvGrabEvent, EVolumeType, ENodeFlags, AvNodeTransform, endpointAddrToString } from '@aardvarkxr/aardvark-shared';
import { HighlightType } from './aardvark_grabbable';


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

export interface HookInterfaceEventProcessor
{
	( sender: EndpointAddr, data: object ): void;
}

interface AvHookProps extends AvBaseNodeProps
{
	/** The updateHighlight function will be called whenever the highlight state
	 * of a hook changes.
	 */
	updateHighlight?: ( highlightType: HookHighlight, grabbableEpa: EndpointAddr ) => void;

	/** If this field is true dropping grabbables on the hook will preserve the 
	 * transform between the grabbable and the hook at the time of the drop. 
	 * 
	 * @default false
	 */
	preserveDropTransform?: boolean;

	/** If this field is true any number of grabbables can be dropped on the hook.
	 * 
	 * @default false
	 */
	allowMultipleDrops?: boolean;

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

	/** The amount to scale up the outer volume for this hook. Hooking 
	 * begins when the grabbable enters the inner volume and ends when it
	 * exits the outer volume.
	 * 
	 * @default 1.5
	 */
	outerVolumeScale?: number;

	/** The model to show as an icon when this hook is the drop point for the grabbable.
	 */
	dropIconUri: string;

	/** The list of interfaces that this hook implements. These can be any string of the form
	 * <interfacename>@<version>. When selecting an interface for a grabbable that is in range 
	 * of a hook Aardvark will select the first matching interface in the list, so the hook
	 * should order its interfaces from highest to lowest priority if multiple interfaces of the 
	 * same type are available.
	 * 
	 * @default { "aardvark-gadget@1": null }
	 */
	interfaces?: { [interfaceName: string] : HookInterfaceEventProcessor };

	/** This callback allows the hook's owner to respond when the transform for the
	 * grabbable has been updated relative to a hook it is intersecting.
	 * 
	 * * hookFromGrabbable - The transform from the coordinate system of the grabbable itself to the 
	 * 		coordinate system of the hook.
	 */
	onTransformUpdated?: ( grabbable: EndpointAddr, hookFromGrabbable: AvNodeTransform ) => void;
}


/** This node is a point in space where a grabbable can be attached at
 * the end of a grab operation.
 */
export class AvHook extends AvBaseNode< AvHookProps, {} >
{
	m_grabbablesInRange: Set<string> = new Set();
	m_lastGrabbable: EndpointAddr = null;

	public buildNode()
	{
		AvGadget.instance().setGrabEventProcessor( this.m_nodeId, this.onGrabEvent );

		let node = this.createNodeObject( AvNodeType.Hook, this.m_nodeId );

		if( this.props.preserveDropTransform )
		{
			node.flags |= ENodeFlags.PreserveGrabTransform;
		}
		if( this.props.allowMultipleDrops )
		{
			node.flags |= ENodeFlags.AllowMultipleDrops;
		}
		if( this.props.onTransformUpdated )
		{
			node.flags |= ENodeFlags.NotifyOnTransformChange;
		}

		node.propOuterVolumeScale = this.props.outerVolumeScale;
		node.propModelUri = this.props.dropIconUri;

		if( this.props.interfaces )
		{
			let interfaces: string[] = [];
			let needProcessor = false;
			for( let interfaceName in this.props.interfaces )
			{
				interfaces.push( interfaceName );
				needProcessor = needProcessor || ( this.props.interfaces[ interfaceName ] != null )
			}
			node.propInterfaces = interfaces;

			if( needProcessor )
			{
				AvGadget.instance().setInterfaceEventProcessor( this.m_nodeId, this.onInterfaceEvent );
			}
		}
		else
		{
			node.propInterfaces = [ "aardvark-gadget@1" ];
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
		let grabbableIdString = endpointAddrToString( evt.grabbableId );

		switch( evt.type )
		{
			case AvGrabEventType.EnterHookRange:
				if( !this.m_grabbablesInRange.has( grabbableIdString ) )
				{
					this.m_grabbablesInRange.add( grabbableIdString );
					if( this.props.updateHighlight )
					{
						this.props.updateHighlight( HookHighlight.InRange, evt.grabbableId );
					}
				}
				break;

			case AvGrabEventType.LeaveHookRange:
				if( this.m_grabbablesInRange.has( grabbableIdString ) )
				{
					this.m_grabbablesInRange.delete( grabbableIdString );
					if( this.props.updateHighlight )
					{
						this.props.updateHighlight( HookHighlight.None, evt.grabbableId );
					}
				}
				break;

			case AvGrabEventType.HookTransformUpdated:
				if( this.props.onTransformUpdated )
				{
					this.props.onTransformUpdated( evt.grabbableId, evt.hookFromGrabbable );
				}
				break;
		}
	}

	@bind
	private onInterfaceEvent( interfaceName: string, sender: EndpointAddr, data: object )
	{
		let processor = this.props.interfaces?.[ interfaceName ];
		if( processor )
		{
			processor( sender, data );
		}
	}
}
