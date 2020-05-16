import { AardvarkManifest, AuthedRequest, Av, AvActionState, AvGrabEvent, AvGrabEventProcessor, AvInterfaceEventProcessor, AvNode, AvNodeTransform, AvNodeType, AvPanelHandler, AvPanelMouseEvent, AvPanelMouseEventType, AvStartGadgetResult, EAction, EHand, EndpointAddr, endpointAddrToString, EndpointType, ENodeFlags, Envelope, GadgetRoom, GadgetRoomCallbacks, GadgetRoomEnvelope, getActionFromState, InitialInterfaceLock, interfaceStringFromMsg, LocalUserInfo, MessageType, MsgCreateRoom, MsgCreateRoomResponse, MsgDestroyRoomResponse, MsgGadgetStarted, MsgGetInstalledGadgets, MsgGetInstalledGadgetsResponse, MsgGrabEvent, MsgInterfaceEnded, MsgInterfaceEvent, MsgInterfaceReceiveEvent, MsgInterfaceStarted, MsgInterfaceTransformUpdated, MsgMasterStartGadget, MsgMouseEvent, MsgNodeHaptic, MsgPokerProximity, MsgResourceLoadFailed, MsgRoomMessageReceived, MsgRoomMessageReceivedResponse, MsgSaveSettings, MsgSendRoomMessage, MsgSignRequest, MsgSignRequestResponse, MsgUpdateActionState, MsgUpdateSceneGraph, MsgUserInfo, PokerProximity, stringToEndpointAddr } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as React from 'react';
import { IAvBaseNode } from './aardvark_base_node';
import { AsyncMessageHandler, MessageHandler } from './aardvark_endpoint';
import { RemoteGadgetComponent } from './component_remote_gadget';
import { CGadgetEndpoint } from './gadget_endpoint';

const equal = require( 'fast-deep-equal' );
export interface AvInterfaceEntityProcessor
{
	started( transmitter: EndpointAddr, receiver: EndpointAddr, iface: string, 
		transmitterFromReceiver: AvNodeTransform, params?: object ): void;
	ended( transmitter: EndpointAddr, receiver: EndpointAddr, iface: string, 
		transmitterFromReceiver: AvNodeTransform ): void;
	event( destination: EndpointAddr, peer: EndpointAddr, iface: string, data: object, 
		destinationFromPeer: AvNodeTransform ): void;
	transformUpdated( destination: EndpointAddr, peer: EndpointAddr, iface: string, 
		destinationFromPeer: AvNodeTransform ): void;
}

export interface AvPokerHandler
{
	( isPressed: boolean, proximity: PokerProximity[] ): void;
}


interface AvGadgetProps
{
	gadgetUri?: string;
	onSettingsReceived?: ( settings: any ) => void;
}

function parseURL(url: string) 
{
    var parser = document.createElement('a'),
        searchObject: {[ key: string ]: string } = {},
        queries, split, i;

	// Let the browser do the work
	parser.href = url;
	
    // Convert query string to object
    queries = parser.search.replace(/^\?/, '').split('&');
    for( i = 0; i < queries.length; i++ ) {
        split = queries[i].split('=');
        searchObject[split[0]] = split[1];
	}
	
	return searchObject;
}

interface ActionStateListener
{
	hand: EHand;
	action: EAction;
	rising?: () => void;
	falling?: () => void;
}

interface GadgetRoomDetails
{
	room: GadgetRoom;
	callbacks: GadgetRoomCallbacks;
}

/** The singleton gadget object for the browser. */
export class AvGadget
{
	private static s_instance:AvGadget = null;

	m_onSettingsReceived:( settings: any ) => void = null;

	m_nextNodeId = 1;
	m_registeredNodes: {[nodeId:number]:IAvBaseNode } = {};
	m_nextFrameRequest: number = 0;
	m_traversedNodes: {[nodeId:number]:IAvBaseNode } = {};
	m_endpoint: CGadgetEndpoint = null;
	m_manifest: AardvarkManifest = null;
	m_actualGadgetUri: string = null;
	m_actionState: { [hand:number]: AvActionState } = {};
	private m_persistenceUuid: string;
	private m_remoteUniversePath: string;
	private m_ownerUuid: string;
	private m_remotePersistenceUuid: string;
	private m_epToNotify: EndpointAddr = null;
	private m_firstSceneGraph: boolean = true;
	private m_mainGrabbable: AvNode = null;
	private m_mainHandle: AvNode = null;
	private m_mainGrabbableComponent: IAvBaseNode = null;
	private m_mainHandleComponent: IAvBaseNode = null;
	private m_userInfo: LocalUserInfo = null;
	private m_userInfoListeners: (()=>void)[] = [];
	private m_initialInterfaces: InitialInterfaceLock[] = [];

