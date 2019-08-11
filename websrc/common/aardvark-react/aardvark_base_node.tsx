import * as React from 'react';

import { Av, AvSceneContext, AvNode, AvNodeType } from 'common/aardvark';
import { AvGadget } from './aardvark_gadget';

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
	onIdAssigned?: ( id: number ) => void;
}

export interface IAvBaseNode
{
	m_nodeId: number;
	buildNode(): AvNode;
}


export abstract class AvBaseNode<TProps, TState> extends React.Component<TProps, TState> implements IAvBaseNode
{
	public m_nodeId: number;

	constructor( props: any )
	{
		super( props );
		AvGadget.instance().register( this );

		if( props.onIdAssigned )
		{
			props.onIdAssigned( this.m_nodeId );
		}
	}

	public abstract buildNode( ): AvNode;

	protected createNodeObject( nodeId: number, type: AvNodeType ): AvNode
	{
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

	public render()
	{
		return this.baseNodeRender( this, this.props.children );
	}
	
}


