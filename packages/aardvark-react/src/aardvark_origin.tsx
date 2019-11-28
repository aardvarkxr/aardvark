import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvNodeType } from '@aardvarkxr/aardvark-shared';

interface AvOriginProps extends AvBaseNodeProps
{
	/** The path to reparent any children to. 
	 * 
	 * Reasonable values are:
	 * * /user/head
	 * * /user/hand/right
	 * * /user/hand/left
	 */
	path: string;
}

/** Reparents the root transforms of its children to the specified path. */
export class AvOrigin extends AvBaseNode< AvOriginProps, {} >
{
	public buildNode()
	{
		let node = this.createNodeObject( AvNodeType.Origin, this.m_nodeId );
		node.propOrigin = this.props.path;
		return node;
	}
}