	m_grabEventProcessors: {[nodeId:number]: AvGrabEventProcessor } = {};
	m_pokerProcessors: {[nodeId:number]: AvPokerHandler } = {};
	m_panelProcessors: {[nodeId:number]: AvPanelHandler } = {};
	m_interfaceEventProcessors: {[nodeId: number]: AvInterfaceEventProcessor } = {}
	m_interfaceEntityProcessors = new Map<number, AvInterfaceEntityProcessor>();
	m_startGadgetPromises: {[nodeId:number]: 
		[ ( res: AvStartGadgetResult ) => void, ( reason: any ) => void ] } = {};
	m_actionStateListeners: { [listenerId: number] : ActionStateListener } = {};
	m_roomDetails: { [roomId: string] : GadgetRoomDetails } = {};

	constructor()
	{
		if( window.location.pathname.lastIndexOf( ".html" ) == window.location.pathname.length - 5 )
		{
			this.m_actualGadgetUri = 
				window.location.origin
				+ window.location.pathname.slice( 0, window.location.pathname.lastIndexOf( "/" ) );
			//console.log( "Stripping gadget URI down to", this.m_actualGadgetUri );
		}
		else
		{
			this.m_actualGadgetUri = window.location.origin;
		}

		let params = parseURL( window.location.href );
		this.m_persistenceUuid = params[ "persistenceUuid" ];
		this.m_remoteUniversePath = params[ "remoteUniversePath" ];
		this.m_ownerUuid = params[ "ownerUuid" ];
		this.m_remotePersistenceUuid = params[ "remotePersistenceUuid" ];

		try
		{
			console.log( "initialHook", params[ "initialHook" ] );
			if( params[ "initialHook" ] )
			{
				this.m_initialInterfaces = JSON.parse( atob( params[ "initialHook" ] ) );
				console.log( "initialInterfaces", this.m_initialInterfaces );
			}
		}
		catch( e )
		{
			console.log( `failed to parse initial interfaces ${ e }` );
		}

		if( params[ "epToNotify"] )
		{
			this.m_epToNotify = stringToEndpointAddr( params[ "epToNotify"] );
			console.log( "This gadget wants to notify " + endpointAddrToString(this.m_epToNotify ) );
		}

		if( this.m_remoteUniversePath )
		{
			console.log( "This gadget is remote from " + this.m_remoteUniversePath );
		}

		this.m_endpoint = new CGadgetEndpoint( this.m_actualGadgetUri, 
			params["initialHook"], this.m_persistenceUuid, this.m_remoteUniversePath,
			this.m_ownerUuid,
			this.onEndpointOpen );
	}

