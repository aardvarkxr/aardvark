import { TransformedVolume, volumesIntersect } from './../volume_intersection';
import { vec3, mat4 } from '@tlaukkan/tsm';
import { AvVolume, EVolumeType, AABB } from '@aardvarkxr/aardvark-shared';
import { translateMat, scaleMat, rotationMatFromEulerDegrees } from '../traverser_utils';

beforeEach( async() =>
{
} );

afterEach( () =>
{
} );

function makeSphere( radius: number, position?: vec3, scale?: number )
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

function makeBox( ranges: [number, number, number, number, number, number], universeFromVolume?: mat4 )
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

function makeInfinite()
{
	return (
		{
			type: EVolumeType.Infinite,
			universeFromVolume: mat4.identity,
		} as TransformedVolume );
}


describe( "volume intersections ", () =>
{
	it( "infinite infinite", async () =>
	{
		let i1 = makeInfinite();
		let i2 = makeInfinite();
		expect( volumesIntersect( i1, i2 ) ).toBe( true );
	} );

	it( "infinite sphere", async () =>
	{
		let i = makeInfinite();
		let s = makeSphere( 1 );

		expect( volumesIntersect( i, s ) ).toBe( true );
		expect( volumesIntersect( s, i ) ).toBe( true );
	} );

	it( "sphere", async () =>
	{
		let s1 = makeSphere( 1, new vec3( [ 0, 0.5, 0]) );
		let s2 = makeSphere( 1 );
		let s3 = makeSphere( 0.05, new vec3( [ 0, -0.6, 0]));
		let s4 = makeSphere( 1, new vec3( [ 0, -0.6, 0]), 0.05 );
		let s5 = makeSphere( 0.05, new vec3( [ 0, -0.6, 0]), 10 );

		expect( volumesIntersect( s1, s2 ) ).toBe( true );
		expect( volumesIntersect( s2, s1 ) ).toBe( true );
		expect( volumesIntersect( s3, s1 ) ).toBe( false );
		expect( volumesIntersect( s4, s1 ) ).toBe( false );
		expect( volumesIntersect( s5, s1 ) ).toBe( true );
	} );

	it( "sphere box", async () =>
	{
		let s1 = makeSphere( 0.5 );
		let s2 = makeSphere( 0.5, new vec3( [ 1, 0, 0 ] ) );
		let b1 = makeBox( [ -0.05, 0.05, -0.05, 0.05, -0.05, 0.05 ] );
		let b2 = makeBox( [ -5, 5, -5, 5, -5, 5 ] );
		let b3 = makeBox( [ -5, 5, -5, 5, -5, 5 ], scaleMat( new vec3( [ 0.08, 0.08, 0.08 ] )) );

		expect( volumesIntersect( s1, b1 ) ).toBe( true );
		expect( volumesIntersect( s1, b2 ) ).toBe( true );
		expect( volumesIntersect( s2, b1 ) ).toBe( false );
		expect( volumesIntersect( s2, b2 ) ).toBe( true );
		expect( volumesIntersect( s1, b3 ) ).toBe( true );
		expect( volumesIntersect( s2, b3 ) ).toBe( false );
	} );

	it( "box box", async () =>
	{
		let b1 = makeBox( [ -0.05, 0.05, -0.05, 0.05, -0.05, 0.05 ] );
		let b2 = makeBox( [ -5, 5, -5, 5, -5, 5 ] );
		let b3 = makeBox( [ -5, 5, -5, 5, -5, 5 ], scaleMat( new vec3( [ 0.08, 0.08, 0.08 ] )) );
		let b4 = makeBox( [ -5, 5, -5, 5, -5, 5 ], translateMat( new vec3( [ 0, 0, 11 ] )) );
		let b5 = makeBox( [ -5, 5, -5, 5, -5, 5 ], 
			mat4.product( translateMat( new vec3( [ 10, 0, 10 ] ) ), 
				rotationMatFromEulerDegrees( new vec3([0, 45, 0])), new mat4() ) );

		expect( volumesIntersect( b2, b1 ) ).toBe( true );
		expect( volumesIntersect( b3, b1 ) ).toBe( true );
		expect( volumesIntersect( b4, b1 ) ).toBe( false );
		expect( volumesIntersect( b1, b5 ) ).toBe( false );
		expect( volumesIntersect( b2, b5 ) ).toBe( true );
	} );

} );



