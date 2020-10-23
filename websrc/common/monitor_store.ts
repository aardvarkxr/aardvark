import { CMonitorEndpoint } from '@aardvarkxr/aardvark-react';
import { AvNode, EndpointAddr, EndpointType, Envelope, MessageType, MsgLostEndpoint, MsgNewEndpoint, MsgResourceLoadFailed, MsgUpdateSceneGraph, endpointAddrToString, MsgInterfaceStarted, MsgInterfaceEnded, MsgInterfaceSendEvent, MsgInterfaceRelock, MsgInterfaceUnlock, MsgInterfaceLock, MsgInterfaceLockResponse, InterfaceLockResult, MsgInterfaceUnlockResponse, MsgInterfaceRelockResponse } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import { action, computed, observable, ObservableMap } from 'mobx';

interface EndpointData
{
	id: number;
	type: EndpointType;
}

interface GadgetData extends EndpointData
{
	gadgetUri?: string;
	gadgetRoot?: AvNode;
	grabberIsPressed?: boolean;
	nodes?: { [ nodeId: number ]: AvNode; };
}

export class CMonitorStore
{
	private m_connection: CMonitorEndpoint;
	@observable m_endpoints: ObservableMap<number, EndpointData>;
	m_events = observable.array<MsgResourceLoadFailed>();

	constructor()
	{
		this.m_endpoints = new ObservableMap<number, EndpointData>();

		this.m_connection = new CMonitorEndpoint( this.onUnhandledMessage );
		this.m_connection.registerHandler( MessageType.NewEndpoint, this.onNewEndpoint );
		this.m_connection.registerHandler( MessageType.LostEndpoint, this.onLostEndpoint );
		this.m_connection.registerHandler( MessageType.UpdateSceneGraph, this.onUpdateSceneGraph );
		this.m_connection.registerHandler( MessageType.ResourceLoadFailed, this.onResourceLoadFailed );

		this.m_connection.registerHandler( MessageType.InterfaceStarted, this.logMessage );
		this.m_connection.registerHandler( MessageType.InterfaceEnded, this.logMessage );
		this.m_connection.registerHandler( MessageType.InterfaceReceiveEvent, this.logMessage );
		this.m_connection.registerHandler( MessageType.InterfaceSendEvent, this.logMessage );
		this.m_connection.registerHandler( MessageType.InterfaceSendEventResponse, this.logMessage );
		this.m_connection.registerHandler( MessageType.InterfaceLock, this.logMessage );
		this.m_connection.registerHandler( MessageType.InterfaceLockResponse, this.logMessage );
		this.m_connection.registerHandler( MessageType.InterfaceUnlock, this.logMessage );
		this.m_connection.registerHandler( MessageType.InterfaceUnlockResponse, this.logMessage );
		this.m_connection.registerHandler( MessageType.InterfaceRelock, this.logMessage );
		this.m_connection.registerHandler( MessageType.InterfaceRelockResponse, this.logMessage );
	}


	@bind
	private logMessage( msg: object, env: Envelope )
	{
		let decodedMsg = this.decodeMessageForDebug( msg, env );
		if( !decodedMsg )
			return;

		console.log( `Msg: ${ decodedMsg }` );
	}

	public decodeMessageForDebug( msg: object, env: Envelope )
	{
		switch( env.type )
		{
			// Some event types are too spammy to be useful
			case MessageType.InterfaceSendEventResponse:
			case MessageType.InterfaceReceiveEvent:
				return null;

			case MessageType.InterfaceStarted:
			{
				let m = msg as MsgInterfaceStarted;
				return `InterfaceStarted ${ this.epaDisplayText( m.transmitter ) } -> `
					+ `${ this.epaDisplayText( m.receiver ) } (${ m.iface })`;

			}		

			case MessageType.InterfaceEnded:
			{
				let m = msg as MsgInterfaceEnded;
				return `InterfaceEnded ${ this.epaDisplayText( m.transmitter ) } -> `
					+ `${ this.epaDisplayText( m.receiver ) } (${ m.iface })`;
			}		

			case MessageType.InterfaceSendEvent:
			{
				let m = msg as MsgInterfaceSendEvent;
				return `InterfaceSendEvent ${ this.epaDisplayText( m.peer ) } -> `
					+ `${ this.epaDisplayText( m.destination ) } (${ m.iface }): `
					+ JSON.stringify( m.event );
			}		

			case MessageType.InterfaceLock:
			{
				let m = msg as MsgInterfaceLock;
				return `InterfaceLock ${ this.epaDisplayText( m.transmitter ) } -> `
					+ `${ this.epaDisplayText( m.receiver ) } (${ m.iface })`;
			}

			case MessageType.InterfaceLockResponse:
			{
				let m = msg as MsgInterfaceLockResponse;
				return `InterfaceLockResponse ${ InterfaceLockResult[ m.result ] }`;
			}

			case MessageType.InterfaceUnlock:
			{
				let m = msg as MsgInterfaceUnlock;
				return `InterfaceUnlock ${ this.epaDisplayText( m.transmitter ) } -> `
					+ `${ this.epaDisplayText( m.receiver ) } (${ m.iface })`;
			}

			case MessageType.InterfaceUnlockResponse:
			{
				let m = msg as MsgInterfaceUnlockResponse;
				return `InterfaceUnlockResponse ${ InterfaceLockResult[ m.result ] }`;
			}

			case MessageType.InterfaceRelock:
			{
				let m = msg as MsgInterfaceRelock;
				return `InterfaceRelock ${ this.epaDisplayText( m.transmitter ) } -> `
					+ `${ this.epaDisplayText( m.oldReceiver ) } / ` 
					+ `${ this.epaDisplayText( m.newReceiver ) } (${ m.iface })`;
			}

			case MessageType.InterfaceRelockResponse:
			{
				let m = msg as MsgInterfaceRelockResponse;
				return `InterfaceRelockResponse ${ InterfaceLockResult[ m.result ] }`;
			}

			default:
				return `${ MessageType[ env.type ] } ${ this.epaDisplayText( env.sender ) } `
					+ `-> ${ this.epaDisplayText( env.target )}: ${ JSON.stringify( msg )}`;
		}
	}