	@bind public onEndpointOpen( settings: any, persistenceUuid: string )
	{
		this.m_endpoint.getGadgetManifest( this.m_actualGadgetUri )
		.then( ( manifest: AardvarkManifest ) =>
		{
			this.m_manifest = manifest;
			this.markDirty();
		});

		this.m_endpoint.registerHandler( MessageType.GrabEvent, this.onGrabEvent );
		this.m_endpoint.registerHandler( MessageType.GadgetStarted, this.onGadgetStarted );
		this.m_endpoint.registerHandler( MessageType.PokerProximity, this.onPokerProximity );
		this.m_endpoint.registerHandler( MessageType.MouseEvent, this.onMouseEvent );
		this.m_endpoint.registerHandler( MessageType.MasterStartGadget, this.onMasterStartGadget );
		this.m_endpoint.registerHandler( MessageType.UpdateActionState, this.onUpdateActionState );
		this.m_endpoint.registerHandler( MessageType.ResourceLoadFailed, this.onResourceLoadFailed );
		this.m_endpoint.registerHandler( MessageType.UserInfo, this.onUserInfo );
		this.m_endpoint.registerHandler( MessageType.SendRoomMessage, this.onSendRoomMessage );
		this.m_endpoint.registerAsyncHandler( MessageType.InterfaceEvent, this.onInterfaceEvent );
		this.m_endpoint.registerAsyncHandler( MessageType.InterfaceStarted, this.onInterfaceStarted );
		this.m_endpoint.registerAsyncHandler( MessageType.InterfaceEnded, this.onInterfaceEnded );
		this.m_endpoint.registerAsyncHandler( MessageType.InterfaceReceiveEvent, 
			this.onInterfaceReceivedEvent );
		this.m_endpoint.registerAsyncHandler( MessageType.InterfaceTransformUpdated, 
			this.onInterfaceTransformUpdated );

		if( this.m_onSettingsReceived )
		{
			this.m_onSettingsReceived( settings );
		}

		if( persistenceUuid != this.m_persistenceUuid )
		{
			history.pushState( 
				{ gadgetUri: this.m_actualGadgetUri, persistenceUuid },
				"", 
				this.m_actualGadgetUri + "/index.html?persistenceUuid=" + persistenceUuid );
		}
	}

	/** Returns the AvGadget singleton.
	 * 
	 * @public
	 */
	public static instance()
	{
		if( !AvGadget.s_instance )
		{
			AvGadget.s_instance = new AvGadget();
		}
		return AvGadget.s_instance;
	}

	/** Returns the name of the gadget. 
	 * 
	 * @public
	*/
	public getName()
	{
		if( this.m_manifest )
		{
			return this.m_manifest.name;
		}
		else
		{
			return this.m_actualGadgetUri;
		}
	}

	/** Returns the URL of the gadget. */
	public get url()
	{
		return this.m_actualGadgetUri;
	}

	/** The initial parent requested by whomever started this gadget. */
	public get initialInterfaces()
	{
		return this.m_initialInterfaces;
	}
	
	/** Returns a specific initial interface lock if it exists. */
	public findInitialInterface( intefaceName: string ): InitialInterfaceLock
	{
		return this.m_initialInterfaces.find( ( lock )=> lock.iface == intefaceName );
	}


	/** Loads a gadget manifest by gadget URI.
	 * 
	 * @returns a promise that will resolve to the specified gadget's manifest
	 * @public
	 */
	public loadManifest( gadgetUri: string ) : Promise<AardvarkManifest>
	{
		return this.m_endpoint.getGadgetManifest( gadgetUri );
	}

	/** Returns a list of all the installed gadget's URIs. 
	 * 
	 * @public
	*/
	public getInstalledGadgets(): Promise< string[] >
	{
		console.log( "Requesting installed gadgets" );

		return new Promise<string[]>( ( resolve, reject ) =>
		{
			let m: MsgGetInstalledGadgets = {};
			this.m_endpoint.sendMessageAndWaitForResponse<MsgGetInstalledGadgetsResponse>( 
				MessageType.GetInstalledGadgets, m, 
				MessageType.GetInstalledGadgetsResponse )
			.then( ( [ resp, env ]: [ MsgGetInstalledGadgetsResponse, Envelope ]) =>
			{
				resolve( resp.installedGadgets );
			});
		});
	}

	public register( node: IAvBaseNode )
	{
		//console.log( "assigning id", this.m_nextNodeId );
		node.m_nodeId = this.m_nextNodeId++;
		this.m_registeredNodes[ node.m_nodeId ] = node;
		this.markDirty();
	}

	public unregister( node: IAvBaseNode )
	{
		if( node.m_nodeId )
		{
			delete this.m_registeredNodes[ node.m_nodeId ];
			node.m_nodeId = undefined;
		}

		this.markDirty();
	}

	public setPanelHandler( nodeId: number, handler: AvPanelHandler )
	{
		this.m_panelProcessors[ nodeId ] = handler;
		this.markDirty();
	}

	public setPokerHandler( nodeId: number, handler: AvPokerHandler )
	{
		this.m_pokerProcessors[ nodeId ] = handler;
		this.markDirty();
	}

