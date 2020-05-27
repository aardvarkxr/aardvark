import { AvColor, AvNode, AvNodeType, AvSharedTextureInfo, ENodeFlags } from '@aardvarkxr/aardvark-shared';
import * as Color from 'color';
import { vec3 } from '@tlaukkan/tsm';

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

	return child;
}

export function buildOrigin( originPath:string )
{
	let n = buildNode( AvNodeType.Origin );
	n.propOrigin = originPath;
	return n;
}

export function colorFromString( color?: string | AvColor ): AvColor
{
	if( typeof color === "string" )
	{
		let tmpColor = Color( color );
		return(
		{
			r: tmpColor.red() / 255,
			g: tmpColor.green() / 255,
			b: tmpColor.blue() / 255,
		} );
	}
	else
	{
		return color;
	}
}

export function buildModel( modelUri:string, color?: string | AvColor, textureInfo?:AvSharedTextureInfo )
{
	let n = buildNode( AvNodeType.Model );
	n.propModelUri = modelUri;
	n.propSharedTexture = textureInfo;
	n.propColor = colorFromString( color );

	return n;
}

export function buildTransform( translation?: vec3 )
{
	let n = buildNode( AvNodeType.Transform );

	n.propTransform =
	{
		position: 
		{ 
			x: translation?.x ?? 0, 
			y: translation?.y ?? 0, 
			z: translation?.z ?? 0 
		}
	}

	return n;
}