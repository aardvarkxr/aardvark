import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { AvConstraint, AvNodeTransform, AvVolume, emptyVolume, EVolumeType, g_builtinModelStar, g_builtinModelTrashcan, infiniteVolume, InitialInterfaceLock } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import { AvComposedEntity, EntityComponent } from './aardvark_composed_entity';
import { AvGadget } from './aardvark_gadget';
import { AvGadgetInfo } from './aardvark_gadget_info';
import { AvHeadFacingTransform } from './aardvark_head_facing_transform';
import { AvMenuItem } from './aardvark_menu_item';
import { AvModel } from './aardvark_model';
import { AvTransform } from './aardvark_transform';
import { AvGadgetList } from './api_gadgetlist';
import { MoveableComponent, MoveableComponentState } from './component_moveable';
import { NetworkedGadgetComponent, NetworkedItemComponent } from './component_networked_gadget';
import { RemoteGadgetComponent, RemoteItemComponent, k_remoteGrabbableInterface } from './component_remote_gadget';
import { AvInterfaceEntity } from './aardvark_interface_entity';
const equal = require( 'fast-deep-equal' );

/** This enum defines the possible highlight states of an AvGrabbable. 
*/
export enum HighlightType
{
	/** Nothing interesting is going on with the grabbable. */
	None = 0,

	/** There is a grabber within grabbing range of the grabbable. */
	InRange = 1,

	/** There is a grabber actively grabbing the grabbable, and it isn't attached to anything. */
	Grabbed = 2,

	/** The grabbed grabbable is within drop range of a hook. */
	InHookRange = 3,

	/** The grabbable was in range and the user is holding the menu button. */
	Menu = 4,

	/** The grabbable is being grabbed by the one of its networked copies. It's animated, but should
	 * leave interactions to the remote entity itself.
	 * 
	 * This highlight type will only be reported by AvNetworkedGrabbable.
	 */
	GrabbedByRemote = 5,
}

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

export enum HiddenChildrenBehavior
{
	/** Emit the child nodes, but mark them as hidden. */
	Hidden = 0,

	/** Do not emit the child nodes. */
	Omit = 1,
}

export interface StandardGrabbableDeleteCallback
{
	(): void;
}

export enum GrabbableStyle
{
	/** This grabbable is the top level of a gadget. It will
	 * advertize gadget info, have an A menu, etc.
	 */
	Gadget = 1,

	/** This grabbable is a subcomponent of a gadget that is not
	 * only grabbable on the primary instance. It will not advertise
	 * gadget info or have an A menu.
	 */
	LocalItem = 2,

	/** This grabbable is a subcomponent of a gadget that is grabbable
	 * on the primary instance and on networked instances. It will not 
	 * advertise gadget info or have an A menu.
	 */
	NetworkedItem = 3,
}

/** Props for {@link AvStandardGrabbable} */
export interface StandardGrabbableProps
{
	/** The model to use for the grab handle of this grabbable. Either
	 * this prop or appearance and volume must be specified.
	 * 
	 * @default none
	*/
	modelUri?: string;

	/** The scene graph nodes to use for this grabbable's appearance. Either this and volume 
	 * or modelUri must be specified
	 * 
	 * @default none
	 */
	appearance?: JSX.Element;

	/** The intersection volume to use in conjunction with appearance to determine when the 
	 * user is intersecting the grabbable.
	 * 
	 * @default none
	 */
	volume?: AvVolume;

	/** Tells the standard grabbable when to show its children. 
	 * 
	 * @default ShowGrabbableChildren.Always
	*/
	showChildren?: ShowGrabbableChildren;

	/** Controls how child nodes are hidden. If showChildren is set to 
	 * ShowGrabbableChildren.Always or if the grabbable has no children,
	 * this prop is ignored.
	 * 
	 * @default HiddenChildrenBehavior.Hidden
	 */
	hiddenChildrenBehavior?: HiddenChildrenBehavior;

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

	/** If this canDropIntoContainers is true, the grabbable will drop itself into containers
	 * when appropriate. Otherwise it will return to its scene graph-specified transform when
	 * it is dropped.
	 * 
	 * @default true
	 */
	canDropIntoContainers?: boolean;

	/** Use this transform when this grabbable is being grabbed. 
	 * 
	 * @default use the transform at the moment the grab started
	 */
	grabberFromGrabbable?: AvNodeTransform;

	/** Defines when the grabbable can be grabbed, and whether or not
	 * it counts as the topmost grabbable in the gadget.
	 */
	style: GrabbableStyle;

	/** The unique-to-the-gadget id to use to link up this item with its counterparts in remote
	 * gadgets. This must be specified if the grabbable is using the NetworkedItem style.
	 * 
	 * @default none
	 */
	itemId?: string;

