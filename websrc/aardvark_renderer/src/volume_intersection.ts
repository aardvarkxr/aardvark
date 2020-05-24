import { mat4, vec4, vec3 } from '@tlaukkan/tsm';
import { AvVolume, EVolumeType, EVolumeContext } from '@aardvarkxr/aardvark-shared';

export interface TransformedVolume extends AvVolume
{
	universeFromVolume: mat4;
}

function spheresIntersect( v1: TransformedVolume, v2: TransformedVolume )
{
	let v1Center = v1.universeFromVolume.multiplyVec4( new vec4( [ 0, 0, 0, 1 ] ) );
	let v2Center = v2.universeFromVolume.multiplyVec4( new vec4( [ 0, 0, 0, 1 ] ) );

	let v1ScaledRadius = v1.universeFromVolume.multiplyVec4( new vec4( [ 1, 0, 0, 0 ] ) )
		.length() * v1.radius;
	let v2ScaledRadius = v2.universeFromVolume.multiplyVec4( new vec4( [ 1, 0, 0, 0 ] ) )
		.length() * v2.radius;

	let dist = vec3.distance( new vec3( v1Center.xyz ), new vec3( v2Center.xyz ) );
	//console.log( v1ScaledRadius, v2ScaledRadius, dist );
	return dist < ( v1ScaledRadius + v2ScaledRadius );
}

function sphereBoxIntersect( sphere: TransformedVolume, box: TransformedVolume )
{
	if( !box.aabb )
	{
		return false;
	}
	
	let boxFromUniverse = box.universeFromVolume.copy( new mat4() ).inverse();
	let boxFromSphere = mat4.product( boxFromUniverse, sphere.universeFromVolume, new mat4() );
	let sphereCenter = boxFromSphere.multiplyVec4( new vec4( [ 0, 0, 0, 1 ] ) );
	let sphereScaledRadius = boxFromSphere.multiplyVec4( new vec4( [ 1, 0, 0, 0 ] ) )
		.length() * sphere.radius;

	let xDist = Math.max( Math.max( box.aabb.xMin - sphereCenter.x, sphereCenter.x - box.aabb.xMax ), 0 );
	let yDist = Math.max( Math.max( box.aabb.yMin - sphereCenter.y, sphereCenter.y - box.aabb.yMax ), 0 );
	let zDist = Math.max( Math.max( box.aabb.zMin - sphereCenter.z, sphereCenter.z - box.aabb.zMax ), 0 );
	//console.log( xDist, yDist, zDist, sphereScaledRadius, sphereCenter, box.aabb );

	// TODO: This is wrong in the face of non-uniform scale of the box. I think each axis needs
	// to be compared indendently in that case.
	return ( xDist * xDist + yDist * yDist + zDist * zDist ) <= ( sphereScaledRadius * sphereScaledRadius );
}


function boxBoxIntersect( box1: TransformedVolume, box2: TransformedVolume )
{
	if( !box1.aabb || !box2.aabb )
	{
		return false;
	}

	// TODO: For now do the rough "turn one box into an AABB in the other's space" approach.
	// Eventually this should do the actual unaligned box intersection
	let box1FromUniverse = box1.universeFromVolume.copy( new mat4() ).inverse();
	let box1FromBox2 = mat4.product( box1FromUniverse, box2.universeFromVolume, new mat4() );
	let box2Points =
	[
		new vec4( [ box2.aabb.xMin, box2.aabb.yMin, box2.aabb.zMin, 1 ] ),
		new vec4( [ box2.aabb.xMin, box2.aabb.yMin, box2.aabb.zMax, 1 ] ),
		new vec4( [ box2.aabb.xMin, box2.aabb.yMax, box2.aabb.zMin, 1 ] ),
		new vec4( [ box2.aabb.xMin, box2.aabb.yMax, box2.aabb.zMax, 1 ] ),
		new vec4( [ box2.aabb.xMax, box2.aabb.yMin, box2.aabb.zMin, 1 ] ),
		new vec4( [ box2.aabb.xMax, box2.aabb.yMin, box2.aabb.zMax, 1 ] ),
		new vec4( [ box2.aabb.xMax, box2.aabb.yMax, box2.aabb.zMin, 1 ] ),
		new vec4( [ box2.aabb.xMax, box2.aabb.yMax, box2.aabb.zMax, 1 ] ),
	];

	let xMin: number;
	let xMax: number;
	let yMin: number;
	let yMax: number;
	let zMin: number;
	let zMax: number;
	for( let point of box2Points )
	{
		let pointInBox1 = box1FromBox2.multiplyVec4( point );
		xMin = Math.min( pointInBox1.x, xMin ?? pointInBox1.x );
		xMax = Math.max( pointInBox1.x, xMax ?? pointInBox1.x );
		yMin = Math.min( pointInBox1.y, yMin ?? pointInBox1.y );
		yMax = Math.max( pointInBox1.y, yMax ?? pointInBox1.y );
		zMin = Math.min( pointInBox1.z, zMin ?? pointInBox1.z );
		zMax = Math.max( pointInBox1.z, zMax ?? pointInBox1.z );
	};

	//console.log( xMin, xMax, yMin, yMax, zMin, zMax, box1.aabb );
	return !( xMax < box1.aabb.xMin || xMin > box1.aabb.xMax ||
		yMax < box1.aabb.yMin || yMin > box1.aabb.yMax ||
		zMax < box1.aabb.zMin || zMin > box1.aabb.zMax );
}

function volumeMatchesContext( v: TransformedVolume, context: EVolumeContext )
{
	let volumeContext = v.context ?? EVolumeContext.Always;
	return context == EVolumeContext.Always || volumeContext == EVolumeContext.Always
		|| context == volumeContext;
}

export function volumesIntersect( v1: TransformedVolume, v2: TransformedVolume, context: EVolumeContext )
{
	if( !volumeMatchesContext( v1, context ) || !volumeMatchesContext( v2, context ) )
	{
		return false;
	}

	if( v1.type == EVolumeType.Empty || v2.type == EVolumeType.Empty )
	{
		// empty volumes don't intersect with anything, including infinite volumes
		return false;
	}
	if( v1.type == EVolumeType.Infinite || v2.type == EVolumeType.Infinite )
	{
		return true;
	}
	else if( v1.type == EVolumeType.Sphere && v2.type == EVolumeType.Sphere )
	{
		return spheresIntersect( v1, v2 );
	}
	else if( v1.type == EVolumeType.Sphere && v2.type == EVolumeType.AABB )
	{
		return sphereBoxIntersect( v1, v2 );
	}
	else if( v1.type == EVolumeType.AABB && v2.type == EVolumeType.Sphere )
	{
		return sphereBoxIntersect( v2, v1 );
	}
	else if( v1.type == EVolumeType.AABB && v2.type == EVolumeType.AABB )
	{
		return boxBoxIntersect( v1, v2 );
	}
	else
	{
		// what other kind is there?
		return false;
	}
}
