import { AvNodeTransform, infiniteVolume, InitialInterfaceLock, MinimalPose, EndpointAddr } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as React from 'react';
import { ActiveInterface, AvInterfaceEntity, InterfaceProp } from './aardvark_interface_entity';
import { NetworkGadgetEvent, NetworkGadgetEventType, NGESetGadgetInfo, NGESendEvent, NetworkedGadgetComponent } from './component_networked_gadget';
import { minimalPoseFromTransform } from './math_utils';
import { EntityComponent } from './aardvark_composed_entity';
import { Interface } from 'readline';


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

interface NetworkedGadgetInfoInternal
{
	remoteGadgetId: number;
	url: string;
	remoteLocks: InitialInterfaceLock[];
	iface: ActiveInterface;
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
	private networkedGadgets = new Map< number, NetworkedGadgetInfoInternal >();
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
		let gadgetInfo: NetworkedGadgetInfoInternal;

		activeNetworkedGadget.onEvent( ( event: NetworkGadgetEvent ) =>
		{
			switch( event.type )
			{
				case NetworkGadgetEventType.SetGadgetInfo:
				{
					let setInfo = event as NGESetGadgetInfo;
					let universeFromGadget = minimalPoseFromTransform( activeNetworkedGadget.selfFromPeer );
					let remoteGadgetId = NetworkUniverseComponent.nextRemoteGadgetId++;

					if( gadgetInfo )
					{
						// we already know the startup info for this gadget. This just
						// updates us so the init info for any new remote universes will
						// have the new state
						gadgetInfo.remoteLocks = setInfo.locks;
						gadgetInfo.url = setInfo.url;
					}
					else
					{
						gadgetInfo =
						{
							remoteGadgetId,
							iface: activeNetworkedGadget,
							remoteLocks: setInfo.locks,
							url: setInfo.url,
						};
						this.networkedGadgets.set( remoteGadgetId, gadgetInfo );
	
						let createEvent: NetworkUniverseEvent =
						{
							type: NetworkUniverseEventType.CreateRemoteGadget,
							remoteGadgetId, 
							gadgetUrl: setInfo.url, 
							remoteInterfaceLocks: setInfo.locks, 
							universeFromGadget 
						};
						this.networkEventCallback( createEvent, true );	
					}
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
			if( gadgetInfo )
			{
				this.networkedGadgets.delete( gadgetInfo.remoteGadgetId );
				this.networkEventCallback( 
					{
						type: NetworkUniverseEventType.DestroyRemoteGadget,
						remoteGadgetId: gadgetInfo.remoteGadgetId, 
					} as NetworkUniverseEvent, true );
			}
		} );

		activeNetworkedGadget.onTransformUpdated( ( entityFromPeer: AvNodeTransform ) =>
		{
			if( gadgetInfo )
			{
				let universeFromGadget = minimalPoseFromTransform( entityFromPeer );
				this.networkEventCallback( 
					{
						type: NetworkUniverseEventType.UpdateRemoteGadgetTransform,
						remoteGadgetId: gadgetInfo.remoteGadgetId, 
						universeFromGadget,
					} as NetworkUniverseEvent, false );
			}
		} );
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
				this.masterEvent( e.remoteGadgetId, e.event );
				break;
		}
	}

	private masterEvent( remoteGadgetId: number, event: object )
	{
		let gadgetInfo = this.networkedGadgets.get( remoteGadgetId );

		let sendEvent: NGESendEvent =
		{
			type: NetworkGadgetEventType.ReceiveEventFromRemote,
			event,
		};
	
		gadgetInfo?.iface?.sendEvent( sendEvent );
	}


	/** The initialization info packet that the room needs to communicate to
	 * any remote universe it is starting up. 
	 */
	public get initInfo(): object
	{
		let gadgets: NetworkedGadgetInfo[] = [];
		for( let internalInfo of this.networkedGadgets.values() )
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

