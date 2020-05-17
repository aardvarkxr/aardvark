import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvNodeType, EndpointAddr } from '@aardvarkxr/aardvark-shared';

interface AvEntityChildProps extends AvBaseNodeProps
{
	/** The address of the child node for which this is providing
	 * the transform.
	 */
	child: EndpointAddr;
}

/** Provides the transform for an interface entity somewhere else in the scene graph of this 
 * or some other gadget. This parent/child relationship must be established via interface 
 * events, and both sides need to agree on which interface entity is providing the parent
 * transform of which other interface entity.
 * 
 * This node must be a child of an AvInterfaceEntity node, and the node it represents the
 * position for must specify the global ID of that interface entity as its parent.
 */
export class AvEntityChild extends AvBaseNode< AvEntityChildProps, {} >
{
	public buildNode()
	{
		let node = this.createNodeObject( AvNodeType.Child, this.m_nodeId );
		node.propChildAddr = this.props.child;
		return node;
	}
}