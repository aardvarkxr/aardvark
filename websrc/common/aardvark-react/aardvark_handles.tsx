import * as React from 'react';

import { AvSceneContext, AvNodeType } from 'common/aardvark';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';

interface AvSphereHandleProps extends AvBaseNodeProps
{
	radius: number;
}

export class AvSphereHandle extends AvBaseNode< AvSphereHandleProps, {} > 
{
	public startNode( context:AvSceneContext )
	{
		context.startNode( this.m_nodeId, "sphere" + this.m_nodeId, AvNodeType.Handle );
		context.setSphereVolume( this.props.radius );
	}
}