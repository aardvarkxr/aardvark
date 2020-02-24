import { AvNodeTransform } from '@aardvarkxr/aardvark-shared';
import { vec3, mat4, vec4, mat3, quat } from '@tlaukkan/tsm';

export function translateMat( t: vec3)
{
	let m = new mat4();
	m.setIdentity();
	m.translate( t );
	return m;
}

export function scaleMat( s: vec3)
{
	let m = new mat4();
	m.setIdentity();
	m.scale( s );
	return m;
}

export function getRowFromMat( m: mat4, n: number ) : vec3 
{
	let row = m.row( n );
	return new vec3( [ row[ 0 ], row[ 1 ],row[ 2 ], ] );
}

export function nodeTransformFromMat4( m: mat4 ) : AvNodeTransform
{
	let transform: AvNodeTransform = {};
	let pos = m.multiplyVec4( new vec4( [ 0, 0, 0, 1 ] ) );
	if( pos.x != 0 || pos.y != 0 || pos.z != 0 )
	{
		transform.position = { x: pos.x, y: pos.y, z: pos.z };
	}

	let xScale = getRowFromMat( m, 0 ).length();
	let yScale = getRowFromMat( m, 1 ).length();
	let zScale = getRowFromMat( m, 2 ).length();
	if( xScale != 1 || yScale != 1 || zScale != 1 )
	{
		transform.scale = { x : xScale, y: yScale, z: zScale };
	}

	let rotMat = new mat3( 
		[
			m.at( 0 + 0 ) / xScale, m.at( 0 + 1 ) / xScale, m.at( 0 + 2 ) / xScale,
			m.at( 4 + 0 ) / yScale, m.at( 4 + 1 ) / yScale, m.at( 4 + 2 ) / yScale,
			m.at( 8 + 0 ) / zScale, m.at( 8 + 1 ) / zScale, m.at( 8 + 2 ) / zScale,
		] );
	let rot = rotMat.toQuat();
	if( rot.x != 0 || rot.y != 0 || rot.z != 0 )
	{
		transform.rotation = { x: rot.x, y: rot.y, z: rot.z, w: rot.w };
	}

	return transform;
}

export function nodeTransformToMat4( transform: AvNodeTransform ): mat4
{
	let vTrans: vec3;
	if ( transform.position )
	{
		vTrans = new vec3( [ transform.position.x, transform.position.y, transform.position.z ] );
	}
	else
	{
		vTrans = new vec3( [ 0, 0, 0 ] );
	}
	let vScale: vec3;
	if ( transform.scale )
	{
		vScale = new vec3( [ transform.scale.x, transform.scale.y, transform.scale.z ] );
	}
	else
	{
		vScale = new vec3( [ 1, 1, 1 ] );
	}
	let qRot: quat;
	if ( transform.rotation )
	{
		qRot = new quat( [ transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w ] );
	}
	else
	{
		qRot = new quat( [ 0, 0, 0, 1 ] );
	}

	let mat = translateMat( vTrans ).multiply( qRot.toMat4() );
	mat = mat.multiply( scaleMat( vScale ) ) ;
	return mat;
}

export function computeUniverseFromLine( lineStart: vec3, lineEnd: vec3, thickness: number ): mat4
{
	let lineVector = new vec3( lineEnd.xyz );
	lineVector.subtract( lineStart );
	let lineLength = lineVector.length();
	lineVector.normalize();
	let cylinderCenter = new vec3( lineStart.xyz ).add( new vec3( lineVector.xyz ).scale( lineLength / 2 ) );

	let ybasis = lineVector;
	let xbasis: vec3;
	if( ybasis.x > 0.99 )
	{
		xbasis = new vec3([ 0, 1, 0 ] );
	} 
	else
	{
		xbasis = new vec3([ 1, 0, 0 ] );
	} 
	let zbasis = vec3.cross( ybasis, xbasis, new vec3() );
	zbasis.normalize();
	xbasis = vec3.cross( zbasis, ybasis, xbasis );
	let lineRotation = new mat4(
		[ 
			xbasis.x, xbasis.y, xbasis.z, 0,
			ybasis.x, ybasis.y, ybasis.z, 0,
			zbasis.x, zbasis.y, zbasis.z, 0,
			0, 0, 0, 1,
		]
	);

	let scale = scaleMat( new vec3( [ thickness, lineLength, thickness ] ) );
	return translateMat( cylinderCenter ).multiply( lineRotation.multiply( scale ) ); 
}

export function vec3MultiplyAndAdd( base: vec3, direction: vec3, distance: number ): vec3
{
	return new vec3(
		[
			base.x + direction.x * distance,
			base.y + direction.y * distance,
			base.z + direction.z * distance,
		]
	)
}

export function scaleAxisToFit( limit: number, min: number, max: number ): number
{
	let extent = Math.max( -min, max );
	if( extent <= 0 )
	{
		return null;
	}
	else
	{
		return limit / extent;
	}
}

export function minIgnoringNulls( ...values: number[] )
{
	let noNulls = values.filter( ( v:number) => { return v != null; } );
	if( noNulls )
	{
		return Math.min( ...noNulls );
	}
	else
	{
		return null;
	}
}

export function lerpAvTransforms( xf0: AvNodeTransform, xf1: AvNodeTransform, t: number ): AvNodeTransform
{
	let result = { ...xf1 };
	if( xf0 && xf0.position && xf1.position )
	{
		let t0 = new vec3( [ xf0.position.x, xf0.position.y, xf0.position.z ] );
		let t1 = new vec3( [ xf1.position.x, xf1.position.y, xf1.position.z ] );
		let trans = vec3.mix( t0, t1, t, new vec3() );
		result.position =
		{
			x: trans.x,
			y: trans.y,
			z: trans.z,
		}
	}

	if( xf0 && xf0.scale && xf1.scale )
	{
		let s0 = new vec3( [ xf0.scale.x, xf0.scale.y, xf0.scale.z ] );
		let s1 = new vec3( [ xf1.scale.x, xf1.scale.y, xf1.scale.z ] );
		let scale = vec3.mix( s0, s1, t, new vec3() );
		result.scale =
		{
			x: scale.x,
			y: scale.y,
			z: scale.z,
		}
	}

	if( xf0 && xf0.rotation && xf1.rotation )
	{
		let r0 = new quat( [ xf0.rotation.x, xf0.rotation.y, xf0.rotation.z, xf0.rotation.w ] );
		let r1 = new quat( [ xf1.rotation.x, xf1.rotation.y, xf1.rotation.z, xf1.rotation.w ] );
		let rot = quat.mix( r0, r1, t, new quat() );
		result.rotation =
		{
			w: rot.w,
			x: rot.x,
			y: rot.y,
			z: rot.z,
		}
	}

	return result;
}

