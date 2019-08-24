import * as React from 'react';

import { AvNode, AvNodeType } from 'common/aardvark';
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
	onIdAssigned?: ( addr: EndpointAddr ) => void;
}

export interface IAvBaseNode
{
	m_nodeId: number;
	buildNode(): AvNode;
	createNodeForNode(): AvNode;
}


export abstract class AvBaseNode<TProps, TState> extends React.Component<TProps, TState> implements IAvBaseNode
{
	public m_nodeId: number;
	private m_firstUpdate = true;

	constructor( props: any )
	{
		super( props );
	}

	public abstract buildNode( ): AvNode;

	public createNodeForNode(): AvNode
	{
		if( this.m_firstUpdate )
		{
			this.m_firstUpdate = false;

			let baseProps = this.props as AvBaseNodeProps;
			if( baseProps && baseProps.onIdAssigned )
			{
				baseProps.onIdAssigned( this.endpointAddr() );
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
		return (
		{
			type: type,
			id: nodeId,
			flags: 0,
		} );
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


