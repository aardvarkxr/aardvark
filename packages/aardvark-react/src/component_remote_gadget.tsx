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