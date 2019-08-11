import * as React from 'react';

import { Av, AvPanelHandler, AvGadgetObj, AvSceneContext, AvPokerHandler, AvPanelMouseEventType, 
	AvGrabEventProcessor, AvGrabberProcessor, AvGrabEventType, AvGrabEvent, AvGadgetManifest, AvNode, AvNodeType } from 'common/aardvark';
import { IAvBaseNode } from './aardvark_base_node';
import bind from 'bind-decorator';
import { CGadgetEndpoint } from './gadget_endpoint';
import { MessageType, MsgUpdateSceneGraph } from './aardvark_protocol';

interface AvGadgetProps
{
	gadgetUri?: string;
}

export class AvGadget extends React.Component< AvGadgetProps, {} >
{
	private static s_instance:AvGadget = null;

	m_nextNodeId = 1;
	m_registeredNodes: {[nodeId:number]:IAvBaseNode } = {};
	m_gadget: AvGadgetObj = null;
	m_nextFrameRequest: number = 0;
	m_traversedNodes: {[nodeId:number]:IAvBaseNode } = {};
	m_endpoint: CGadgetEndpoint = null;
	m_manifest: AvGadgetManifest = null;
	m_actualGadgetUri: string = null;

	m_grabberProcessors: {[nodeId:number]: AvGrabberProcessor } = {};
	m_grabEventProcessors: {[nodeId:number]: AvGrabEventProcessor } = {};
	m_pokerProcessors: {[nodeId:number]: AvPokerHandler } = {};

	constructor( props: any )
	{
		super( props );
		AvGadget.s_instance = this;

		let gadgetUri = this.props.gadgetUri ? this.props.gadgetUri : window.location.href;
		if( gadgetUri.lastIndexOf( ".html" ) == gadgetUri.length - 5 )
		{
			gadgetUri = gadgetUri.slice( 0, gadgetUri.lastIndexOf( "/" ) );
			console.log( "Stripping gadget URI down to", gadgetUri );
		}
		this.m_actualGadgetUri = gadgetUri;

		this.m_endpoint = new CGadgetEndpoint( this.m_actualGadgetUri, this.onEndpointOpen );
	}

	@bind public onEndpointOpen()
	{
		this.m_endpoint.getGadgetManifest( this.m_actualGadgetUri )
		.then( ( manifest: AvGadgetManifest ) =>
		{
			this.m_manifest = manifest;
			this.markDirty();
		});
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

	public register( node: IAvBaseNode )
	{
		node.m_nodeId = this.m_nextNodeId++;
		this.m_registeredNodes[ node.m_nodeId ] = node;
		this.markDirty();
	}

	public setPanelHandler( nodeId: number, handler: AvPanelHandler )
	{
		this.m_gadget.registerPanelHandler( nodeId, handler );
		this.markDirty();
	}


	public enableDefaultPanelHandling( nodeId: number )
	{
		// TODO: Make mouse events work again
		// this.m_gadget.enableDefaultPanelHandling( nodeId );
		// this.markDirty();
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

	public sendGrabEvent( event: AvGrabEvent )
	{
		this.m_gadget.sendGrabEvent( event );
	}


	public sendMouseEvent( pokerId: number, panelId: string, 
		eventType:AvPanelMouseEventType, x: number, y: number )
	{
		this.m_gadget.sendMouseEvent( pokerId, panelId, eventType, x, y );
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
						node = reactNode.buildNode();
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
					flags: 0,
					children: rootNodes,
				};
			}
			else
			{
				msg.root = rootNodes[0];
			}
		}

		this.m_endpoint.sendMessage( null, MessageType.UpdateSceneGraph, msg );

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
			this.m_nextFrameRequest = window.requestAnimationFrame( this.updateSceneGraph );
		}
	}

	public sendHapticEventFromPanel( panelId: number, amplitude: number, frequency: number, duration: number ): void
	{
//		this.m_gadget.sendHapticEventFromPanel( panelId, amplitude, frequency, duration );
	}

	public render()
	{
		return <div>{ this.props.children }</div>;
	}
}