import { EVolumeType } from '@aardvarkxr/aardvark-shared';
import { mat4, vec3 } from '@tlaukkan/tsm';
import { scaleMat, translateMat } from './traverser_utils';
import { TransformedVolume } from './volume_intersection';

export function makeSphere( radius: number, position?: vec3, scale?: number )
{
	let mscale = scale ? scaleMat( new vec3( [ scale, scale, scale ] ) ) : mat4.identity;
	let mtranslate = position ? translateMat( position ) : mat4.identity;
	return (
		{
			type: EVolumeType.Sphere,
			radius,
			universeFromVolume: mat4.product( mtranslate, mscale, new mat4() ),
		} as TransformedVolume );
}

export function makeBox( ranges: [number, number, number, number, number, number], universeFromVolume?: mat4 )
{
	return (
		{
			type: EVolumeType.AABB,
			aabb: {
				xMin: ranges[0],
				xMax: ranges[1],
				yMin: ranges[2],
				yMax: ranges[3],
				zMin: ranges[4],
				zMax: ranges[5],
			},
			universeFromVolume: universeFromVolume ?? mat4.identity,
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
