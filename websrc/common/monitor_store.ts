import { CMonitorEndpoint } from '@aardvarkxr/aardvark-react';
import { AvNode, EndpointAddr, EndpointType, Envelope, MessageType, MsgLostEndpoint, MsgNewEndpoint, MsgResourceLoadFailed, MsgUpdateSceneGraph } from '@aardvarkxr/aardvark-shared';
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
