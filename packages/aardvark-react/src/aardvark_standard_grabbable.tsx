import * as React from 'react';
import { AvTransform } from './aardvark_transform';
import bind from 'bind-decorator';
import { AvModel } from './aardvark_model';
import { EndpointAddr, EVolumeType, AvVolume, InitialInterfaceLock, infiniteVolume, emptyVolume } from '@aardvarkxr/aardvark-shared';
import { HighlightType, AvGrabbable, HookInteraction } from './aardvark_grabbable';
import { AvModelBoxHandle } from './aardvark_handles';
import { MoveableComponent, MoveableComponentState } from './component_moveable';
import { AvComposedEntity, EntityComponent } from './aardvark_composed_entity';
import { NetworkedGadgetComponent } from './component_networked_gadget';
import { RemoteGadgetComponent } from './component_remote_gadget';
import { AvGadget } from './aardvark_gadget';

export enum ShowGrabbableChildren
{
	/** Always show the children of the AvStandardGrabbable, no matter
	 * what the highlight state is.
	 */
	Always = 0,

	/** Only show the children of the AvStandardGrabbable when it is 
	 * being grabbed.
	 */
	OnlyWhenGrabbed = 1,

	/** Only show the children of the AvStandardGrabbable when it is 
	 * not being grabbed.
	 */
	OnlyWhenNotGrabbed = 2,
}

export enum DropStyle
{
	/** Drop this grabbable on hooks */
	DropOnHooks = 1,

	/** Drop this grabbable in the world */
	DropInTheWorld = 2,
}

interface StandardGrabbableProps
{
	/** The model to use for the grab handle of this grabbable. */
	modelUri: string;

	/** Tells the standard grabbable when to show its children. 
	 * 
	 * @default ShowGrabbableChildren.Always
	*/
	showChildren?: ShowGrabbableChildren;

	/** Uniform scale to apply to the grab handle.
	 * 
	 * @default 1.0
	*/
	modelScale?: number;

	/** Color to apply to the grab handle.
	 * 
	 * @default none
	*/
	modelColor?: string;

	/** Called when the grabbable is grabbed. 
	 * 
	 * @default none
	*/
	onGrab?: () => void;

	/** Called when the grabbable is dropped. 
	 * 
	 * @default none
	*/
	onEndGrab?: () => void;

	/** Allows the grabbable to be automatically added to a container when it is first created.
	 * 
	 * @default true
	 */
	useInitialParent?: boolean;

	/** If this property is defined, the gadget will be shared with remote users that are in the 
	 * same room as the owner. Any remote instance of this gadget will be started with provided
	 * initial interface locks.
	 * 
	 * @default none
	 */
	remoteInterfaceLocks?: InitialInterfaceLock[];

	/** If remoteInterfaceLocks is provided, the callback provided with this property is called
	 * whenever a message comes in from a remote instance of this gadget. If this gadget is
	 * the master, any events received from this callback will be from a remote gadget. If this
	 * gadget is remote, any events received from this callback will be from the master.
	 * 
	 * @default none
	 */
	remoteGadgetCallback?: ( event: object ) => void;
}


interface StandardGrabbableState
{
	highlight: HighlightType;
}

/** A grabbable that shows a model for its handle and highlights automatically. */
export class AvStandardGrabbable extends React.Component< StandardGrabbableProps, StandardGrabbableState >
{
	private moveableComponent: MoveableComponent;
	private networkedComponent: NetworkedGadgetComponent;
	private remoteComponent: RemoteGadgetComponent;

	constructor( props: any )
	{
		super( props );

		let remoteLock = AvGadget.instance().initialInterfaces.find( ( value ) => 
			value.iface == RemoteGadgetComponent.interfaceName );
		if( remoteLock )
		{
			// this gadget is remote
			this.remoteComponent = new RemoteGadgetComponent( this.props.remoteGadgetCallback );
		}
		else
		{
			this.moveableComponent = new MoveableComponent( this.onMoveableUpdate, this.props.useInitialParent ?? true );

			if( this.props.remoteInterfaceLocks )
			{
				// this gadget is master, or will be if the user enters a room
				this.networkedComponent = new NetworkedGadgetComponent( this.props.remoteInterfaceLocks, this.props.remoteGadgetCallback );
			}
		} 

		this.state = 
		{ 
			highlight: HighlightType.None
		};
	}