	public getConnection() { return this.m_connection; }


	public getEndpointData( epid: number ): EndpointData
	{
		if ( this.m_endpoints.has( epid ) )
		{
			return this.m_endpoints.get( epid );
		}
		else
		{
			return null;
		}
	}


	public getGadgetData( epid: number ): GadgetData
	{
		let data = this.getEndpointData( epid );
		if ( data && data.type == EndpointType.Gadget )
			return data as GadgetData;
		else
			return null;
	}


	public getNodeData( nodeId: EndpointAddr ): AvNode
	{
		if ( nodeId.type != EndpointType.Node )
			return null;

		let gadgetData = this.getGadgetData( nodeId.endpointId );
		if ( !gadgetData )
			return null;

		return gadgetData.nodes[ nodeId.nodeId ];
	}

	public epaDisplayText( epa: EndpointAddr ): string
	{
		if( !epa )
			return null;

		switch( epa.type )
		{
			case EndpointType.Hub:
				return "HUB";

			case EndpointType.Renderer:
				return "RENDERER";

			case EndpointType.Monitor:
			default:
				return endpointAddrToString( epa );

			case EndpointType.Gadget:
			{
				let gadgetData = this.getGadgetData( epa.endpointId );
				if( !gadgetData )
				{
					return `Unknown Gadget ${ epa.endpointId }`;
				}
				else
				{
					// TODO: add manifest to the store
					return endpointAddrToString( epa );
				}
			}

			case EndpointType.Node:
				{
					let nodeData = this.getNodeData( epa );
					if( !nodeData )
					{
						return `Unknown Node (${ endpointAddrToString( epa ) })`;
					}
					else if( nodeData.persistentName )
					{
						return `${ nodeData.persistentName }(${ endpointAddrToString( epa ) })`;
					}
					else
					{
						return endpointAddrToString( epa );
					}
				}
		}
	}

	@bind async onUnhandledMessage( message: any, env: Envelope )
	{
		console.log( "received unhandled message", env.type, message, env.sender );
	}


	@bind @action onNewEndpoint( message: MsgNewEndpoint )
	{
		console.log( "New endpoint!", message );
		let data: EndpointData;
		switch ( message.newEndpointType )
		{
			case EndpointType.Gadget:
				let gadgetData: GadgetData = {
					type: message.newEndpointType,
					id: message.endpointId,
					gadgetUri: message.gadgetUri,
				};
				data = gadgetData;
				break;

			case EndpointType.Renderer:
				data =
				{
					type: message.newEndpointType,
					id: message.endpointId,
				};
				break;
		}

		if ( data )
		{
			this.m_endpoints.set( message.endpointId, data );
		}
	}


	@action private updateNode( gadgetData: GadgetData, node: AvNode )
	{
		gadgetData.nodes[ node.id ] = node;
		node.globalId = { type: EndpointType.Node, endpointId: gadgetData.id, nodeId: node.id };
		if ( node.children )
		{
			for ( let child of node.children )
			{
				this.updateNode( gadgetData, child );
			}
		}
	}


	@bind @action onUpdateSceneGraph( message: MsgUpdateSceneGraph, env: Envelope )
	{
		if ( !this.m_endpoints.has( env.sender.endpointId ) )
			return;

		let epData = this.m_endpoints.get( env.sender.endpointId );
		if ( !epData || epData.type != EndpointType.Gadget )
		{
			console.log( "UpdateSceneGraph for invalid endpoint", epData );
			return;
		}

		let gadgetData = epData as GadgetData;
		gadgetData.gadgetRoot = message.root;

		gadgetData.nodes = {};
		if ( gadgetData.gadgetRoot )
		{
			this.updateNode( gadgetData, gadgetData.gadgetRoot );
		}
	}


	@bind @action onLostEndpoint( message: MsgLostEndpoint )
	{
		console.log( "Lost endpoint!", message );
		this.m_endpoints.delete( message.endpointId );
	}


	@bind @action onResourceLoadFailed( message: MsgResourceLoadFailed )
	{
		this.m_events.push( message );
	}


	@computed get recentGrabEvents()
	{
		return this.m_events.slice( -10 );
	}


	public sendMessage( type: MessageType, m: any )
	{
		this.m_connection.sendMessage( type, m );
	}
}
