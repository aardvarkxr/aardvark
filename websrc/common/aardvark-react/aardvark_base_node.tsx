import * as React from 'react';

import { AvNode, AvNodeType, ENodeFlags } from 'common/aardvark';
import { AvGadget } from './aardvark_gadget';
import { EndpointAddr, EndpointType } from './aardvark_protocol';

declare global 
{
	namespace JSX
	{
		interface IntrinsicElements
		{
			// add an element type
			"av-node": any;
		}
	}
}

export interface AvBaseNodeProps
{
	visible?: boolean; // defaults to true
	persistentName?: string; // Set this if you need to store persistent references to this node
	onIdAssigned?: ( addr: EndpointAddr ) => void;
}

export interface IAvBaseNode
{
	m_nodeId: number;
	buildNode(): AvNode;
	createNodeForNode(): AvNode;
	grabInProgress( grabber: EndpointAddr ): void;
}


export abstract class AvBaseNode<TProps, TState> extends React.Component<TProps, TState> 
	implements IAvBaseNode
{
	public m_nodeId: number;
	private m_firstUpdate = true;

	constructor( props: any )
	{
		super( props );
	}

	public abstract buildNode( ): AvNode;

	public grabInProgress( grabber: EndpointAddr ):void
	{
		// nothing to do here, but some node types will need to do work
	}

	public createNodeForNode(): AvNode
	{
		if( this.m_firstUpdate )
		{
			this.m_firstUpdate = false;

			if( this.baseProps && this.baseProps.onIdAssigned )
			{
				this.baseProps.onIdAssigned( this.endpointAddr() );
			}
	
		}

		return this.buildNode();
	}


	public componentWillMount()
	{
		AvGadget.instance().register( this );

		let anyProps = this.props as any;
		if( anyProps.onIdAssigned )
		{
			anyProps.onIdAssigned( this.endpointAddr() );
		}
	}

	public componentWillUnmount()
	{
		AvGadget.instance().unregister( this );
		this.m_firstUpdate = true;
	}

	protected createNodeObject( type: AvNodeType, nodeId: number ): AvNode
	{
		//console.log( `creating ${ AvNodeType[ type] } ${ nodeId }` );
		let obj:AvNode =
		{
			type: type,
			id: nodeId,
			flags: this.getNodeFlags(),
		};

		if( this.baseProps.persistentName )
		{
			obj.persistentName = this.baseProps.persistentName;
		}

		return obj;
	}

	private get baseProps()
	{
		return this.props as AvBaseNodeProps;
	}

	public isVisible(): boolean
	{
		if( !this.baseProps || this.baseProps.visible == undefined )
			return true;

		return this.baseProps.visible;
	}

	protected getNodeFlags(): ENodeFlags
	{
		let flags:ENodeFlags = 0;
		if( this.isVisible() )
		{
			flags |= ENodeFlags.Visible;
		}

		return flags;
	}


	public baseNodeRender( node: IAvBaseNode, children: React.ReactNode )
	{
		return (
			<av-node key={this.m_nodeId} nodeId={ this.m_nodeId }>
				{ children }
			</av-node>
		) ;
	}

	public componentDidUpdate()
	{
		AvGadget.instance().markDirty();
	}

	public endpointAddr(): EndpointAddr
	{
		return {
			type: EndpointType.Node,
			endpointId: AvGadget.instance().getEndpointId(),
			nodeId: this.m_nodeId,
		}
	}

	public render()
	{
		return this.baseNodeRender( this, this.props.children );
	}
	
}