	public setGrabEventProcessor( nodeId: number, processor: AvGrabEventProcessor )
	{
		this.m_grabEventProcessors[ nodeId ] = processor;
		this.markDirty();
	}

	public getEndpointId() : number
	{
		return this.m_endpoint.getEndpointId();
	}

	@bind onGrabEvent( m: MsgGrabEvent, env: Envelope ):void
	{
		let processor = this.m_grabEventProcessors[ env.target.nodeId ];
		if( processor )
		{
			processor( m.event );
		}
	}

	@bind onGadgetStarted( m: MsgGadgetStarted, env: Envelope ):void
	{
		let processor = this.m_startGadgetPromises[ env.target.nodeId ];
		if( processor )
		{
			processor[0](
				{
					success: true,
					startedGadgetEndpointId: m.startedGadgetEndpointId,
					mainGrabbableGlobalId: m.mainGrabbableGlobalId,
					mainHandleId: m.mainHandleGlobalId,
				}
			);
			delete this.m_startGadgetPromises[ env.target.nodeId ];
		}
	}

	public sendGrabEvent( event: AvGrabEvent )
	{
		this.m_endpoint.sendGrabEvent( event );
	}

	public setInterfaceEntityProcessor( nodeId: number, processor: AvInterfaceEntityProcessor )
	{
		this.m_interfaceEntityProcessors.set( nodeId, processor );
		this.markDirty();
	}

	public clearInterfaceEntityProcessor( nodeId: number )
	{
		this.m_interfaceEntityProcessors.delete( nodeId );
		this.markDirty();
	}

	private getInterfaceEntityProcessor( epa: EndpointAddr ): AvInterfaceEntityProcessor
	{
		if( epa.endpointId != this.m_endpoint.getEndpointId() )
		{
			return null;
		}

		return this.m_interfaceEntityProcessors.get( epa.nodeId );
	}

	@bind
	private async onInterfaceStarted( m: MsgInterfaceStarted, env: Envelope )
	{
		console.log( `Received interface start for ${ interfaceStringFromMsg( m ) }` );
		let processor = this.getInterfaceEntityProcessor( env.target );
		if( processor )
		{
			processor.started(m.transmitter, m.receiver, m.iface, m.transmitterFromReceiver, m.params );
		}

		if( !processor )
		{
			console.log( `Received interface start for ${ interfaceStringFromMsg( m ) },`
				+ ` which doesn't have a processor` );
		}
	}

	@bind
	private async onInterfaceEnded( m: MsgInterfaceEnded, env: Envelope )
	{
		let processor = this.getInterfaceEntityProcessor( env.target );
		if( processor )
		{
			processor.ended(m.transmitter, m.receiver, m.iface, m.transmitterFromReceiver );
		}

		if( !processor )
		{
			console.log( `Received interface start for ${ interfaceStringFromMsg( m ) },`
				+ ` which doesn't have a processor` );
		}
	}

	@bind
	private async onInterfaceReceivedEvent( m: MsgInterfaceReceiveEvent, env: Envelope )
	{
		let processor = this.getInterfaceEntityProcessor( m.destination );
		if( processor )
		{
			processor.event(m.destination, m.peer, m.iface, m.event, m.destinationFromPeer );
		}

		if( !processor )
		{
			console.log( `Received interface event for ${ endpointAddrToString( m.destination ) },`
				+ ` which doesn't have a processor` );
		}
	}

	@bind
	private async onInterfaceTransformUpdated( m: MsgInterfaceTransformUpdated, env: Envelope )
	{
		let processor = this.getInterfaceEntityProcessor( m.destination );
		if( processor )
		{
			processor.transformUpdated( m.destination, m.peer, m.iface, m.destinationFromPeer );
		}

		if( !processor )
		{
			console.log( `Received interface transformUpdated for ${ endpointAddrToString( m.destination ) },`
				+ ` which doesn't have a processor` );
		}
	}

	public setInterfaceEventProcessor( nodeId: number, processor: AvInterfaceEventProcessor )
	{
		this.m_interfaceEventProcessors[ nodeId ] = processor;
		this.markDirty();
	}

