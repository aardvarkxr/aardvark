import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvNodeType, EndpointAddr } from '@aardvarkxr/aardvark-shared';

/** Props for {@link AvParentTransform} */
export interface AvParentTransformProps extends AvBaseNodeProps
{
	/** The endpoint address of the node that should be the parent of this 
	 * node.
	 */
	parentId: EndpointAddr;
}


/** Causes a line to appear from the transform of this node's parent to the 
 * specified end point. */
export class AvParentTransform extends AvBaseNode< AvParentTransformProps, {} >
{
	public buildNode()
	{
		let node = this.createNodeObject( AvNodeType.ParentTransform, this.m_nodeId );
		node.propParentAddr = this.props.parentId;
		return node;
	}
}

