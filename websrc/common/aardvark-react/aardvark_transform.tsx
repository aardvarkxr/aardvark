import * as React from 'react';

import { AvSceneContext, AvNodeType } from 'common/aardvark';
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
	public startNode( context:AvSceneContext )
	{
		context.startNode( this.m_nodeId, "transform" + this.m_nodeId, AvNodeType.Transform );
		if( this.props.uniformScale != null )
		{
			context.setUniformScale( this.props.uniformScale );
		}

		if( this.props.scaleX != null || this.props.scaleY != null || this.props.scaleZ != null )
		{
			let x = this.props.scaleX != null ? this.props.scaleX : 1;
			let y = this.props.scaleY != null ? this.props.scaleY : 1;
			let z = this.props.scaleZ != null ? this.props.scaleZ : 1;
			context.setScale( x, y, z );
		}

		if( this.props.translateX != null || this.props.translateY != null || this.props.translateZ != null )
		{
			let x = this.props.translateX != null ? this.props.translateX : 0;
			let y = this.props.translateY != null ? this.props.translateY : 0;
			let z = this.props.translateZ != null ? this.props.translateZ : 0;
			context.setTranslation( x, y, z );
		}

		if( this.props.translateX != null || this.props.translateY != null || this.props.translateZ != null )
		{
			let x = this.props.rotateX != null ? this.props.rotateX : 0;
			let y = this.props.rotateY != null ? this.props.rotateY : 0;
			let z = this.props.rotateZ != null ? this.props.rotateZ : 0;
			context.setRotationEulerDegrees( x, y, z );
		}
	}
}