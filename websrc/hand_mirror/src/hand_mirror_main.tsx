import { NGESetGadgetInfo, AvGadget, AvRoomMember, AvStandardGrabbable, AvTransform, ShowGrabbableChildren, ActiveInterface, NetworkGadgetEvent, NetworkGadgetEventType, minimalPoseFromTransform, NGESendEvent, AvInterfaceEntity, NetworkedGadgetComponent, RemoteGadgetEvent, RemoteGadgetEventType, RGESendEvent, RemoteGadgetComponent, AvEntityChild, AvOrigin } from '@aardvarkxr/aardvark-react';
import { GadgetRoom, GadgetRoomCallbacks, GadgetRoomEnvelope, g_builtinModelHandMirror, RMMemberJoined, RoomMemberIdReserved, RoomMessageType, InitialInterfaceLock, MinimalPose, AvNodeTransform, infiniteVolume, emptyVolume } from '@aardvarkxr/aardvark-shared';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import bind from 'bind-decorator';



enum NetworkUniverseEventType
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

interface NetworkUniverseEvent
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

interface NetworkUniverseProps
{
	/** This callback is called when room should send a an event to all remote universes.
	 * 
	 * @param event		An object, opaque to the room itself, that allows the network universe to
	 * 					communicate with its remote peers.
	 * @param reliable	If this argument is true, the room must deliver the message to every remote
	 * 					universe or that universe will be out of synch with the network universe. 
	 */
	onNetworkEvent: ( event: object, reliable: boolean ) => void;
}

interface UniverseInitInfo
{
	gadgets: NetworkedGadgetInfo[];
}

export class NetworkUniverse extends React.Component< NetworkUniverseProps, {} >
{
	private networkedGadgets = new Map< number, NetworkedGadgetInfoInternal >();
	static nextRemoteGadgetId = 1;

	constructor( props: any )
	{
		super( props );
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
					let remoteGadgetId = NetworkUniverse.nextRemoteGadgetId++;

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
						this.props.onNetworkEvent( createEvent, true );	
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
						this.props.onNetworkEvent( netEvent, sendEvent.reliable );
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
				this.props.onNetworkEvent( 
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
				this.props.onNetworkEvent( 
					{
						type: NetworkUniverseEventType.UpdateRemoteGadgetTransform,
						remoteGadgetId: gadgetInfo.remoteGadgetId, 
						universeFromGadget,
					} as NetworkUniverseEvent, false );
			}
		} );
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

	render()
	{
		return <AvInterfaceEntity receives={ [ { iface: NetworkedGadgetComponent.interfaceName, processor: this.onNetworkInterface } ] }
			volume={ infiniteVolume() } wantsTransforms={ true }/>
	}
}

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


interface HandMirrorState
{
	grabbed: boolean;
	networkUniverse?: NetworkUniverse;
}

class HandMirror extends React.Component< {}, HandMirrorState >
{
	private remoteUniverse = React.createRef<RemoteUniverse>();

	constructor( props: any )
	{
		super( props );

		this.state = { grabbed: false };
	}

	@bind
	private onNetworkEvent( event: object, reliable: boolean )
	{
		this.remoteUniverse.current?.networkEvent( event );
	}

	@bind
	private onRemoteEvent( event: object, reliable: boolean )
	{
		this.state.networkUniverse?.remoteEvent( event );
	}

	@bind
	private onNetworkUniverseRef( networkUniverse: NetworkUniverse )
	{
		this.setState( { networkUniverse } );
	}

	public render()
	{
		return <AvStandardGrabbable modelUri={ g_builtinModelHandMirror } 
				onGrab={ () => { this.setState( { grabbed: true} );} } 
				onEndGrab={ () => { this.setState( { grabbed: false } );} } >
				<AvOrigin path="/space/stage">
					{ this.state.grabbed && 
						<NetworkUniverse ref={ this.onNetworkUniverseRef }
						onNetworkEvent={this.onNetworkEvent } /> }
					<AvTransform translateX={ 0.1 }>
						{ this.state.networkUniverse &&
							<RemoteUniverse ref={ this.remoteUniverse }
								onRemoteEvent={ this.onRemoteEvent } 
								initInfo={ this.state.networkUniverse.initInfo } /> }
					</AvTransform>
				</AvOrigin>
			</AvStandardGrabbable>
	}
}


ReactDOM.render( <HandMirror/>, document.getElementById( "root" ) );