	public sendInterfaceEvent( nodeId: number, destination: EndpointAddr, iface: string, data: object )
	{
		let m: MsgInterfaceEvent =
		{
			destination,
			interface: iface,
			data,
		};

		if( destination.endpointId == this.m_endpoint.getEndpointId() )
		{
			let env: Envelope =
			{
				type: MessageType.InterfaceEvent,
				sender: { type: EndpointType.Node, endpointId: this.m_endpoint.getEndpointId(), nodeId },
				sequenceNumber: -1,
			}

			// if this is a local send, just bounce it back to our own node
			// Does this need to be async?
			this.onInterfaceEvent( m, env );
		}
		else
		{
			this.sendMessage( MessageType.InterfaceEvent, m );
		}
	}

	@bind
	private async onInterfaceEvent( m: MsgInterfaceEvent, env: Envelope )
	{
		let processor = this.m_interfaceEventProcessors[ m.destination.nodeId ];
		if( !processor )
		{
			console.log( `Received interface event for ${ m.destination.nodeId }, which doesn't have a processor`)
		}
		else
		{
			processor( m.interface, env.sender, m.data );
		}
	}

	@bind private onPokerProximity( m: MsgPokerProximity, env: Envelope )
	{
		let processor = this.m_pokerProcessors[ env.target.nodeId ];
		if( processor )
		{
			processor( m.actionState.grab, m.panels );
		}
	}

	public sendMouseEvent( pokerId: EndpointAddr, panelId: EndpointAddr, 
		eventType:AvPanelMouseEventType, x: number, y: number )
	{
		let evt: AvPanelMouseEvent = 
		{
			type: eventType,
			panelId,
			pokerId,
			x,
			y,
		};

		let msg: MsgMouseEvent =
		{
			event: evt,
		}

		this.m_endpoint.sendMessage( MessageType.MouseEvent, msg );
	}

	@bind private onMouseEvent( m: MsgMouseEvent, env: Envelope  )
	{
		let processor = this.m_panelProcessors[ env.target.nodeId ];
		if( processor )
		{
			processor( m.event );
		}
	}

	@bind private onMasterStartGadget( m: MsgMasterStartGadget )
	{
		Av().startGadget( 
			{
				uri: m.uri, 
				initialHook: m.initialHook, 
				persistenceUuid: m.persistenceUuid,
				remoteUniversePath: m.remoteUserId,
				epToNotify: m.epToNotify,
				remotePersistenceUuid: m.remotePersistenceUuid,
			} );
	}

	@bind private onResourceLoadFailed( m: MsgResourceLoadFailed )
	{
		console.error( `Resource load failed for ${ endpointAddrToString( m.nodeId ) }.`
			+ ` uri=${ m.resourceUri } error=${ m.error }` );
	}

	public listenForActionState( action: EAction, hand: EHand, 
		rising: () => void, falling: () =>void ): number
	{
		let handle = this.m_nextNodeId++;
		
		this.m_actionStateListeners[ handle ] = 
		{
			hand,
			action,
			rising,
			falling,
		};

		return handle;
	}


	public listenForActionStateWithComponent( hand: EHand, action: EAction, comp: React.Component ): number
	{
		let fn = () => { comp.forceUpdate(); };
		return this.listenForActionState( action, hand, fn, fn );
	}

	public unlistenForActionState( handle: number )
	{
		delete this.m_actionStateListeners[ handle ];
	}

	@bind private onUpdateActionState( m: MsgUpdateActionState, env: Envelope )
	{
		let oldState = this.m_actionState[ m.hand ];
		let newState = m.actionState;
		if( !equal( newState, oldState ) )
		{
			// Set the state first in case any of the listeners read it
			this.m_actionState[m.hand] = m.actionState;
			
			for( let handle in this.m_actionStateListeners )
			{
				let listener = this.m_actionStateListeners[ handle ];
				if( listener.hand == m.hand || listener.hand == EHand.Invalid )
				{
					let oldAction = getActionFromState( listener.action, oldState );
					let newAction = getActionFromState( listener.action, newState );
					if( !oldAction && newAction && listener.rising )
					{
						listener.rising();
					}
					else if( oldAction && !newAction && listener.falling )
					{
						listener.falling();
					}
				}
			}
		}
	}

