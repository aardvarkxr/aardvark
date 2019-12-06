import * as React from 'react';

import { AvNodeType } from '@aardvarkxr/aardvark-shared';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';

/** Sets the transform of its children to the center of the panel anchor's DOM node
 * in its parent AvPanel. This is useful for drawing models and other nodes in a 
 * reasonable position relative to text on a panel.
 */
export class AvPanelAnchor extends AvBaseNode< AvBaseNodeProps, {} > 
{
	private m_ref = React.createRef<HTMLDivElement>();

	public buildNode()
	{
		let node = this.createNodeObject( AvNodeType.Transform, this.m_nodeId );

		if( this.m_ref.current )
		{
			let domRect = this.m_ref.current.getBoundingClientRect();
			if( domRect )
			{
				let x = ( ( domRect.left + domRect.right ) / ( 2 * window.innerWidth ) ) - 0.5;
				let z = ( ( domRect.top + domRect.bottom ) / ( 2 * window.innerHeight ) ) - 0.5;

				node.propTransform = {};
				node.propTransform.position =
				{
					x,
					y: 0,
					z,
				};
			}
		}

		return node;
	}

	public render()
	{
		return <div ref={ this.m_ref } style={ { height: "100%", width: "100%" }}>
			{ this.baseNodeRender( this, this.props.children ) }
		</div>;
	}
}