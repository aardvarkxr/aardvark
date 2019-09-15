import * as React from 'react';

import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvNodeType, AvColor } from 'common/aardvark';

interface AvModelProps extends AvBaseNodeProps
{
	uri: string;
	color?: AvColor;
}

export class AvModel extends AvBaseNode< AvModelProps, {} >
{
	public buildNode()
	{
		let node = this.createNodeObject( AvNodeType.Model, this.m_nodeId );
		node.propModelUri = this.props.uri;
		node.propColor = this.props.color;
		return node;
	}
}