	/** Returns true if the gadget is in edit mode for the 
	 * specified hand.
	 * 
	 * @public
	 */
	public getActionStateForHand( hand: EHand, action: EAction )
	{
		if( hand == undefined || hand == EHand.Invalid )
		{
			return getActionFromState( action, this.m_actionState[ EHand.Left] )
				|| getActionFromState( action, this.m_actionState[ EHand.Right] );
		}
		else
		{
			return getActionFromState( action, this.m_actionState[ hand ] )
		}
	}
	
	private traverseNode( domNode: HTMLElement ): AvNode[]
	{
		let lowerName = domNode.nodeName.toLowerCase();
		let node:AvNode = null;
		switch( lowerName )
		{
			case "av-node":
				let attr = domNode.getAttribute( "nodeId" );
				if( attr )
				{
					let nodeId = parseInt( attr );
					let reactNode = this.m_registeredNodes[ nodeId ];
					if( reactNode )
					{
						node = reactNode.createNodeForNode();
						if( node.type == AvNodeType.Grabbable && !this.m_mainGrabbable )
						{
							this.m_mainGrabbable = node;
							this.m_mainGrabbableComponent = reactNode;
						}
						if( node.type == AvNodeType.Handle && !this.m_mainHandle )
						{
							this.m_mainHandle = node;
							this.m_mainHandleComponent = reactNode;
						}

						this.m_traversedNodes[nodeId] = reactNode;
					}
				}
				break;
		}

		let children: AvNode[] = [];
		for( let n = 0; n < domNode.children.length; n++ )
		{
			let childDomNode = domNode.children.item( n );
			if( childDomNode instanceof HTMLElement )
			{
				let descencents = this.traverseNode( childDomNode as HTMLElement );
				if( descencents && descencents.length > 0 )
				{
					children = children.concat( descencents );
				}
			}
		}

		// figure out what to return
		if( node )
		{
			// if we got a node from the DOM, return that
			if( children.length > 0 )
			{
				node.children = children;
			}

			return [ node ];
		}
		else if( children.length > 0 )
		{
			// If we have children but no node, just return
			// the children. This node is a no-op.
			return children;
		}
		else
		{
			// otherwise, we've got nothing
			return null;
		}
	}

	@bind public updateSceneGraph()
	{
		if( !this.m_manifest )
		{
			console.log( "Updating scene graph before manifest was loaded" );
			return;
		}

		this.m_mainGrabbable = null;
		this.m_traversedNodes = {};
		let rootNodes = this.traverseNode( document.body );

		let msg: MsgUpdateSceneGraph = {};
		if( rootNodes && rootNodes.length > 0 )
		{
			if( rootNodes.length > 1 )
			{
				msg.root =
				{
					type: AvNodeType.Container,
					id: 0,
					flags: ENodeFlags.Visible,
					children: rootNodes,
				};
			}
			else
			{
				msg.root = rootNodes[0];
			}
		}

		this.m_endpoint.sendMessage( MessageType.UpdateSceneGraph, msg );

		if( this.m_firstSceneGraph )
		{
			//console.log( `sending GadgetStarted for ${ this.m_endpoint.getEndpointId() }`)
			this.m_firstSceneGraph = false;
			if( this.m_epToNotify )
			{
				let msgStarted: MsgGadgetStarted = 
				{
					epToNotify: this.m_epToNotify,
					startedGadgetEndpointId: this.m_endpoint.getEndpointId(),
				}

				if( this.m_mainGrabbable && this.m_mainHandle )
				{
					msgStarted.mainGrabbable = this.m_mainGrabbable.id;
					msgStarted.mainHandle = this.m_mainHandle.id;

					// this.m_mainHandleComponent.grabInProgress( this.m_epToNotify );
					// this.m_mainGrabbableComponent.grabInProgress( this.m_epToNotify );
				}

				this.m_endpoint.sendMessage( MessageType.GadgetStarted, msgStarted );
			}
		}
		this.m_nextFrameRequest = 0;
	}

	public markDirty()
	{
		if( !this.m_manifest )
		{
			// If we don't have our manifest yet, we can't update the scene graph.
			// We'll update automatically once that comes in.
			return;
		}

		if( this.m_nextFrameRequest == 0 )
		{
			this.m_nextFrameRequest = window.setTimeout( this.updateSceneGraph, 1 );
		}
	}

