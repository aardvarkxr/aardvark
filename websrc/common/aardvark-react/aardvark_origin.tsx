import * as React from 'react';

import { AvBaseNode } from './aardvark_base_node';
import { AvSceneContext, AvNodeType } from 'common/aardvark';

interface AvOriginProps
{
	path: string;
}

export class AvOrigin extends AvBaseNode< AvOriginProps, {} >
{
	public startNode( context:AvSceneContext )
	{
		context.startNode( this.m_nodeId, "origin" + this.m_nodeId, AvNodeType.Origin );
		context.setOriginPath( this.props.path );
	}
}