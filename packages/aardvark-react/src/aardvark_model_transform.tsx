import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvNodeType } from '@aardvarkxr/aardvark-shared';

/** Props for {@link AvParentTransform} */
export interface AvModelTransformProps extends AvBaseNodeProps
{
	/** The URL of the model to load to figure out a transform from. */
	modelUri: string;

	/** The ID of the node in the model whose transform should be applied to all 
	 * children of this node.
	 */
	modelNodeId: string;
}


/** Causes a line to appear from the transform of this node's parent to the 
 * specified end point. */
export class AvModelTransform extends AvBaseNode< AvModelTransformProps, {} >
{
	public buildNode()
	{
		let node = this.createNodeObject( AvNodeType.ModelTransform, this.m_nodeId );
		node.propModelUri = this.props.modelUri;
		node.propModelNodeId = this.props.modelNodeId;
		return node;
	}
}

