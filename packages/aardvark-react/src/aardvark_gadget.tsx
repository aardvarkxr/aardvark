import { AardvarkManifest, Av, AvActionState, AvInterfaceEventProcessor, AvNode, AvNodeTransform, AvNodeType, AvStartGadgetResult, EAction, EHand, EndpointAddr, endpointAddrToString, EndpointType, ENodeFlags, Envelope, InitialInterfaceLock, interfaceStringFromMsg, MessageType, MsgGadgetStarted, MsgGetInstalledGadgets, MsgGetInstalledGadgetsResponse, MsgInterfaceEnded, MsgInterfaceEvent, MsgInterfaceReceiveEvent, MsgInterfaceStarted, MsgInterfaceTransformUpdated, MsgNodeHaptic, MsgResourceLoadFailed, MsgSaveSettings, MsgUpdateActionState, MsgUpdateSceneGraph, stringToEndpointAddr, AvVector } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as React from 'react';
import { IAvBaseNode } from './aardvark_base_node';
import { AsyncMessageHandler, MessageHandler } from './aardvark_endpoint';
import { RemoteGadgetComponent } from './component_remote_gadget';
import { CGadgetEndpoint } from './gadget_endpoint';

const equal = require( 'fast-deep-equal' );
export interface AvInterfaceEntityProcessor
{
	started( startMsg: MsgInterfaceStarted ): void;
	ended( endMsg: MsgInterfaceEnded ): void;
	event( eventMsg: MsgInterfaceReceiveEvent ): void;
	transformUpdated( transformMsg: MsgInterfaceTransformUpdated ): void;
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

function getBooleanActionFromState( action: EAction, state: AvActionState): boolean
{
	if( !state )
		return false;

	switch( action )
	{
		case EAction.A: return state.a;
		case EAction.B: return state.b;
		case EAction.Grab: return state.grab;
		case EAction.GrabShowRay: return state.grabShowRay;
		case EAction.Squeeze: return state.squeeze;
		case EAction.Detach: return state.detach;
		default: return false;
	}
}


interface ActionStateListener
{
	hand: EHand;
	action: EAction;
	rising?: () => void;
	falling?: () => void;
	update?: ( newValue: [ number, number ] ) => void;
}

export function GetGadgetUrlFromWindow()
{
	return window.location.origin
		+ window.location.pathname.slice( 0, window.location.pathname.lastIndexOf( "/" ) );
}

/** The singleton gadget object for the browser. */
export class AvGadget
{
	private static s_instance:AvGadget = null;

	private m_onSettingsReceived:( settings: any ) => void = null;

	private m_nextNodeId = 1;
	private m_registeredNodes: {[nodeId:number]:IAvBaseNode } = {};
	private m_nextFrameRequest: number = 0;
	private m_traversedNodes: {[nodeId:number]:IAvBaseNode } = {};
	private m_endpoint: CGadgetEndpoint = null;
	private m_manifest: AardvarkManifest = null;
	private m_actualGadgetUri: string = null;
	private m_actionState: { [hand:number]: AvActionState } = {};
	private m_epToNotify: EndpointAddr = null;
	private m_firstSceneGraph: boolean = true;
	private m_initialInterfaces: InitialInterfaceLock[] = [];
	private m_endpointOpened: boolean = false;
	private m_activeWaitForConnectReject: (reason: any) => void = null;
	private m_activeWaitForConnectResolve: () => void = null;

	private m_interfaceEventProcessors: {[nodeId: number]: AvInterfaceEventProcessor } = {}
	private m_interfaceEntityProcessors = new Map<number, AvInterfaceEntityProcessor>();
	private m_startGadgetPromises: {[nodeId:number]: 
		[ ( res: AvStartGadgetResult ) => void, ( reason: any ) => void ] } = {};
	private m_actionStateListeners: { [listenerId: number] : ActionStateListener } = {};

