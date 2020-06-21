import { EVolumeType, EVolumeContext, AvNodeTransform, scaleMat, translateMat, nodeTransformToMat4, nodeTransformFromMat4  } from '@aardvarkxr/aardvark-shared';
import { mat4, vec3 } from '@tlaukkan/tsm';
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

export function makeBox( ranges: [number, number, number, number, number, number], 
	universeFromVolume?: mat4, context?: EVolumeContext )
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

export function makeRay( start: vec3, dir: vec3,
	context?: EVolumeContext )
{
	let nodeFromVolume: mat4;

	let back: vec3;
	if( vec3.dot( vec3.up, dir ) > 0.999 )
	{
		back = vec3.forward;
	}
	else
	{
		back = vec3.cross( dir, vec3.up );
	}

	let up = vec3.cross( back, dir );

	nodeFromVolume = new mat4([
		dir.x,
		dir.y,
		dir.z,
		0,

		up.x,
		up.y,
		up.z,
		0,

		back.x,
		back.y,
		back.z,
		0,

		start.x, start.y, start.z, 1,
	] );

	return (
		{
			type: EVolumeType.Ray,
			nodeFromVolume: nodeTransformFromMat4( nodeFromVolume ),
			universeFromVolume: nodeFromVolume,
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