	public sendHapticEvent( nodeId: EndpointAddr, amplitude: number, frequency: number, duration: number ): void
	{
		let msg: MsgNodeHaptic =
		{
			nodeId,
			amplitude,
			frequency,
			duration,
		}
		this.m_endpoint.sendMessage( MessageType.NodeHaptic, msg );
	}

	public startGadget( uri: string, initialInterfaces: InitialInterfaceLock[], remoteUniversePath?: string,
		persistenceUuid?: string, ownerUuid?: string, remotePersistenceUuid?: string ) : 
		Promise<AvStartGadgetResult>
	{
		return new Promise( ( resolve, reject ) =>
		{
			let notifyNodeId = this.m_nextNodeId++;
			this.m_startGadgetPromises[ notifyNodeId ] = [ resolve, reject ];

			let initialHook = btoa( JSON.stringify( initialInterfaces ) );
			
			let epToNotify: EndpointAddr = 
			{
				type: EndpointType.Node,
				endpointId: this.m_endpoint.getEndpointId(),
				nodeId: notifyNodeId,
			}
			Av().startGadget( 
				{
					uri, initialHook, 
					persistenceUuid: persistenceUuid ?? "", 
					epToNotify, 
					remoteUniversePath,
					ownerUuid,
					remotePersistenceUuid,
				} );
		} );
	} 

	public get globallyUniqueId(): string 
	{
		if( this.m_ownerUuid && this.m_remotePersistenceUuid )
		{
			return this.m_remotePersistenceUuid + this.m_ownerUuid;
		}
		else
		{
			return this.m_persistenceUuid + this.localUserInfo.userUuid;
		}
	}

	public get isRemote() : boolean
	{
		return !!this.findInitialInterface( RemoteGadgetComponent.interfaceName );
	}

	/** Persists the gadget's settings. These weill be passed to the gadget 
	 * via the callback registered with registerForSettings whenever the 
	 * gadget is reloaded.
	 * @public
	 */
	public saveSettings( settings: any )
	{
		let msg: MsgSaveSettings =
		{
			settings,
		}

		this.m_endpoint.sendMessage( MessageType.SaveSettings, msg );
	}

	/** The callback registered with this function will be invoked when
	 * the gadget's settings are reloaded from the server.
	 * @public
	 */
	public registerForSettings( callback: ( settings: any ) => void )
	{
		this.m_onSettingsReceived = callback;
	}

	/** Returns the endpoint address for a DOM node Id, or null if there
	 * isn't a matching Aardvark node with that Id.
	 */
	public getEndpointAddressForId( id: string ): EndpointAddr
	{
		let element = document.getElementById( id );
		if( !element )
		{
			console.log( "failed to find id " + id );
			return null;
		}

		if( element.nodeName.toLowerCase() != "av-node" )
		{
			console.log( "element was not an av-node " + id );
			return null;
		}

		let attr = element.getAttribute( "nodeId" );
		if( !attr )
		{
			console.log( "element didn't have nodeId set " + id );
			return null;
		}

		let nodeId = parseInt( attr );
		return {
			type: EndpointType.Node,
			endpointId: this.getEndpointId(),
			nodeId: nodeId,
		}
	}

	@bind
	private onUserInfo( msg: MsgUserInfo )
	{
		this.m_userInfo = msg.info;
		if( this.m_userInfoListeners )
		{
			for( let listener of this.m_userInfoListeners )
			{
				listener();
			}
		}
	}

	/** Adds a listener for user info updates */
	public addUserInfoListener( fn: ()=>void ) 
	{
		this.m_userInfoListeners.push( fn );
		if( this.m_userInfo )
		{
			fn();
		}
	}

	/** Returns a promise that will be fulfilled when the 
	 * local user info becomes available.
	 */
	public getLocalUserInfo(): Promise< LocalUserInfo >
	{
		if( this.m_userInfo )
		{
			return Promise.resolve( this.m_userInfo );
		}
	
		return new Promise( (resolve, reject ) =>
		{
			let fn = () =>
			{
				resolve( this.localUserInfo );
				global.setTimeout( () => { this.removeUserInfoListener( fn ); }, 1 );
			};

			this.addUserInfoListener( fn );
		} );
	}


