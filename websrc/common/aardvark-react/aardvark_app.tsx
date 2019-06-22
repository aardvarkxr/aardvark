import * as React from 'react';

import { Av, AvPanelHandler, AvAppObj, AvSceneContext } from 'common/aardvark';
import { IAvBaseNode } from './aardvark_base_node';
import bind from 'bind-decorator';

interface AvAppProps
{
	name: string;
}

export class AvApp extends React.Component< AvAppProps, {} >
{
	private static s_instance:AvApp = null;

	m_nextNodeId = 1;
	m_registeredNodes: {[nodeId:number]:IAvBaseNode } = {};
	m_app: AvAppObj = null;
	m_nextFrameRequest: number = 0;
	m_traversedNodes: {[nodeId:number]:IAvBaseNode } = {};

	constructor( props: any )
	{
		super( props );
		AvApp.s_instance = this;
		this.m_app = Av().createApp( this.props.name );
	}

	public static instance()
	{
		return AvApp.s_instance;
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
		this.m_app.registerPanelHandler( nodeId, handler );
		this.markDirty();
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
		let context = this.m_app.startSceneContext();

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

	public render()
	{
		return <div>{ this.props.children }</div>;
	}
}