import { AvNodeTransform, InitialInterfaceLock, MinimalPose, minimalPoseFromTransform, EndpointAddr } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import { EntityComponent } from './aardvark_composed_entity';
import { ActiveInterface } from './aardvark_interface_entity';
import { NetworkedGadgetComponent, NetworkGadgetEvent, NetworkGadgetEventType, NGESendEvent, NGESetGadgetInfo, NGESetItemInfo } from './component_networked_gadget';


export enum NetworkUniverseEventType
{
	/** Sent when the remote universe should start a gadget on behalf of the the network universe. */
	CreateRemoteGadget = "create_remote_gadget",

	/** Sent when the remote universe should destroy a gadget on behalf of the network universe. */
	DestroyRemoteGadget = "destoy_remote_gadget",

	/** Sent when the remote universe should update a remote gadget's transform relative to the universe. */
	UpdateRemoteGadgetTransform = "update_remote_gadget_transform",

	/** Sent when the network universe is conveying an event from a networked gadget to a remote gadget. */
	BroadcastRemoteGadgetEvent = "broadcast_remote_gadget_event",

	/** Sent when a remote universe is is conveying an even from a remote gadget to the networked gadget. */
	SendMasterGadgetEvent = "send_master_gadget_event",
}

export interface NetworkUniverseEvent
{
	type: NetworkUniverseEventType;
	remoteGadgetId: number;
	itemId?: string;
	gadgetUrl?: string;
	remoteInterfaceLocks?: InitialInterfaceLock[];
	universeFromGadget?: MinimalPose;
	event?: object;
}

export interface NetworkedGadgetInfo
{
	remoteGadgetId: number;
	url: string;
	remoteLocks: InitialInterfaceLock[];
	universeFromGadget: MinimalPose;
}

interface NetworkedItemInfoInternal
{
	itemId: string;
	iface: ActiveInterface;
}

interface NetworkedGadgetInfoInternal
{
	remoteGadgetId?: number;
	url?: string;
	remoteLocks?: InitialInterfaceLock[];
	iface: ActiveInterface;
	items: Map< string, NetworkedItemInfoInternal >;
}	

export interface UniverseInitInfo
{
	gadgets: NetworkedGadgetInfo[];
}

/** A network that can be used with AvComposedComponent. The arguments below are for the 
 * provided callback function.
 * 
 * @param event		An object, opaque to the room itself, that allows the network universe to
 * 					communicate with its remote peers.
 * @param reliable	If this argument is true, the room must deliver the message to every remote
 * 					universe or that universe will be out of synch with the network universe. 
 */
export class NetworkUniverseComponent implements EntityComponent
{
	private networkedGadgetsByEndpointId = new Map< number, NetworkedGadgetInfoInternal >();
	private networkedGadgetsByRemoteId = new Map< number, NetworkedGadgetInfoInternal >();
	static nextRemoteGadgetId = 1;
	private networkEventCallback: ( event: object, reliable: boolean ) => void;
	private entityCallback: () => void = null;

	constructor( networkEventCallback: ( event: object, reliable: boolean ) => void )
	{
		this.networkEventCallback = networkEventCallback;
	}
	
	public onUpdate( callback: () => void )
	{
		this.entityCallback = callback;
	}

