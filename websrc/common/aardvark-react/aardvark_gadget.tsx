import * as React from 'react';

import { Av, AvPanelHandler, AvPokerHandler, AvPanelMouseEventType, 
	AvGrabEventProcessor, AvGrabberProcessor, AvGrabEventType, AvGrabEvent, AvGadgetManifest, AvNode, AvNodeType, AvStartGadgetCallback, AvPanelMouseEvent } from 'common/aardvark';
import { IAvBaseNode } from './aardvark_base_node';
import bind from 'bind-decorator';
import { CGadgetEndpoint } from './gadget_endpoint';
import { MessageType, MsgUpdateSceneGraph, EndpointAddr, MsgGrabberState, MsgGrabEvent, stringToEndpointAddr, MsgGadgetStarted, EndpointType, endpointAddrToString, MsgPokerProximity, MsgMouseEvent, MsgNodeHaptic } from './aardvark_protocol';

interface AvGadgetProps
{
	gadgetUri?: string;
}

export function parseURL(url: string) 
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

export class AvGadget extends React.Component< AvGadgetProps, {} >
{
	private static s_instance:AvGadget = null;

	m_nextNodeId = 1;
	m_registeredNodes: {[nodeId:number]:IAvBaseNode } = {};
	m_nextFrameRequest: number = 0;
	m_traversedNodes: {[nodeId:number]:IAvBaseNode } = {};
	m_endpoint: CGadgetEndpoint = null;
	m_manifest: AvGadgetManifest = null;
	m_actualGadgetUri: string = null;
	private m_epToNotify: EndpointAddr = null;
	private m_firstSceneGraph: boolean = true;
	private m_mainGrabbable: AvNode = null;

	m_grabberProcessors: {[nodeId:number]: AvGrabberProcessor } = {};
	m_grabEventProcessors: {[nodeId:number]: AvGrabEventProcessor } = {};
	m_pokerProcessors: {[nodeId:number]: AvPokerHandler } = {};
	m_panelProcessors: {[nodeId:number]: AvPanelHandler } = {};
	m_startGadgetCallbacks: {[nodeId:number]: AvStartGadgetCallback } = {};

	constructor( props: any )
	{
		super( props );
		AvGadget.s_instance = this;

		if( this.props.gadgetUri )
		{
			this.m_actualGadgetUri = this.props.gadgetUri;
		}
		else
		{
			if( window.location.pathname.lastIndexOf( ".html" ) == window.location.pathname.length - 5 )
			{
				this.m_actualGadgetUri = 
					window.location.origin
					+ window.location.pathname.slice( 0, window.location.pathname.lastIndexOf( "/" ) );
				console.log( "Stripping gadget URI down to", this.m_actualGadgetUri );
			}
			else
			{
				this.m_actualGadgetUri = window.location.origin;
			}
		}

		let params = parseURL( window.location.href );

		if( params[ "epToNotify"] )
		{
			this.m_epToNotify = stringToEndpointAddr( params[ "epToNotify"] );
			console.log( "This gadget wants to notify " + endpointAddrToString(this.m_epToNotify ) );
		}

		this.m_endpoint = new CGadgetEndpoint( this.m_actualGadgetUri, params["initialHook"], this.onEndpointOpen );
	}

	@bind public onEndpointOpen()
	{
		this.m_endpoint.getGadgetManifest( this.m_actualGadgetUri )
		.then( ( manifest: AvGadgetManifest ) =>
		{
			this.m_manifest = manifest;
			this.markDirty();
		});

		this.m_endpoint.registerHandler( MessageType.GrabberState, this.onGrabberState );
		this.m_endpoint.registerHandler( MessageType.GrabEvent, this.onGrabEvent );
		this.m_endpoint.registerHandler( MessageType.GadgetStarted, this.onGadgetStarted );
		this.m_endpoint.registerHandler( MessageType.PokerProximity, this.onPokerProximity );
		this.m_endpoint.registerHandler( MessageType.MouseEvent, this.onMouseEvent );
	}

	public static instance()
	{
		return AvGadget.s_instance;
	}

	public getName()
	{
		if( this.m_manifest )
		{
			return this.m_manifest.name;
		}
		else
		{
			return this.props.gadgetUri;
		}
	}

	public loadManifest( gadgetUri: string ) : Promise<AvGadgetManifest>
	{
		return this.m_endpoint.getGadgetManifest( gadgetUri );
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

	public setGrabberProcessor( nodeId: number, processor: AvGrabberProcessor )
	{
		this.m_grabberProcessors[ nodeId ] = processor;
		this.markDirty();
	}

	public getEndpointId() : number
	{
		return this.m_endpoint.getEndpointId();
	}

	@bind onGrabberState( type:MessageType, m: MsgGrabberState, sender: EndpointAddr, target: EndpointAddr ):void
	{
		let processor = this.m_grabberProcessors[ target.nodeId ];
		if( processor )
		{
			processor( m.isPressed, m.grabbables != undefined ? m.grabbables : [], 
				m.hooks != undefined ? m.hooks : [] );
		}
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
			processor( true, m.mainGrabbableGlobalId );
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
			processor( m.panels );
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
					flags: 0,
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
				}

				if( this.m_mainGrabbable )
				{
					msgStarted.mainGrabbable = this.m_mainGrabbable.id;
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
		Av().startGadget( uri, initialHook, epToNotify );
	} 

	public render()
	{
		return <div>{ this.props.children }</div>;
	}
}