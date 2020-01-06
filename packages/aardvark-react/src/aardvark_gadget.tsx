import * as React from 'react';

import { Av, AvStartGadgetCallback, AvActionState, EAction, getActionFromState } from '@aardvarkxr/aardvark-shared';
import { IAvBaseNode } from './aardvark_base_node';
import bind from 'bind-decorator';
import { CGadgetEndpoint } from './gadget_endpoint';
import { MessageType, MsgUpdateSceneGraph, EndpointAddr, 
	MsgGrabEvent, stringToEndpointAddr, MsgGadgetStarted, 
	EndpointType, endpointAddrToString, MsgPokerProximity, 
	MsgMouseEvent, MsgNodeHaptic, MsgMasterStartGadget, 
	MsgSaveSettings, MsgUpdateActionState, AvGadgetManifest, AvPanelHandler, 
	PokerProximity, AvPanelMouseEventType, AvGrabEventProcessor, 
	AvGrabEvent, AvNode, AvNodeType, AvPanelMouseEvent, ENodeFlags, 
	EHand, MsgResourceLoadFailed,
	MsgGetInstalledGadgets,
	MsgGetInstalledGadgetsResponse} from '@aardvarkxr/aardvark-shared';
const equal = require( 'fast-deep-equal' );


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
	m_manifest: AvGadgetManifest = null;
	m_actualGadgetUri: string = null;
	m_actionState: { [hand:number]: AvActionState } = {};
	private m_persistenceUuid: string;
	private m_epToNotify: EndpointAddr = null;
	private m_firstSceneGraph: boolean = true;
	private m_mainGrabbable: AvNode = null;
	private m_mainHandle: AvNode = null;
	private m_mainGrabbableComponent: IAvBaseNode = null;
	private m_mainHandleComponent: IAvBaseNode = null;

	m_grabEventProcessors: {[nodeId:number]: AvGrabEventProcessor } = {};
	m_pokerProcessors: {[nodeId:number]: AvPokerHandler } = {};
	m_panelProcessors: {[nodeId:number]: AvPanelHandler } = {};
	m_startGadgetCallbacks: {[nodeId:number]: AvStartGadgetCallback } = {};
	m_actionStateListeners: { [listenerId: number] : ActionStateListener } = {}

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

		if( params[ "epToNotify"] )
		{
			this.m_epToNotify = stringToEndpointAddr( params[ "epToNotify"] );
			console.log( "This gadget wants to notify " + endpointAddrToString(this.m_epToNotify ) );
		}

		this.m_persistenceUuid = params[ "persistenceUuid" ];
		this.m_endpoint = new CGadgetEndpoint( this.m_actualGadgetUri, 
			params["initialHook"], params[ "persistenceUuid" ], 
			this.onEndpointOpen );
	}

	@bind public onEndpointOpen( settings: any, persistenceUuid: string )
	{
		this.m_endpoint.getGadgetManifest( this.m_actualGadgetUri )
		.then( ( manifest: AvGadgetManifest ) =>
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

	/** Loads a gadget manifest by gadget URI.
	 * 
	 * @returns a promise that will resolve to the specified gadget's manifest
	 * @public
	 */
	public loadManifest( gadgetUri: string ) : Promise<AvGadgetManifest>
	{
		return this.m_endpoint.getGadgetManifest( gadgetUri );
	}

	/** Returns a list of all the installed gadget's URIs. 
	 * 
	 * @public
	*/
	public getInstalledGadgets(): Promise< string[] >
	{
		let m: MsgGetInstalledGadgets = {};
		this.m_endpoint.sendMessage( MessageType.GetInstalledGadgets, m );
		console.log( "Requesting installed gadgets" );

		return new Promise<string[]>( ( resolve, reject ) =>
		{
			this.m_endpoint.waitForResponse( MessageType.GetInstalledGadgetsResponse, 
				( type: MessageType, resp: MsgGetInstalledGadgetsResponse ) =>
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

	@bind onGrabEvent( type:MessageType, m: MsgGrabEvent, sender: EndpointAddr, target: EndpointAddr ):void
	{
		let processor = this.m_grabEventProcessors[ target.nodeId ];
		if( processor )
		{
			processor( m.event );
		}
	}

	@bind onGadgetStarted( type:MessageType, m: MsgGadgetStarted, sender: EndpointAddr, target: EndpointAddr ):void
	{
		let processor = this.m_startGadgetCallbacks[ target.nodeId ];
		if( processor )
		{
			processor( true, m.mainGrabbableGlobalId, m.mainHandleGlobalId );
			delete this.m_startGadgetCallbacks[ target.nodeId ];
		}
	}

	public sendGrabEvent( event: AvGrabEvent )
	{
		this.m_endpoint.sendGrabEvent( event );
	}


	@bind private onPokerProximity( type:MessageType, m: MsgPokerProximity, sender: EndpointAddr, target: EndpointAddr )
	{
		let processor = this.m_pokerProcessors[ target.nodeId ];
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

	@bind private onMouseEvent( type:MessageType, m: MsgMouseEvent, sender: EndpointAddr, target: EndpointAddr )
	{
		let processor = this.m_panelProcessors[ target.nodeId ];
		if( processor )
		{
			processor( m.event );
		}
	}

	@bind private onMasterStartGadget( type: MessageType, m: MsgMasterStartGadget )
	{
		Av().startGadget( m.uri, m.initialHook, m.persistenceUuid, null );
	}

	@bind private onResourceLoadFailed( type: MessageType, m: MsgResourceLoadFailed )
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

	@bind private onUpdateActionState( type: MessageType, m: MsgUpdateActionState )
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
				}

				if( this.m_mainGrabbable && this.m_mainHandle )
				{
					msgStarted.mainGrabbable = this.m_mainGrabbable.id;
					msgStarted.mainHandle = this.m_mainHandle.id;

					this.m_mainHandleComponent.grabInProgress( this.m_epToNotify );
					this.m_mainGrabbableComponent.grabInProgress( this.m_epToNotify );
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

	public startGadget( uri: string, initialHook: string, callback: AvStartGadgetCallback )
	{
		let epToNotify: EndpointAddr = null;
		if( callback )
		{
			let notifyNodeId = this.m_nextNodeId++;
			this.m_startGadgetCallbacks[ notifyNodeId ] = callback;

			epToNotify = 
			{
				type: EndpointType.Node,
				endpointId: this.m_endpoint.getEndpointId(),
				nodeId: notifyNodeId,
			}
		}
		Av().startGadget( uri, initialHook, "", epToNotify );
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
}