	constructor()
	{
		this.m_actualGadgetUri = GetGadgetUrlFromWindow();
		let params = parseURL( window.location.href );

		try
		{
			if( params[ "initialInterfaces" ] )
			{
				this.m_initialInterfaces = JSON.parse( atob( params[ "initialInterfaces" ] ) );
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

		this.m_endpoint = new CGadgetEndpoint( this.m_actualGadgetUri, this.onEndpointOpen );
	}

	/** Returns a promise that resolves when the initial endpoint handshake is complete
	 * 
	 * @public
	 */
	@bind public waitForConnect()
	{
		if( this.m_activeWaitForConnectReject ) {
			this.m_activeWaitForConnectReject("Another caller registered a promise");
			this.clearWaitForConnect();
		}

		return new Promise<void>( (resolve, reject) => 
		{
			if ( this.m_endpointOpened ) 
				resolve();

			this.m_activeWaitForConnectReject = reject
			this.m_activeWaitForConnectResolve = resolve
		});
	}

	@bind private clearWaitForConnect()
	{
		this.m_activeWaitForConnectReject = null;
		this.m_activeWaitForConnectResolve = null;
	}

	@bind public onEndpointOpen( settings: any )
	{
		this.m_endpoint.getGadgetManifest( this.m_actualGadgetUri )
		.then( ( manifest: AardvarkManifest ) =>
		{
			this.m_manifest = manifest;
			this.markDirty();
		});

		this.m_endpoint.registerHandler( MessageType.GadgetStarted, this.onGadgetStarted );
		this.m_endpoint.registerHandler( MessageType.UpdateActionState, this.onUpdateActionState );
		this.m_endpoint.registerHandler( MessageType.ResourceLoadFailed, this.onResourceLoadFailed );
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

		this.m_endpointOpened = true;
		if ( this.m_activeWaitForConnectResolve )
		{
			this.m_activeWaitForConnectResolve();
			this.clearWaitForConnect();
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

	/** Returns the gadget's manifest */
	public get manifest()
	{
		return this.m_manifest;
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

	public getEndpointId() : number
	{
		return this.m_endpoint.getEndpointId();
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
				}
			);
			delete this.m_startGadgetPromises[ env.target.nodeId ];
		}
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
			processor.started( m );
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
			processor.ended( m );
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
			processor.event( m );
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
			processor.transformUpdated( m );
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

	@bind private onResourceLoadFailed( m: MsgResourceLoadFailed )
	{
		console.error( `Resource load failed for ${ endpointAddrToString( m.nodeId ) }.`
			+ ` uri=${ m.resourceUri } error=${ m.error }` );
	}

	public listenForActionState( action: EAction, hand: EHand, 
		rising: () => void, falling: () =>void ): number
	{
		if( action == EAction.GrabMove )
		{
			throw new Error( `listenForActionState for ${ EAction[ action ] } which is vector2` );
		}

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

	public listenForVector2ActionState( action: EAction, hand: EHand, 
		update: ( value: [ number, number ] ) => void ): number
	{
		if( action != EAction.GrabMove )
		{
			throw new Error( `listenForVector2ActionState for ${ EAction[ action ] } which is boolean` );
		}

		let handle = this.m_nextNodeId++;
		
		this.m_actionStateListeners[ handle ] = 
		{
			hand,
			action,
			update,
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
					if( listener.action == EAction.GrabMove )
					{
						listener.update?.( newState.grabMove );
					}
					else
					{
						let oldAction = getBooleanActionFromState( listener.action, oldState );
						let newAction = getBooleanActionFromState( listener.action, newState );
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
			return getBooleanActionFromState( action, this.m_actionState[ EHand.Left] )
				|| getBooleanActionFromState( action, this.m_actionState[ EHand.Right] );
		}
		else
		{
			return getBooleanActionFromState( action, this.m_actionState[ hand ] )
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
			this.m_firstSceneGraph = false;
			if( this.m_epToNotify )
			{
				let msgStarted: MsgGadgetStarted = 
				{
					epToNotify: this.m_epToNotify,
					startedGadgetEndpointId: this.m_endpoint.getEndpointId(),
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

	public startGadget( uri: string, initialInterfaces: InitialInterfaceLock[] ) : 
		Promise<AvStartGadgetResult>
	{
		return new Promise( ( resolve, reject ) =>
		{
			let notifyNodeId = this.m_nextNodeId++;
			this.m_startGadgetPromises[ notifyNodeId ] = [ resolve, reject ];

			let initialInterfacesEncoded = btoa( JSON.stringify( initialInterfaces ) );
			
			let epToNotify: EndpointAddr = 
			{
				type: EndpointType.Node,
				endpointId: this.m_endpoint.getEndpointId(),
				nodeId: notifyNodeId,
			}
			Av().startGadget( 
				{
					uri, 
					initialInterfaces: initialInterfacesEncoded, 
					epToNotify, 
				} );

			window.setTimeout( () =>
			{
				if( this.m_startGadgetPromises[ notifyNodeId ] )
				{
					// it's been 30 seconds. If the gadget hasn't started by now,
					// tell the caller it's never going to start
					resolve( { success: false, error: "Timed out" } );
					delete this.m_startGadgetPromises[ notifyNodeId ];
				}
			}, 30000 );
		} );
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

}

