import { mat4, vec3 } from '@tlaukkan/tsm';
import { rotationMatFromEulerDegrees, scaleMat, translateMat } from '../traverser_utils';
import { volumesIntersect } from './../volume_intersection';
import { makeBox, makeInfinite, makeSphere } from '../volume_test_utils';

beforeEach( async() =>
{
} );

afterEach( () =>
{
} );

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



