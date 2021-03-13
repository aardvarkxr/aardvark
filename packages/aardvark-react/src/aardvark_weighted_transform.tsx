import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvNodeType, WeightedParent } from '@aardvarkxr/aardvark-shared';

/** Props for {@link AvWeightedTransform} */
export interface AvWeightedTransformProps extends AvBaseNodeProps
{
	/** The list of parent nodes to transform relative to, with weights. 
	 * The weights in this list will be normalized, so the contribution of
	 * each parent transform will be weight/sum(all_weights).
	 */
	weightedParents: WeightedParent[];
}


/** Allows a transform to be automatically computed each frame as the average of some number
 * of other nodes' transforms. This is useful for smooth updates when one or more of the 
 * transforms is actively moving around.
 */
export class AvWeightedTransform extends AvBaseNode< AvWeightedTransformProps, {} >
{
	public buildNode()
	{
		let node = this.createNodeObject( AvNodeType.WeightedTransform, this.m_nodeId );
		node.propWeightedParents = this.props.weightedParents;
		return node;
	}
}

