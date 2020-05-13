import bind from 'bind-decorator';
import * as Color from 'color';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvNodeType, AvColor, AvVector, AvSharedTextureInfo, Av } from '@aardvarkxr/aardvark-shared';
import { AvGadget } from './aardvark_gadget';

interface AvModelProps extends AvBaseNodeProps
{
	/** The URI of the GLTF model to use for this model. */
	uri: string;

	/** The color tint to apply to this model when it is
	 * displayed.
	 * 
	 * @default no tint
	 */
	color?: AvColor | string;

	/** Causes the model to be uniformly scaled up or down so
	 * that its bounding box touches at least one of the -x, +x,
	 * -y, +y, -z, or +z planes. Any axis that is 0 or unspecified
	 * will not be considered when computing the scale for the model.
	 * 
	 * This scaling happens inside any transforms on parent nodes.
	 * 
	 * @default No scaling
	 */
	scaleToFit?: AvVector;

	/** Tells Aardvark to use the texture of this gadget's browser to 
	 * replace the texture supplied by the model itself.
	 * 
	 * @default false
	 */
	useBrowserTexture?: boolean;
}

/** Causes a GLTF model to be drawn at the specified location in the transform hierarchy. */
export class AvModel extends AvBaseNode< AvModelProps, {} >
{
	private m_sharedTextureInfo: AvSharedTextureInfo = null;

	constructor( props: any )
	{
		super( props );

		if( this.props.useBrowserTexture )
		{
			Av().subscribeToBrowserTexture( this.onUpdateBrowserTexture );
		}
	}

	@bind 
	private onUpdateBrowserTexture( info: AvSharedTextureInfo )
	{
		this.m_sharedTextureInfo = info;
		AvGadget.instance().markDirty();
	}

	public buildNode()
	{
		let node = this.createNodeObject( AvNodeType.Model, this.m_nodeId );
		
		node.propModelUri = this.props.uri;
		node.propScaleToFit = this.props.scaleToFit;

		let color: AvColor;
		if( typeof this.props.color === "string" )
		{
			let tmpColor = Color( this.props.color );
			color = 
			{
				r: tmpColor.red() / 255,
				g: tmpColor.green() / 255,
				b: tmpColor.blue() / 255,
			};
		}
		else
		{
			color = this.props.color
		}
		node.propColor = color;

		if( this.props.useBrowserTexture )
		{
			node.propSharedTexture = this.m_sharedTextureInfo;
		}

		return node;
	}
}