	@bind
	private onNetworkInterface( activeNetworkedGadget: ActiveInterface )
	{
		let gadgetInfo: NetworkedGadgetInfoInternal = 
			this.networkedGadgetsByEndpointId.get( activeNetworkedGadget.peer.endpointId );
		if( !gadgetInfo )
		{
			gadgetInfo =
			{
				iface: activeNetworkedGadget,
				items: new Map<string, NetworkedItemInfoInternal>(),
			};
			this.networkedGadgetsByEndpointId.set( activeNetworkedGadget.peer.endpointId, gadgetInfo );
		}

		let itemInfo: NetworkedItemInfoInternal;

		activeNetworkedGadget.onEvent( ( event: NetworkGadgetEvent ) =>
		{
			switch( event.type )
			{
				case NetworkGadgetEventType.SetGadgetInfo:
				{
					let setInfo = event as NGESetGadgetInfo;
					let universeFromGadget = minimalPoseFromTransform( activeNetworkedGadget.selfFromPeer );

					// some stuff we just always update
					gadgetInfo.remoteLocks = setInfo.locks;
					gadgetInfo.url = setInfo.url;

					// if we haven't seen a gadget info for this gadget yet, assign it an ID and tell
					// remote universes to spawn it
					if( !gadgetInfo.remoteGadgetId )
					{
						gadgetInfo.remoteGadgetId = NetworkUniverseComponent.nextRemoteGadgetId++;
						this.networkedGadgetsByRemoteId.set( gadgetInfo.remoteGadgetId, gadgetInfo );
	
						let createEvent: NetworkUniverseEvent =
						{
							type: NetworkUniverseEventType.CreateRemoteGadget,
							remoteGadgetId: gadgetInfo.remoteGadgetId, 
							gadgetUrl: setInfo.url, 
							remoteInterfaceLocks: setInfo.locks, 
							universeFromGadget 
						};
						this.networkEventCallback( createEvent, true );	

						// if any items showed up before the gadget did, update those transforms too
						for( let itemId of gadgetInfo.items.keys() )
						{
							let itemInfo = gadgetInfo.items.get( itemId );
							this.updateRemoteTransform( itemInfo.iface.selfFromPeer, gadgetInfo, itemInfo );
						}
					}
				}
				break;

				case NetworkGadgetEventType.SetItemInfo:
				{
					let setInfo = event as NGESetItemInfo;

					if( !itemInfo )
					{
						itemInfo =
						{
							iface: activeNetworkedGadget,
							itemId: setInfo.itemId,
						};

						gadgetInfo.items.set( setInfo.itemId, itemInfo );
					}

					this.updateRemoteTransform( activeNetworkedGadget.selfFromPeer, gadgetInfo, itemInfo );
				}
				break;

				case NetworkGadgetEventType.SendEventToAllRemotes:
				{
					let sendEvent = event as NGESendEvent;
					if( gadgetInfo )
					{
						let netEvent: NetworkUniverseEvent =
						{
							type: NetworkUniverseEventType.BroadcastRemoteGadgetEvent,
							remoteGadgetId: gadgetInfo.remoteGadgetId, 
							itemId: itemInfo?.itemId,
							event: sendEvent.event,
						};
						this.networkEventCallback( netEvent, sendEvent.reliable );
					}
				}
				break;
			}
		} );

		activeNetworkedGadget.onEnded( () =>
		{
			if( itemInfo )
			{
				// this is just an item in the gadget
			}
			else if( gadgetInfo.remoteGadgetId )
			{
				// this is the gadget itself
				this.networkedGadgetsByEndpointId.delete( activeNetworkedGadget.peer.endpointId );
				if( gadgetInfo.remoteGadgetId )
				{
					this.networkedGadgetsByRemoteId.delete( gadgetInfo.remoteGadgetId );
					this.networkEventCallback( 
						{
							type: NetworkUniverseEventType.DestroyRemoteGadget,
							remoteGadgetId: gadgetInfo.remoteGadgetId, 
						} as NetworkUniverseEvent, true );
				}
			}
			else
			{
				// this interface never identified itself as either an item or a gadget
				// if it's the only reference we have to the endpoint Id, clean that up
				if( gadgetInfo.items.size == 0 )
				{
					this.networkedGadgetsByEndpointId.delete( activeNetworkedGadget.peer.endpointId );
				}
			}
		} );

		activeNetworkedGadget.onTransformUpdated( ( entityFromPeer: AvNodeTransform ) =>
		{
			if( gadgetInfo )
			{
				this.updateRemoteTransform( entityFromPeer, gadgetInfo, itemInfo );
			}
		} );
	}

	private updateRemoteTransform( entityFromPeer: AvNodeTransform, gadgetInfo: NetworkedGadgetInfoInternal, 
		itemInfo: NetworkedItemInfoInternal )
	{
		if( !gadgetInfo.remoteGadgetId )
			return;

		let universeFromGadget = minimalPoseFromTransform( entityFromPeer );
		this.networkEventCallback(
			{
				type: NetworkUniverseEventType.UpdateRemoteGadgetTransform,
				remoteGadgetId: gadgetInfo.remoteGadgetId,
				itemId: itemInfo?.itemId,
				universeFromGadget,
			} as NetworkUniverseEvent, false );
	}

	public get receives()
	{
		return [ { iface: NetworkedGadgetComponent.interfaceName, processor: this.onNetworkInterface } ];
	}

	public get wantsTransforms()
	{
		return true;
	}

	public remoteEvent( event: object )
	{
		let e = event as NetworkUniverseEvent;
		switch( e.type )
		{
			case NetworkUniverseEventType.SendMasterGadgetEvent:
				this.masterEvent( e.remoteGadgetId, e.itemId, e.event );
				break;
		}
	}

	private masterEvent( remoteGadgetId: number, itemId: string, event: object )
	{
		let gadgetInfo = this.networkedGadgetsByRemoteId.get( remoteGadgetId );
		if( !gadgetInfo )
		{
			console.log( "Received master event for unknown remote gadget ", remoteGadgetId );
			return;
		}

		let sendEvent: NGESendEvent =
		{
			type: NetworkGadgetEventType.ReceiveEventFromRemote,
			event,
		};

		if( itemId )
		{
			let itemInfo = gadgetInfo.items.get( itemId );
			itemInfo?.iface?.sendEvent( sendEvent );
		}
		else
		{
			gadgetInfo?.iface?.sendEvent( sendEvent );
		}	
	}


	/** The initialization info packet that the room needs to communicate to
	 * any remote universe it is starting up. 
	 */
	public get initInfo(): object
	{
		let gadgets: NetworkedGadgetInfo[] = [];
		for( let internalInfo of this.networkedGadgetsByRemoteId.values() )
		{
			gadgets.push( 
				{
					url: internalInfo.url,
					remoteLocks: internalInfo.remoteLocks,
					universeFromGadget: minimalPoseFromTransform( internalInfo.iface.selfFromPeer ),
					remoteGadgetId: internalInfo.remoteGadgetId,
				}
			)
		}

		return { gadgets } as UniverseInitInfo;
	}

	public render(): JSX.Element
	{
		return null;
	}
}

