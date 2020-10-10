import { AvNodeTransform, EndpointAddr, InitialInterfaceLock, MinimalPose, minimalPoseFromTransform } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as React from 'react';
import { EntityComponent } from './aardvark_composed_entity';
import { AvEntityChild } from './aardvark_entity_child';
import { AvGadget } from './aardvark_gadget';
import { ActiveInterface } from './aardvark_interface_entity';
import { AvTransform } from './aardvark_transform';
import { k_remoteGrabbableInterface, RemoteGadgetComponent, RemoteGadgetEvent, RemoteGadgetEventType, RGESendEvent } from './component_remote_gadget';
import { NetworkedGadgetInfo, NetworkedItemInfo, NetworkUniverseEvent, NetworkUniverseEventType, UniverseInitInfo } from './network_universe';

interface RemoteUniverseProps
{
	/** This callback is called when the room should convey the supplied event to the network
	 * universe and call remoteEvent() on that object. 
	 * 
	 * @param event		The opaque event object to send
	 * @param reliable	If this is true, the event must be delivered or the gadgets may 
	 * 					get out of synch with each other. If this is false, the room should
	 * 					make its best effort to deliver the event, but the system will recover
	 * 					if the event is discarded.
	 */
	onRemoteEvent: ( event: object, reliable: boolean ) => void;

	/** The initialization info packet provided by the NetworkUniverse that this remote
	 * universe is connected to.
	 */
	initInfo: object;
}

interface RemoteItemInfo
{
	itemId: string;
	iface: ActiveInterface;
	universeFromItem: MinimalPose;
	grabbed: boolean;
}

interface RemoteGadgetInfo
{
	remoteGadgetId: number;
	url: string;
	remoteLocks: InitialInterfaceLock[];
	iface: ActiveInterface;
	universeFromGadget: MinimalPose;
	items: Map<string, RemoteItemInfo>;
}

interface RemoteUniverseParams
{
	remoteGadgetId: number;
	itemId?: string;
}

export class RemoteUniverseComponent implements EntityComponent
{
	private remoteGadgets = new Map< number, RemoteGadgetInfo >();
	private remoteEventCallback: ( event: object, reliable: boolean ) => void;
	private entityCallback: () => void = null;
	private entityEpa: EndpointAddr = null;
	private initInfo: UniverseInitInfo;

	/** @param initInfo The initialization info packet provided by the NetworkUniverse that this remote
	 * universe is connected to.
	 * 
	 * @param onRemoteEvent This callback is called when the room should convey the supplied event to the network
	 * universe and call remoteEvent() on that object. 
	 * 
	 * event		The opaque event object to send
	 * reliable	If this is true, the event must be delivered or the gadgets may 
	 * 					get out of synch with each other. If this is false, the room should
	 * 					make its best effort to deliver the event, but the system will recover
	 * 					if the event is discarded.
	 */
	constructor( initInfo: object, onRemoteEvent: ( event: object, reliable: boolean ) => void )
	{
		this.initInfo = initInfo as UniverseInitInfo;
		this.remoteEventCallback = onRemoteEvent;
	}

	public onUpdate( callback: () => void )
	{
		this.entityCallback = callback;
	}

	public setEntityEpa( epa: EndpointAddr )
	{
		this.entityEpa = epa;

		if( epa )
		{
			for( let gadgetInfo of this.initInfo.gadgets )
			{
				this.createGadget( gadgetInfo );
			}	
		}
		else
		{
			console.log( "Discarding entity for remote universe. Remote gadgets will be destroyed.")
		}
	}

	public findOrAddItemInfo( gadgetInfo: RemoteGadgetInfo, itemId: string )
	{
		let itemInfo = gadgetInfo.items.get( itemId );
		if( !itemInfo )
		{
			itemInfo = 
			{
				itemId,
				iface: null,
				universeFromItem: null,
				grabbed: false,
			};
			gadgetInfo.items.set( itemId, itemInfo );
		}
		return itemInfo;
	}

