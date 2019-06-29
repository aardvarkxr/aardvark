import * as React from 'react';

import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvSceneContext, AvNodeType } from 'common/aardvark';

interface AvModelProps extends AvBaseNodeProps
{
	uri: string;
}

export class AvModel extends AvBaseNode< AvModelProps, {} >
{
	public startNode( context:AvSceneContext )
	{
		context.startNode( this.m_nodeId, "model" + this.m_nodeId, AvNodeType.Model );
		context.setModelUri( this.props.uri );
	}
}