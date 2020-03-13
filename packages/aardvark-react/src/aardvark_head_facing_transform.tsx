import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvNodeType, AvColor, EndpointAddr } from '@aardvarkxr/aardvark-shared';

interface AvHeadFacingTransformProps extends AvBaseNodeProps
{
}


/** The transform of this node is the translation of its parent, no scale, and a rotation that causes
 * the positive Z axis to point at /user/head and the positive Y axis to point generally up.
*/
export class AvHeadFacingTransform extends AvBaseNode< AvHeadFacingTransformProps, {} >
{
	public buildNode()
	{
		let node = this.createNodeObject( AvNodeType.HeadFacingTransform, this.m_nodeId );
		return node;
	}
}

