import * as Color from 'color';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvNodeType, AvColor } from '@aardvarkxr/aardvark-shared';

interface AvModelProps extends AvBaseNodeProps
{
	/** The URI of the GLTF model to use for this model. */
	uri: string;

	/** The color tint to apply to this model when it is
	 * displayed.
	 * 
	 * @default no tint
	 */
	color?: AvColor | string;
}

/** Causes a GLTF model to be drawn at the specified location in the transform hierarchy. */
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