	/** If this prop is specified, the user will be presented with a delete option when they
	 * activate the A menu while this gadget is highlighted. If a callback is provided,
	 * the callback will be called when the user selects delete. If true is provided, the
	 * gadget will be closed when the user selects delete.
	 * 
	 * @default: none
	 */
	showDelete?: true | StandardGrabbableDeleteCallback;

	/** If this prop is true the grabbable will ignore all rotation other than yaw
	 * from its parent so that it is always upright.
	 * 
	 * @default: false
	 */
	gravityAligned?: boolean;
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
	private gadgetListRef: React.RefObject<AvGadgetList> = React.createRef<AvGadgetList>();
	private remoteItemComponent: RemoteItemComponent = null;
	private networkedItemComponent: NetworkedItemComponent = null

	constructor( props: any )
	{
		super( props );

		if( !props.modelUri && !props.appearance )
		{
			throw new Error( "Either modelUri or appearance must be provided" );
		}

		if( this.props.style == GrabbableStyle.NetworkedItem && !this.props.itemId )
		{
			throw new Error( "itemId is required for networked items" );
		}

		this.moveableComponent = new MoveableComponent( this.onMoveableUpdate, 
			this.props.style == GrabbableStyle.Gadget, this.props.canDropIntoContainers,
			this.props.grabberFromGrabbable );

		let remoteLock = AvGadget.instance().findInitialInterface( RemoteGadgetComponent.interfaceName );
		if( remoteLock )
		{
			// this gadget is remote
			this.remoteComponent = new RemoteGadgetComponent( this.props.remoteGadgetCallback );

			if( this.props.style == GrabbableStyle.NetworkedItem )
			{
				this.remoteItemComponent = new RemoteItemComponent( this.props.itemId, null );
			}
		}
		else
		{

			if( this.props.remoteInterfaceLocks )
			{
				// this gadget is master, or will be if the user enters a room
				this.networkedComponent = new NetworkedGadgetComponent( this.props.remoteInterfaceLocks, this.props.remoteGadgetCallback );
			}

			if( this.props.style == GrabbableStyle.NetworkedItem )
			{
				this.networkedItemComponent = new NetworkedItemComponent( this.props.itemId, null );
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
				if( this.networkedItemComponent?.transformOverridden )
				{
					highlight = HighlightType.GrabbedByRemote;
				}
				else
				{
					highlight = HighlightType.Grabbed;
				}
				break;

			case MoveableComponentState.Menu:
				highlight = HighlightType.Menu;
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

	componentDidUpdate( prevProps: StandardGrabbableProps )
	{
		if( !equal( this.props.remoteInterfaceLocks, prevProps.remoteInterfaceLocks ) )
		{
			this.networkedComponent?.setInitialInterfaceLocks( this.props.remoteInterfaceLocks );
		}
	}

	@bind
	private onFavoriteThisGadget()
	{
		console.log( "Sending request to add this gadget to favorites" );
		this.gadgetListRef.current?.addFavorite( AvGadget.instance().url );
	}

	private get showDelete(): boolean
	{
		return this.props.showDelete ? true : ( this.props.style == GrabbableStyle.Gadget );
	}

	@bind
	private onDelete()
	{
		if( typeof this.props.showDelete === "function" )
		{
			console.log( "calling delete callback at the user's request from the A menu" );
			this.props.showDelete();
		}
		else
		{
			console.log( "closing the gadget at the user's request from the A menu" );
			window.close();
		}
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

		let highlightScale = this.state.highlight == HighlightType.InRange ? 1.1 : 1.0;

		let appearance:JSX.Element;
		let infoVolume: AvVolume;
		if( this.props.modelUri )
		{
			let scale = highlightScale * ( this.props.modelScale ?? 1.0 );
			appearance = <AvTransform uniformScale={ scale }>
					<AvModel uri={ this.props.modelUri} color={ this.props.modelColor }/>
				</AvTransform>;

			infoVolume = 
			{
				type: EVolumeType.ModelBox, 
				uri: this.props.modelUri, 
				nodeFromVolume:
				{ 
					scale: { x: scale, y: scale, z: scale }
				},
			};
		}
		else
		{
			appearance = <AvTransform uniformScale={ highlightScale }>
					{ this.props.appearance }
				</AvTransform>;

			infoVolume = { ...this.props.volume };

			if( !infoVolume.nodeFromVolume )
			{
				infoVolume.nodeFromVolume = {};
			}
			if( !infoVolume.nodeFromVolume.scale )
			{
				infoVolume.nodeFromVolume.scale = { x: 1.0, y: 1.0, z: 1.0 };
			}

			infoVolume.nodeFromVolume.scale.x *= highlightScale;
			infoVolume.nodeFromVolume.scale.y *= highlightScale;
			infoVolume.nodeFromVolume.scale.z *= highlightScale;
		}

		let constraint: AvConstraint = null;
		if( this.props.gravityAligned )
		{
			constraint = { gravityAligned: this.props.gravityAligned };
		}

		let outerComponent: EntityComponent;
		let innerComponent: EntityComponent;
		let locatorEntity: JSX.Element;

		let outerVolume: AvVolume;
		let innerVolume: AvVolume;

		let outerConstraint: AvConstraint;
		let innerConstraint: AvConstraint;

		switch( this.props.style )
		{
			case GrabbableStyle.Gadget:
				if( AvGadget.instance().isRemote )
				{
					outerComponent = this.remoteComponent;
					outerVolume = emptyVolume();
				}	
				else
				{
					outerComponent = this.moveableComponent;
					outerVolume = infoVolume;
					outerConstraint = constraint;

					if( this.networkedComponent )
					{
						locatorEntity = <AvComposedEntity components={ [ this.networkedComponent ] } 
							volume={ infiniteVolume() } />;
					}
				}		
				break;

			case GrabbableStyle.LocalItem:
				outerComponent = this.moveableComponent;
				outerVolume = infoVolume;
				outerConstraint = constraint;
			break;

			case GrabbableStyle.NetworkedItem:
				if( AvGadget.instance().isRemote )
				{
					outerComponent = this.remoteItemComponent;
					outerVolume = emptyVolume();

					innerComponent = this.moveableComponent;
					innerVolume = infoVolume;
					innerConstraint = constraint;

					if( this.moveableComponent.state == MoveableComponentState.Grabbed )
					{
						let lock = { ...this.remoteItemComponent.interfaceLocks[0] };
						lock.iface = k_remoteGrabbableInterface;
						locatorEntity = <AvInterfaceEntity volume={ infoVolume }
							transmits={ [ { iface: k_remoteGrabbableInterface } ] }
								interfaceLocks={ [ lock ] }/>
					}			
				}	
				else
				{
					outerComponent = this.moveableComponent;
					outerVolume = infoVolume;
					outerConstraint = constraint;

					innerComponent = this.networkedItemComponent;
					innerVolume = infiniteVolume();
				}	
				break;
		}		

		let children = this.props.children;
		if( !showChildren )
		{
			switch( this.props.hiddenChildrenBehavior ?? HiddenChildrenBehavior.Hidden )
			{
				default:
				case HiddenChildrenBehavior.Hidden:
					children = <AvTransform visible={ showChildren }>{ this.props.children }</AvTransform>;
					break;

				case HiddenChildrenBehavior.Omit:
					children = null;
			}		
		}	

		const advertizeGadgetInfo = this.props.style == GrabbableStyle.Gadget;

		let menu: JSX.Element = null;
		if( this.state.highlight == HighlightType.Menu 
			&& ( this.showDelete || advertizeGadgetInfo ) )
		{
			let grabbableFromMenu = this.moveableComponent.menuSelfFromGrabber;
			menu = <AvTransform transform={ grabbableFromMenu }>
				<AvHeadFacingTransform>
				{ 
					advertizeGadgetInfo &&
					<AvTransform translateX={-0.05 } translateZ={ 0.03 }
						uniformScale={ 1.5 }>
						<AvMenuItem modelUri={ g_builtinModelStar }
							onSelect={ this.onFavoriteThisGadget }/>
					</AvTransform>
				}
				{ 
					this.showDelete &&
					<AvTransform translateX={ 0.05 }  translateZ={ 0.03 }
						rotateX={ -90 }	uniformScale={ 0.2 }>
						<AvMenuItem modelUri={ g_builtinModelTrashcan }
							onSelect={ this.onDelete }/>
					</AvTransform>
				}
				</AvHeadFacingTransform>

				<AvGadgetList ref={ this.gadgetListRef } />
			</AvTransform>;
		}

		let guts = <>
			{ locatorEntity }
			{ appearance }
			{ children }
			{ advertizeGadgetInfo &&
				<AvGadgetInfo volume={ infoVolume } /> }
			{ menu }
			</>;

		if( innerComponent )
		{
			return <AvComposedEntity components={ [ outerComponent ] } volume={ outerVolume } constraint={ outerConstraint }>
				<AvComposedEntity components={ [ innerComponent ] } volume={ innerVolume } constraint={ innerConstraint }>				
				{ guts }
				</AvComposedEntity>
			</AvComposedEntity>;
		}
		else
		{
			return <AvComposedEntity components={ [ outerComponent ] } volume={ outerVolume } constraint={ outerConstraint }>
				{ guts }
			</AvComposedEntity>;
		}
	}
}


