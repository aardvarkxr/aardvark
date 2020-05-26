import { AvColor, AvNode, AvNodeType, AvSharedTextureInfo, ENodeFlags } from '@aardvarkxr/aardvark-shared';
import Color from 'color';

let g_nextNodeId = 0;

function buildNode( type: AvNodeType )
{
	let node: AvNode =
	{
		type,
		flags: ENodeFlags.Visible,
		id: g_nextNodeId++,
	}
	return node;
}

export function addChild( parent: AvNode, child: AvNode )
{
	if( !parent.children )
	{ 
		parent.children = [];
	}

	parent.children.push( child );
}
export function buildOrigin( originPath:string )
{
	let n = buildNode( AvNodeType.Origin );
	n.propOrigin = originPath;
	return n;
}

export function buildModel( modelUri:string, color?: string | AvColor, textureInfo?:AvSharedTextureInfo )
{
	let n = buildNode( AvNodeType.Model );
	n.propModelUri = modelUri;
	n.propSharedTexture = textureInfo;

	if( typeof color === "string" )
	{
		let tmpColor = Color( color );
		n.propColor = 
		{
			r: tmpColor.red() / 255,
			g: tmpColor.green() / 255,
			b: tmpColor.blue() / 255,
		};
	}
	else
	{
		n.propColor = color;
	}

	return n;
}