import { EVolumeType, EVolumeContext, AvNodeTransform } from '@aardvarkxr/aardvark-shared';
import { mat4, vec3 } from '@tlaukkan/tsm';
import { scaleMat, translateMat, nodeTransformToMat4, nodeTransformFromMat4 } from '@aardvarkxr/aardvark-react';
import { TransformedVolume } from './volume_intersection';

export function makeSphere( radius: number, position?: vec3, scale?: number, context?: EVolumeContext )
{
	let nodeFromVolume: AvNodeTransform =
	{
		position: position ? { x: position.x, y: position.y, z: position.z } : undefined,
		scale: scale ? { x: scale, y: scale, z: scale } : undefined,
	};

	return (
		{
			type: EVolumeType.Sphere,
			context,
			radius,
			nodeFromVolume: nodeFromVolume,
			universeFromVolume: nodeTransformToMat4( nodeFromVolume ),
		} as TransformedVolume );
}

export function makeBox( ranges: [number, number, number, number, number, number], universeFromVolume?: mat4, context?: EVolumeContext )
{
	let nodeFromVolume = nodeTransformFromMat4( universeFromVolume );
	return (
		{
			type: EVolumeType.AABB,
			context,
			aabb: {
				xMin: ranges[0],
				xMax: ranges[1],
				yMin: ranges[2],
				yMax: ranges[3],
				zMin: ranges[4],
				zMax: ranges[5],
			},
			nodeFromVolume,
			universeFromVolume: nodeTransformToMat4( nodeFromVolume ),
		} as TransformedVolume );
}

export function makeInfinite()
{
	return (
		{
			type: EVolumeType.Infinite,
			universeFromVolume: mat4.identity,
		} as TransformedVolume );
}

export function makeEmpty()
{
	return (
		{
			type: EVolumeType.Empty,
			universeFromVolume: mat4.identity,
		} as TransformedVolume );
}