	@bind
	private onRemoteInterface( activeRemoteGadget: ActiveInterface )
	{
		let remoteParams = activeRemoteGadget.params as RemoteUniverseParams;
		let gadgetInfo = this.remoteGadgets.get( remoteParams.remoteGadgetId );
		let itemInfo: RemoteItemInfo;
		if( remoteParams.itemId )
		{
			itemInfo = this.findOrAddItemInfo( gadgetInfo, remoteParams.itemId );
			itemInfo.iface = activeRemoteGadget;
		}
		else
		{
			gadgetInfo.iface = activeRemoteGadget;
		}
		this.entityCallback?.();
		console.log( `Connection from remote gadget id ${ gadgetInfo.remoteGadgetId }` );

		activeRemoteGadget.onEvent( ( event: RemoteGadgetEvent ) =>
		{
			switch( event.type )
			{
				case RemoteGadgetEventType.SendEventToMaster:
				{
					let sendEvent = event as RGESendEvent;
					this.remoteEventCallback( 
						{ 
							type: NetworkUniverseEventType.SendMasterGadgetEvent, 
							remoteGadgetId: gadgetInfo.remoteGadgetId,
							itemId: remoteParams.itemId,
							event: sendEvent.event 
						} as NetworkUniverseEvent, sendEvent.reliable );
				}
				break;

				case RemoteGadgetEventType.StartGrab:
				{
					itemInfo.grabbed = true;

					let evt: NetworkUniverseEvent =
					{
						type: NetworkUniverseEventType.StartItemGrab,
						remoteGadgetId: gadgetInfo.remoteGadgetId,
						itemId: itemInfo.itemId,
					};

					this.remoteEventCallback( evt, true );
				}
				break;

				case RemoteGadgetEventType.EndGrab:
				{
					itemInfo.grabbed = false;

					let evt: NetworkUniverseEvent =
					{
						type: NetworkUniverseEventType.EndItemGrab,
						remoteGadgetId: gadgetInfo.remoteGadgetId,
						itemId: itemInfo.itemId,
					};

					this.remoteEventCallback( evt, true );
				}
				break;
			}
		} );

		activeRemoteGadget.onEnded( () =>
		{
			if( gadgetInfo )
			{
				if( !remoteParams.itemId )
				{
					this.remoteGadgets.delete( gadgetInfo.remoteGadgetId );
				}
				else
				{
					gadgetInfo.items.delete( remoteParams.itemId );
				}
			}
		} );
	}

	private updateRemoteGrabbable( params: RemoteUniverseParams, universeFromItem: AvNodeTransform )
	{
		let gadgetInfo = this.remoteGadgets.get( params.remoteGadgetId );
		if( !gadgetInfo )
			return;

		let itemInfo = gadgetInfo.items.get( params.itemId );
		if( !itemInfo )
			return;

		if( !itemInfo.grabbed )
			return;

		let m: NetworkUniverseEvent =
		{
			type: NetworkUniverseEventType.UpdateNetworkItemTransform,
			remoteGadgetId: params.remoteGadgetId,
			itemId: params.itemId,
			universeFromGadget: minimalPoseFromTransform( universeFromItem ),
		}
		this.remoteEventCallback?.( m, false );
	}

	@bind
	private onRemoteGrabbable( activeRemoteGadget: ActiveInterface )
	{
		let remoteParams = activeRemoteGadget.params as RemoteUniverseParams;
		this.updateRemoteGrabbable( remoteParams, activeRemoteGadget.selfFromPeer );

		activeRemoteGadget.onTransformUpdated( ( universeFromItem: AvNodeTransform ) =>
		{
			this.updateRemoteGrabbable( remoteParams, universeFromItem)
		} );

		activeRemoteGadget.onEnded( () =>
		{
			let gadgetInfo = this.remoteGadgets.get( remoteParams.remoteGadgetId );
			if( !gadgetInfo )
				return;

			let itemInfo = gadgetInfo.items.get( remoteParams.itemId );
			if( !itemInfo )
				return;

			if( !itemInfo.grabbed )
				return;

			itemInfo.grabbed = false;

			let evt: NetworkUniverseEvent =
			{
				type: NetworkUniverseEventType.EndItemGrab,
				remoteGadgetId: gadgetInfo.remoteGadgetId,
				itemId: itemInfo.itemId,
			};

			this.remoteEventCallback( evt, true );
		} )
	}

	public get receives()
	{
		return [ 
			{ iface: RemoteGadgetComponent.interfaceName, processor: this.onRemoteInterface },
			{ iface: k_remoteGrabbableInterface, processor: this.onRemoteGrabbable },
		];
	}

	public get wantsTransforms()
	{
		return true;
	}

