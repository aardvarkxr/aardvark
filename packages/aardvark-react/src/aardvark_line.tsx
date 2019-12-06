import * as Color from 'color';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvNodeType, AvColor, EndpointAddr } from '@aardvarkxr/aardvark-shared';
import { AvGadget } from './aardvark_gadget';

interface AvLineProps extends AvBaseNodeProps
{
	/** The color tint to apply to this model when it is
	 * displayed.
	 * 
	 * @default white
	 */
	color?: AvColor | string;

	/** The thickness of the line in meters.
	 * 
	 * @default 0.003
	 */
	thickness?: number;

	/** ID or address of the end point of this segment. 
	*/
	endId: string | EndpointAddr;

	/** Distance in meters to leave as a gap between the
	 * start point and the start of the actual line.
	 * 
	 * @default 0
	 */
	startGap?: number;

	/** Distance in meters to leave as a gap between the
	 * end point and the start of the actual line.
	 * 
	 * @default 0
	 */
	endGap?: number;
}


/** Causes a line to appear from the transform of this node's parent to the 
 * specified end point. */
export class AvLine extends AvBaseNode< AvLineProps, {} >
{
	public buildNode()
	{
		let node = this.createNodeObject( AvNodeType.Line, this.m_nodeId );
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
		if( typeof this.props.endId === "string" )
		{
			node.propEndAddr = AvGadget.instance().getEndpointAddressForId( this.props.endId );
		}
		else
		{
			node.propEndAddr = this.props.endId;
		}
		node.propThickness = this.props.thickness;
		node.propStartGap = this.props.startGap;
		node.propEndGap = this.props.endGap;

		return node;
	}
}

