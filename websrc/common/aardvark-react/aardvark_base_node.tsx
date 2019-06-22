import * as React from 'react';

import { Av, AvSceneContext } from 'common/aardvark';
import { AvApp } from './aardvark_app';

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

export interface IAvBaseNode
{
	m_nodeId: number;
	pushNode( context: AvSceneContext ): void;
}


export abstract class AvBaseNode<TProps, TState> extends React.Component<TProps, TState> implements IAvBaseNode
{
	public m_nodeId: number;

	constructor( props: any )
	{
		super( props );
		AvApp.instance().register( this );
	}

	public pushNode( context: AvSceneContext ): void
	{
		this.startNode( context );
	}

	abstract startNode( context: AvSceneContext ): void;
	
	public baseNodeRender( node: IAvBaseNode, children: React.ReactNode )
	{
		return (
			<av-node nodeId={ this.m_nodeId }>
				{ children }
			</av-node>
		) ;
	}

	public componentDidUpdate()
	{
		AvApp.instance().markDirty();
	}
	
	public render()
	{
		return this.baseNodeRender( this, this.props.children );
	}
	
}