	@bind
	private async onMoveableUpdate()
	{
		let highlight: HighlightType;
		switch( this.moveableComponent.state )
		{
			default:
			case MoveableComponentState.Idle:
			case MoveableComponentState.InContainer:
				highlight = HighlightType.None;
				break;

			case MoveableComponentState.GrabberNearby:
				highlight = HighlightType.InRange;
				break;

			case MoveableComponentState.Grabbed:
				highlight = HighlightType.Grabbed;
				break;
		}

		this.setState( ( oldState: StandardGrabbableState ) =>
		{
			if( oldState.highlight == HighlightType.InRange || oldState.highlight == HighlightType.None )
			{
				if( highlight == HighlightType.Grabbed )
				{
					console.log( "standard grabbable was grabbed" );
					this.props.onGrab?.();
				}
			}
			else if( oldState.highlight == HighlightType.Grabbed )
			{
				if( highlight == HighlightType.InRange || highlight == HighlightType.None )
				{
					console.log( "standard grabbable was ungrabbed" );
					this.props.onEndGrab?.();
				}
			}
			return { ...oldState, highlight };
		} );
	}

	public get isGrabbed()
	{
		return this.state.highlight == HighlightType.Grabbed 
			|| this.state.highlight == HighlightType.InHookRange;
	}

	/** Sends an event to another instance of this gadget. If this gadget is
	 * the master, the event is sent to all remote instances. If this gadget 
	 * is remote, the event is sent to the master. If this gadget is not networked,
	 * or if it is networked, but the user is not currently in a room, the 
	 * event is discarded.
	 */
	public sendRemoteEvent( event: object, reliable: boolean )
	{
		this.networkedComponent?.sendEventToAllRemotes( event, reliable );
		this.remoteComponent?.sendEventToMaster( event, reliable );
	}

	public render()
	{
		let showChildren: boolean;
		switch( this.props.showChildren ?? ShowGrabbableChildren.Always )
		{
			default:
			case ShowGrabbableChildren.Always:
				showChildren = true;
				break;

			case ShowGrabbableChildren.OnlyWhenGrabbed:
				showChildren = this.state.highlight == HighlightType.Grabbed 
					|| this.state.highlight == HighlightType.InHookRange;
				break;

			case ShowGrabbableChildren.OnlyWhenNotGrabbed:
				showChildren = this.state.highlight == HighlightType.None 
					|| this.state.highlight == HighlightType.InRange;
				break;
		}

		let scale = this.state.highlight == HighlightType.InRange ? 1.1 : 1.0;
		if( this.props.modelScale )
		{
			scale *= this.props.modelScale;
		}

		let volume: AvVolume = this.remoteComponent ? emptyVolume() :
			{
				type: EVolumeType.ModelBox, 
				uri: this.props.modelUri, 
				nodeFromVolume:
				{ 
					scale: { x: scale, y: scale, z: scale }
				},
			};

		let components: EntityComponent[] = [ this.remoteComponent ?? this.moveableComponent ];

		return (
			<AvComposedEntity components={ components }	volume={ volume }>
				{ this.networkedComponent 
					&& <AvComposedEntity components={ [ this.networkedComponent ] } volume={ infiniteVolume() } /> }
				<AvTransform uniformScale={ scale }>
					<AvModel uri={ this.props.modelUri} color={ this.props.modelColor }/>
				</AvTransform>
				{ this.props.children && 
					<AvTransform visible={ showChildren }>{ this.props.children }</AvTransform> }
			</AvComposedEntity> );
	}
}


