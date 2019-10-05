import * as Color from 'color';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvNodeType, AvColor } from 'common/aardvark';

interface AvModelProps extends AvBaseNodeProps
{
	uri: string;
	color?: AvColor | string;
}

export class AvModel extends AvBaseNode< AvModelProps, {} >
{
	public buildNode()
	{
		let node = this.createNodeObject( AvNodeType.Model, this.m_nodeId );
		node.propModelUri = this.props.uri;
		let color: AvColor;
		if( typeof this.props.color === "string" )
		{
			let tmpColor = Color( this.props.color );
			color = 
			{
				r: tmpColor.red() / 255,
				g: tmpColor.green() / 255,
				b: tmpColor.blue() / 255,
			};
		}
		else
		{
			color = this.props.color
		}
		node.propColor = color;
		return node;
	}
}