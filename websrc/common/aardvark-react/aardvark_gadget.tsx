import * as React from 'react';

import { Av, AvPanelHandler, AvGadgetObj, AvSceneContext, AvPokerHandler, AvPanelMouseEventType, 
	AvGrabEventProcessor, AvGrabberProcessor, AvGrabEventType } from 'common/aardvark';
import { IAvBaseNode } from './aardvark_base_node';
import bind from 'bind-decorator';

interface AvGadgetProps
{
	name: string;
}

export class AvGadget extends React.Component< AvGadgetProps, {} >
{
	private static s_instance:AvGadget = null;

	m_nextNodeId = 1;
	m_registeredNodes: {[nodeId:number]:IAvBaseNode } = {};
	m_gadget: AvGadgetObj = null;
	m_nextFrameRequest: number = 0;
	m_traversedNodes: {[nodeId:number]:IAvBaseNode } = {};

	constructor( props: any )
	{
		super( props );
		AvGadget.s_instance = this;
		this.m_gadget = Av().createGadget( this.props.name );
	}

	public static instance()
	{
		return AvGadget.s_instance;
	}

	public getName()
	{
		return this.props.name;
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
		this.m_gadget.enableDefaultPanelHandling( nodeId );
		this.markDirty();
	}

	public setPokerHandler( nodeId: number, handler: AvPokerHandler )
	{
		this.m_gadget.registerPokerHandler( nodeId, handler );
		this.markDirty();
	}

	public setGrabbableProcessor( nodeId: number, processor: AvGrabEventProcessor )
	{
		this.m_gadget.registerGrabbableProcessor( nodeId, processor );
		this.markDirty();
	}

	public setGrabberProcessor( nodeId: number, processor: AvGrabberProcessor )
	{
		this.m_gadget.registerGrabberProcessor( nodeId, processor );
		this.markDirty();
	}

	public sendGrabEvent( grabberId: number, grabbableId: string, hookId: string,
		eventType:AvGrabEventType )
	{
		this.m_gadget.sendGrabEvent( grabberId, grabbableId, hookId, eventType );
	}


	public sendMouseEvent( pokerId: number, panelId: string, 
		eventType:AvPanelMouseEventType, x: number, y: number )
	{
		this.m_gadget.sendMouseEvent( pokerId, panelId, eventType, x, y );
	}

	private traverseNode( context: AvSceneContext, domNode: HTMLElement )
	{
		let lowerName = domNode.nodeName.toLowerCase();
		let startedNode = false;
		switch( lowerName )
		{
			case "av-node":
				let attr = domNode.getAttribute( "nodeId" );
				if( attr )
				{
					let nodeId = parseInt( attr );
					let node = this.m_registeredNodes[ nodeId ];
					if( node )
					{
						node.pushNode( context );
						startedNode = true;
						this.m_traversedNodes[nodeId] = node;
					}
				}
				break;
		}

		for( let n = 0; n < domNode.children.length; n++ )
		{
			let childDomNode = domNode.children.item( n );
			if( childDomNode instanceof HTMLElement )
			{
				this.traverseNode( context, childDomNode as HTMLElement );
			}
		}

		if( startedNode )
		{
			context.finishNode();
		}
	}

	@bind public updateSceneGraph()
	{
		let context = this.m_gadget.startSceneContext();

		this.m_traversedNodes = {};
		this.traverseNode( context, document.body );

		context.finish();

		this.m_nextFrameRequest = 0;
	}

	public markDirty()
	{
		if( this.m_nextFrameRequest == 0 )
		{
			this.m_nextFrameRequest = window.requestAnimationFrame( this.updateSceneGraph );
		}
	}

	public sendHapticEventFromPanel( panelId: number, amplitude: number, frequency: number, duration: number ): void
	{
		this.m_gadget.sendHapticEventFromPanel( panelId, amplitude, frequency, duration );
	}

	public render()
	{
		return <div>{ this.props.children }</div>;
	}
}