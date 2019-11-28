import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvNodeType, AvColor, EndpointAddr } from '@aardvarkxr/aardvark-shared';

interface AvPanelIntersectionProps extends AvBaseNodeProps
{
	/** The endpoint address of the panel that this node's parent
	 * should be intersected with. The transform of the 
	 * AvPokerPanelIntersection node will be the closest point on the
	 * panel to the parent's transform.
	 */
	panelId: EndpointAddr;
}


/** Causes a line to appear from the transform of this node's parent to the 
 * specified end point. */
export class AvPanelIntersection extends AvBaseNode< AvPanelIntersectionProps, {} >
{
	public buildNode()
	{
		let node = this.createNodeObject( AvNodeType.PanelIntersection, this.m_nodeId );
		node.propEndAddr = this.props.panelId;
		return node;
	}
}

