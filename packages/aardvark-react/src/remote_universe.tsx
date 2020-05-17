import { emptyVolume, InitialInterfaceLock, MinimalPose } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as React from 'react';
import { NetworkUniverseEvent, NetworkUniverseEventType, UniverseInitInfo } from './network_universe';
import { ActiveInterface, AvInterfaceEntity } from './aardvark_interface_entity';
import { RemoteGadgetEvent, RemoteGadgetEventType, RGESendEvent, RemoteGadgetComponent } from './component_remote_gadget';
import { AvTransform } from './aardvark_transform';
import { AvEntityChild } from './aardvark_entity_child';
import { AvGadget } from './aardvark_gadget';

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

interface RemoteGadgetInfo
{
	remoteGadgetId: number;
	url: string;
	remoteLocks: InitialInterfaceLock[];
	iface: ActiveInterface;
	universeFromGadget: MinimalPose;
}

interface RemoteUniverseParams
{
	remoteGadgetId: number;
}

export class RemoteUniverse extends React.Component< RemoteUniverseProps, {} >
{
	private remoteGadgets = new Map< number, RemoteGadgetInfo >();
	private universeRef = React.createRef<AvInterfaceEntity>();

	constructor( props: any )
	{
		super( props );
	}
	
	@bind
	private onRemoteInterface( activeRemoteGadget: ActiveInterface )
	{
		let remoteParams = activeRemoteGadget.params as RemoteUniverseParams;
		let gadgetInfo = this.remoteGadgets.get( remoteParams.remoteGadgetId );
		gadgetInfo.iface = activeRemoteGadget;
		this.forceUpdate();
		console.log( `Connection from remote gadget id ${ gadgetInfo.remoteGadgetId }` );

		activeRemoteGadget.onEvent( ( event: RemoteGadgetEvent ) =>
		{
			switch( event.type )
			{
				case RemoteGadgetEventType.SendEventToMaster:
				{
					let sendEvent = event as RGESendEvent;
					this.props.onRemoteEvent( 
						{ 
							type: NetworkUniverseEventType.SendMasterGadgetEvent, 
							remoteGadgetId: gadgetInfo.remoteGadgetId,
							event: sendEvent.event 
						} as NetworkUniverseEvent, sendEvent.reliable );
				}
				break;
			}
		} );

		activeRemoteGadget.onEnded( () =>
		{
			if( gadgetInfo )
			{
				this.remoteGadgets.delete( gadgetInfo.remoteGadgetId );
			}
		} );
	}

	componentDidMount()
	{
		let initInfo = this.props.initInfo as UniverseInitInfo;
		for( let gadgetInfo of initInfo.gadgets )
		{
			this.createGadget( gadgetInfo.remoteGadgetId,gadgetInfo.url, gadgetInfo.remoteLocks, 
				gadgetInfo.universeFromGadget );
		}
	}

	public networkEvent( event: object )
	{
		let e = event as NetworkUniverseEvent;
		switch( e.type )
		{
			case NetworkUniverseEventType.CreateRemoteGadget:
				this.createGadget( e.remoteGadgetId, e.gadgetUrl, e.remoteInterfaceLocks, e.universeFromGadget );
				break;

			case NetworkUniverseEventType.DestroyRemoteGadget:
				this.destroyGadget( e.remoteGadgetId );
				break;

			case NetworkUniverseEventType.UpdateRemoteGadgetTransform:
				this.updateGadgetTransform( e.remoteGadgetId, e.universeFromGadget );
				break;

			case NetworkUniverseEventType.BroadcastRemoteGadgetEvent:
				this.masterEvent( e.remoteGadgetId, e.event );
				break;
		}
	}

	private createGadget( remoteGadgetId: number, gadgetUrl: string, remoteInterfaceLocks: InitialInterfaceLock[], 
		universeFromGadget: MinimalPose )
	{
		if( this.remoteGadgets.has( remoteGadgetId ) )
		{
			throw new Error( `duplicate createGadget for remote gadget id ${ remoteGadgetId } with ${ gadgetUrl }` );
		}

		this.remoteGadgets.set( remoteGadgetId,
			{
				remoteGadgetId,
				url: gadgetUrl,
				remoteLocks: remoteInterfaceLocks,
				iface: null,
				universeFromGadget,
			} );

		let fullLockList = [ ...remoteInterfaceLocks,
		{
			iface: RemoteGadgetComponent.interfaceName,
			receiver: this.universeRef.current.globalId,
			params: { remoteGadgetId },
		} ];

		AvGadget.instance().startGadget( gadgetUrl, fullLockList );
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

	private updateGadgetTransform( remoteGadgetId: number, universeFromGadget: MinimalPose )
	{
		let gadgetInfo = this.remoteGadgets.get( remoteGadgetId );
		if( gadgetInfo )
		{
			gadgetInfo.universeFromGadget = universeFromGadget;
			this.forceUpdate();
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
					<AvEntityChild child={ gadget.iface.peer } />
				</AvTransform> );
		}

		return <AvInterfaceEntity receives={ [ { iface: RemoteGadgetComponent.interfaceName, processor: this.onRemoteInterface } ] }
			volume={ emptyVolume() } ref={ this.universeRef }>
				{ children }
			</AvInterfaceEntity>;
	}
}