	/** Removes a listener for user info updates */
	public removeUserInfoListener( fn: ()=>void ) 
	{
		let i = this.m_userInfoListeners.findIndex( fn );
		if( i != -1 )
		{
			this.m_userInfoListeners.splice( i, 1 );
		}
	}

	/** Returns the local user's uuid. */
	public get localUserInfo() : LocalUserInfo
	{
		return this.m_userInfo;
	}

	/** Gadgets call this function to create a room. 
	 * 
	 * roomId - the ID to use for this room. This ID must be unique
	 * 				within the gadget.
	 */
	public createRoom( roomId: string, callbacks: GadgetRoomCallbacks ): Promise<GadgetRoom>
	{
		console.log( `createRoom ${ roomId }` );
		return new Promise<GadgetRoom>( async ( resolve, reject ) =>
		{
			let msgCreate: MsgCreateRoom =
			{
				roomId,
			};
			let [ resp ] = await this.m_endpoint.sendMessageAndWaitForResponse<MsgCreateRoomResponse>( 
				MessageType.CreateRoom, msgCreate, MessageType.CreateRoomResponse );
			if( resp.error )
			{
				throw new Error( resp.error );
			}

			let room: GadgetRoom =
			{
				onMessage: async ( message: GadgetRoomEnvelope ) =>
				{
					console.log( `room.onMessage ${ roomId }: ${ JSON.stringify( message ) }` );
					if( !message )
					{
						throw new Error( "onMessage called with no message" );
					}
					let msgReceived: MsgRoomMessageReceived =
					{
						roomId,
						message,
					}
					let [ resp ] = await this.m_endpoint
						.sendMessageAndWaitForResponse<MsgRoomMessageReceivedResponse>(
							MessageType.RoomMessageReceived, msgReceived, 
							MessageType.RoomMessageReceivedResponse );
					if( resp.error )
					{
						throw new Error( resp.error );
					}
				},

				destroy: async (): Promise<void> =>
				{
					console.log( `room.destroy ${ roomId }` );
					let [ resp ] =await this.m_endpoint
						.sendMessageAndWaitForResponse<MsgDestroyRoomResponse>(
						MessageType.DestroyRoom, { roomId }, MessageType.DestroyRoomResponse );
					if( resp.error )
					{
						throw new Error( resp.error );
					}
					delete this.m_roomDetails[ roomId ];
				}
			};

			let details = {	room, callbacks, };
			this.m_roomDetails[ roomId ] = details;
			resolve( room );
		} );
	}

	@bind
	public onSendRoomMessage( msg: MsgSendRoomMessage )
	{
		let details = this.m_roomDetails[ msg.roomId ];
		details?.callbacks.sendMessage( msg.message );
	}

	/** Adds a handler for a raw Aardvark message. You probably don't need this. */
	public registerMessageHandler( type: MessageType, handler: MessageHandler )
	{
		this.m_endpoint.registerHandler( type, handler );
	}

	/** Adds an asynchronous handler for a raw Aardvark message. You probably don't need this. */
	public registerAsyncMessageHandler( type: MessageType, handler: AsyncMessageHandler )
	{
		this.m_endpoint.registerAsyncHandler( type, handler );
	}

	/** Sends a message to the server. You probably don't need this either. */
	public sendMessage( type: MessageType, message: object, sendingNode?: number )
	{
		this.m_endpoint.sendMessage( type, message, sendingNode );
	}

	/** Sends a message and returns a promise that resolves when the response to that message
	 * arrives.
	 */
	public sendMessageAndWaitForResponse<T>( type: MessageType, msg: any, responseType: MessageType ):
		Promise< [ T, Envelope ] >
	{
		return this.m_endpoint.sendMessageAndWaitForResponse<T>( type, msg, responseType );
	}

	/** Sends a request to the server to be authenticated. */
	public async signRequest( request: AuthedRequest )
	{
		let msgReq: MsgSignRequest = { request };
		let [ msgRes ] = await this.m_endpoint.sendMessageAndWaitForResponse<MsgSignRequestResponse>( 
			MessageType.SignRequest, msgReq, MessageType.SignRequestResponse );
		return msgRes.request;
	}
}

