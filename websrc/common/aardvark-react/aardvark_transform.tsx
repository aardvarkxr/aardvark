import * as React from 'react';

import { AvNodeType } from 'common/aardvark';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';

interface AvTransformProps extends AvBaseNodeProps
{
	uniformScale?:number;
	scaleX?:number;
	scaleY?:number;
	scaleZ?:number;
	translateX?:number;
	translateY?:number;
	translateZ?:number;
	rotateX?:number;
	rotateY?:number;
	rotateZ?:number;
}

export class AvTransform extends AvBaseNode< AvTransformProps, {} > 
{
	public buildNode()
	{
		let node = this.createNodeObject( AvNodeType.Transform, this.m_nodeId );

		node.propTransform = {};
		if( this.props.uniformScale != null )
		{
			node.propTransform.scale = 
			{ 
				x: this.props.uniformScale, 
				y: this.props.uniformScale, 
				z: this.props.uniformScale, 
			};
		}
		else if( this.props.scaleX != null || this.props.scaleY != null || this.props.scaleZ != null )
		{
			node.propTransform.scale = 
			{ 
				x: this.props.scaleX != null ? this.props.scaleX : 1,
				y: this.props.scaleY != null ? this.props.scaleY : 1,
				z: this.props.scaleZ != null ? this.props.scaleZ : 1,
			};
		}

		if( this.props.translateX != null || this.props.translateY != null || this.props.translateZ != null )
		{
			node.propTransform.position =
			{
				x: this.props.translateX != null ? this.props.translateX : 0,
				y: this.props.translateY != null ? this.props.translateY : 0,
				z: this.props.translateZ != null ? this.props.translateZ : 0,
			}
		}
		if( this.props.rotateX != null || this.props.rotateX != null || this.props.rotateX != null )
		{
			// TODO: port quaterion conversion to typescript
			node.propTransform.rotation =
			{
				w: 0,
				x: this.props.translateX != null ? this.props.rotateX : 0,
				y: this.props.translateY != null ? this.props.rotateY : 0,
				z: this.props.translateZ != null ? this.props.rotateZ : 0,
			}
		}

		return node;
	}
}