	public networkEvent( event: object )
	{
		let e = event as NetworkUniverseEvent;
		switch( e.type )
		{
			case NetworkUniverseEventType.CreateRemoteGadget:
				this.createGadget( e.gadgetInfo );
				break;

			case NetworkUniverseEventType.DestroyRemoteGadget:
				this.destroyGadget( e.remoteGadgetId );
				break;

			case NetworkUniverseEventType.UpdateRemoteGadgetTransform:
				this.updateGadgetTransform( e.remoteGadgetId, e.itemId, e.universeFromGadget );
				break;

			case NetworkUniverseEventType.BroadcastRemoteGadgetEvent:
				this.masterEvent( e.remoteGadgetId, e.event );
				break;
		}
	}

	private createGadget( gadgetInfo: NetworkedGadgetInfo )
	{
		if( this.remoteGadgets.has( gadgetInfo.remoteGadgetId ) )
		{
			throw new Error( 
				`duplicate createGadget for remote gadget id ${ gadgetInfo.remoteGadgetId } with ${ gadgetInfo.url }` );
		}
		if( !this.entityEpa )
		{
			throw new Error( `createGadget before the entity gave us their Endpoint Address` );
		}

		let newGadget: RemoteGadgetInfo =
		{
			remoteGadgetId: gadgetInfo.remoteGadgetId,
			url: gadgetInfo.url,
			remoteLocks: gadgetInfo.remoteLocks,
			iface: null,
			universeFromGadget: gadgetInfo.universeFromGadget,
			items: new Map<string, RemoteItemInfo>(),
		};

		for( let item of ( gadgetInfo.items ?? [] ) )
		{
			newGadget.items.set( item.itemId,
				{
					itemId: item.itemId,
					iface: null,
					universeFromItem: item.remoteUniverseFromItem,
					grabbed: false,
				} );
		}

		this.remoteGadgets.set( gadgetInfo.remoteGadgetId, newGadget );

		let fullLockList = [ ...gadgetInfo.remoteLocks,
		{
			iface: RemoteGadgetComponent.interfaceName,
			receiver: this.entityEpa,
			params: { remoteGadgetId: gadgetInfo.remoteGadgetId },
		} ];

		AvGadget.instance().startGadget( gadgetInfo.url, fullLockList );
	}

	private destroyGadget( remoteGadgetId: number )
	{
		let gadgetInfo = this.remoteGadgets.get( remoteGadgetId );

		let event: RemoteGadgetEvent =
		{
			type: RemoteGadgetEventType.DestroyGadget,
		};
	
		gadgetInfo?.iface?.sendEvent( event );
	}

	private updateGadgetTransform( remoteGadgetId: number, itemId: string, universeFromGadget: MinimalPose )
	{
		let gadgetInfo = this.remoteGadgets.get( remoteGadgetId );
		if( gadgetInfo )
		{
			if( itemId )
			{
				let itemInfo = this.findOrAddItemInfo( gadgetInfo, itemId );
				itemInfo.universeFromItem = universeFromGadget;
			}
			else
			{
				gadgetInfo.universeFromGadget = universeFromGadget;
			}
			this.entityCallback?.();
		}
	}

	private masterEvent( remoteGadgetId: number, event: object )
	{
		let gadgetInfo = this.remoteGadgets.get( remoteGadgetId );

		let sendEvent: RGESendEvent =
		{
			type: RemoteGadgetEventType.ReceiveEventFromMaster,
			event,
		};
	
		gadgetInfo?.iface?.sendEvent( sendEvent );
	}

	render()
	{
		let children: JSX.Element[] = [];
		for( let gadget of this.remoteGadgets.values() )
		{
			if( !gadget.iface || !gadget.universeFromGadget )
				continue;

			children.push( <AvTransform transform={ gadget.universeFromGadget } key={ gadget.remoteGadgetId }>
					<AvEntityChild child={ gadget.iface.peer } key={ gadget.remoteGadgetId }/>
				</AvTransform> );

			for( let item of gadget.items.values() )
			{
				if( !item.iface || !item.universeFromItem )
				{
					continue;
				}

				let key = `${ gadget.remoteGadgetId }/${ item.itemId }`;
				children.push( <AvTransform transform={ item.universeFromItem } key={ key }>
					<AvEntityChild child={ item.iface.peer } key={ key }/>
				</AvTransform> );
			}
		}

		return <div key="remote_universe">
				{ children }
			</div>;
	}
}
