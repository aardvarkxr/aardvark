import * as React from 'react';

import { AvSceneContext, AvNodeType, EVolumeType } from 'common/aardvark';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';

interface AvSphereHandleProps extends AvBaseNodeProps
{
	radius: number;
}

export class AvSphereHandle extends AvBaseNode< AvSphereHandleProps, {} > 
{
	public buildNode()
	{
		let node = this.createNodeObject( AvNodeType.Handle, this.m_nodeId );
		node.propVolume = { type: EVolumeType.Sphere, radius : this.props.radius };
		return node;
	}
}