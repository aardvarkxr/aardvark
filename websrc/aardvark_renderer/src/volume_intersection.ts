import { mat4, vec4, vec3, vec2 } from '@tlaukkan/tsm';
import { AvVolume, EVolumeType, EVolumeContext } from '@aardvarkxr/aardvark-shared';
const createRay = require( 'ray-aabb' );

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


function sphereRayIntersect( s: TransformedVolume, r: TransformedVolume )
{
	let rayFromUniverse = new mat4( r.universeFromVolume.all() ).inverse();
	let rayFromSphere = mat4.product( rayFromUniverse, s.universeFromVolume, new mat4() );
	let center = new vec3( rayFromSphere.multiplyVec4( new vec4( [ 0, 0, 0, 1 ] ),
		new vec4() ).xyz );
	let negCenter = new vec3( [ -center.x, -center.y, -center.z ] );


	let a = 1; // vec3.right dotted with itself
	let b = 2 * vec3.dot( vec3.right, negCenter );
	let c = vec3.dot( negCenter, negCenter ) - s.radius * s.radius;

	let dis = Math.sqrt( b * b - 4 * a * c );
	return dis >= 0;
}


function boxRayIntersect( b: TransformedVolume, r: TransformedVolume )
{
	let boxFromUniverse = new mat4( b.universeFromVolume.all() ).inverse();
	let boxFromRay = mat4.product( boxFromUniverse, r.universeFromVolume, new mat4() );
	let start = new vec3( boxFromRay.multiplyVec4( new vec4( [ 0, 0, 0, 1 ] ) ).xyz );
	let dir = new vec3( boxFromRay.multiplyVec4( new vec4( [ 1, 0, 0, 0 ] ) ).xyz );

	let ray = createRay( start.xyz, dir.xyz );
	return ray.intersects( [ [ b.aabb.xMin, b.aabb.yMin, b.aabb.zMin ],
		[ b.aabb.xMax, b.aabb.yMax, b.aabb.zMax ] ] );
}

export function rayFromMatrix( m: mat4 )
{
	return [ 
		new vec3( m.multiplyVec4( new vec4( [ 0, 0, 0, 1 ] ) ).xyz ),
		new vec3( m.multiplyVec4( new vec4( [ 1, 0, 0, 0 ] ) ).xyz ) 
	];
}


function rayRayIntersect( r0: TransformedVolume, r1: TransformedVolume )
{
	let r0FromUniverse = new mat4( r0.universeFromVolume.all() ).inverse();
	let r0FromR1 = mat4.product( r0FromUniverse, r1.universeFromVolume, new mat4() );

	let [ s1, d1 ] = rayFromMatrix( r0FromR1 );

	if( d1.equals( vec3.right, 0.001 ) )
	{
		// lines are coincident.
		return true;
	}

	let s1_2d = new vec2( s1.xy );
	let d1_2d = new vec2( d1.xy );

	let t1 = -s1_2d.y / d1_2d.y;

	if( t1 < 0 )
	{
		// rays don't intersect in 2d because of r1
		return false;
	}

	let x = s1_2d.x + d1_2d.x * t1;
	if( x < 0 )
	{
		// rays don't intersect in 2d because of r0;
	}

	// now we know our t value and can compute the theoretical point of 
	// intersection for ray 1
	let line = new vec3( [ d1.x * t1, d1.y * t1, d1.z * t1 ] );
	let p1 = vec3.sum( s1, line, new vec3() );
	return p1.x >= 0 && Math.abs( p1.y ) < 0.001 && Math.abs( p1.z ) < 0.001;
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

	let va: TransformedVolume, vb: TransformedVolume;
	if( v1.type < v2.type )
	{
		va = v1;
		vb = v2;
	}
	else
	{
		va = v2;
		vb = v1;
	}

	// we only have to deal with matching with types >= our own now. The order is:
	// Sphere = 0,
	// ModelBox = 1,
	// AABB = 1,
	// Infinite = 3,
	// Empty = 4,
	// Ray = 5, // ray is always down the positive X axis from the origin
	switch( va.type )
	{
		case EVolumeType.Sphere:
			switch( vb.type )
			{
				case EVolumeType.Sphere:
					return spheresIntersect( va, vb );

				case EVolumeType.AABB:
					return sphereBoxIntersect( va, vb );

				case EVolumeType.Ray:
					return sphereRayIntersect( va, vb );
		
				default:
					return false;
			}

		case EVolumeType.AABB:
			switch( vb.type )
			{
				case EVolumeType.AABB:
					return boxBoxIntersect( va, vb );

				case EVolumeType.Ray:
					return boxRayIntersect( va, vb );

				default:
					return false;
			}
		
		case EVolumeType.Ray:
			switch( vb.type )
			{
				case EVolumeType.Ray:
					return rayRayIntersect( va, vb );

				default:
					return false;
			}

		default:
			return false;
	}
}
