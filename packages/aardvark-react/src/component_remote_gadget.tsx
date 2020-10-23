import { EndpointAddr, InitialInterfaceLock } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import { EntityComponent } from './aardvark_composed_entity';
import { AvGadget } from './aardvark_gadget';
import { ActiveInterface, InterfaceProp } from './aardvark_interface_entity';

export enum RemoteGadgetEventType
{
	ReceiveEventFromMaster = "receive_event_from_master",
	SendEventToMaster = "send_event_to_master",
	DestroyGadget = "destroy_gadget",
	SetItemInfo = "set_item_info",
	StartGrab = "start_grab",
	EndGrab = "end_grab",
}

export interface RemoteGadgetEvent
{
	type: RemoteGadgetEventType;
}

export interface RGESendEvent extends RemoteGadgetEvent
{
	event: object;
	reliable?: boolean;
}

export interface RGESetItemInfo extends RemoteGadgetEvent
{
	itemId: string;
}

export class RemoteGadgetComponent implements EntityComponent
{
	private entityCallback: () => void = null;
	private masterCallback: ( event: object ) => void = null;
	private activeRemote: ActiveInterface = null;

	static readonly interfaceName= "aardvark-remote-gadget@1";

	constructor( callback: ( event: object ) => void )
	{
		this.masterCallback = callback;
	}

	private updateListener()
	{
		this.entityCallback?.();
	}

	@bind
	private onRemoteStart( activeContainer: ActiveInterface )
	{
		activeContainer.onEvent( 
			( event: RemoteGadgetEvent ) =>
			{
				switch( event.type )
				{
					case RemoteGadgetEventType.ReceiveEventFromMaster:
					{
						let masterEvent = event as RGESendEvent;
						this.masterCallback?.( masterEvent.event );
					}
					break;

					case RemoteGadgetEventType.DestroyGadget:
					{
						window.close();
					}
				}
			}
		)

		activeContainer.onEnded( 
			() =>
			{
				this.activeRemote = null;
				this.updateListener();

				// this remote gadget is no longer in a room. It should destroy itself.
				window.close();
			} );

		this.activeRemote = activeContainer;
		this.updateListener();
	}

	public get transmits(): InterfaceProp[]
	{
		return [ { iface: RemoteGadgetComponent.interfaceName, processor: this.onRemoteStart } ];
	}

	public get receives(): InterfaceProp[]
	{
		return [];
	}

	public get parent(): EndpointAddr
	{
		return this.activeRemote?.peer;
	}
	
	public get wantsTransforms()
	{
		return false;
	}

	public get interfaceLocks(): InitialInterfaceLock[] 
	{
		return AvGadget.instance().initialInterfaces.filter( ( lock: InitialInterfaceLock ) => 
			lock.iface == RemoteGadgetComponent.interfaceName );
	}
	
	public onUpdate( callback: () => void ): void
	{
		this.entityCallback = callback;
	}
	
	public render(): JSX.Element
	{
		return null;
	}

	public sendEventToMaster( event: object, reliable: boolean )
	{
		let eventEvent: RGESendEvent =
		{
			type: RemoteGadgetEventType.SendEventToMaster,
			event,
			reliable,
		};
		this.activeRemote?.sendEvent( eventEvent );
	}
}

export const k_remoteGrabbableInterface ="aardvark-remote-grabbable@1";

export class RemoteItemComponent implements EntityComponent
{
	private entityCallback: () => void = null;
	private masterCallback: ( event: object ) => void = null;
	private activeRemote: ActiveInterface = null;
	private itemId: string;
	private isGrabbed: boolean = false;

	constructor( itemId: string, callback: ( event: object ) => void )
	{
		this.masterCallback = callback;
		this.itemId = itemId;
	}

	private updateListener()
	{
		this.entityCallback?.();
	}

	public setIsGrabbed( isGrabbed: boolean )
	{
		if( isGrabbed != this.isGrabbed )
		{
			// tell the other end how we want to be started on the remote end
			let req: RemoteGadgetEvent =
			{
				type: isGrabbed ? RemoteGadgetEventType.StartGrab : RemoteGadgetEventType.EndGrab,
			};
			this.activeRemote?.sendEvent( req );

			this.isGrabbed = isGrabbed;
		}
	}

	private sendSetItemInfo()
	{
		// tell the other end how we want to be started on the remote end
		let req: RGESetItemInfo =
		{
			type: RemoteGadgetEventType.SetItemInfo,
			itemId: this.itemId,
		};
		this.activeRemote?.sendEvent( req );
	}

	@bind
	private onRemoteStart( activeRemote: ActiveInterface )
	{
		activeRemote.onEvent( 
			( event: RemoteGadgetEvent ) =>
			{
				switch( event.type )
				{
					case RemoteGadgetEventType.ReceiveEventFromMaster:
					{
						let masterEvent = event as RGESendEvent;
						this.masterCallback?.( masterEvent.event );
					}
					break;

					case RemoteGadgetEventType.DestroyGadget:
					{
						window.close();
					}
				}
			}
		)

		activeRemote.onEnded( 
			() =>
			{
				this.activeRemote = null;
				this.updateListener();
			} );

		this.sendSetItemInfo();
		this.activeRemote = activeRemote;
		this.updateListener();
	}

	public get transmits(): InterfaceProp[]
	{
		return [ { iface: RemoteGadgetComponent.interfaceName, processor: this.onRemoteStart } ];
	}

	public get receives(): InterfaceProp[]
	{
		return [];
	}

	public get parent(): EndpointAddr
	{
		return !this.isGrabbed && this.activeRemote?.peer;
	}
	
	public get wantsTransforms()
	{
		return false;
	}

	public get interfaceLocks(): InitialInterfaceLock[] 
	{
		let lock = AvGadget.instance().findInitialInterface( RemoteGadgetComponent.interfaceName );
		if( !lock )
			return [];

		let itemLock = {...lock };
		itemLock.params = {...lock.params, itemId: this.itemId };
		return [ itemLock ];
	}
	
	
	public onUpdate( callback: () => void ): void
	{
		this.entityCallback = callback;
	}
	
	public render(): JSX.Element
	{
		return null;
	}

	public sendEventToMaster( event: object, reliable: boolean )
	{
		let eventEvent: RGESendEvent =
		{
			type: RemoteGadgetEventType.SendEventToMaster,
			event,
			reliable,
		};
		this.activeRemote?.sendEvent( eventEvent );
	}
}

