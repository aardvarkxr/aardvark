import { EVolumeContext, rotationMatFromEulerDegrees, scaleMat, translateMat } from '@aardvarkxr/aardvark-shared';
import { mat4, vec3 } from '@tlaukkan/tsm';
import { makeBox, makeEmpty, makeInfinite, makeRay, makeSphere } from '../volume_test_utils';
import { rayFromMatrix, volumesIntersect } from './../volume_intersection';

beforeEach( async() =>
{
} );

afterEach( () =>
{
} );

describe( "volume intersections ", () =>
{
	it( "empty infinite", async () =>
	{
		let i1 = makeInfinite();
		let e1 = makeEmpty();
		expect( volumesIntersect( i1, e1, EVolumeContext.Always ) ).toBe( false );
		expect( volumesIntersect( e1, i1, EVolumeContext.Always ) ).toBe( false );
	} );

	it( "empty sphere", async () =>
	{
		let s1 = makeSphere( 999 );
		let e1 = makeEmpty();
		expect( volumesIntersect( s1, e1, EVolumeContext.Always ) ).toBe( false );
		expect( volumesIntersect( e1, s1, EVolumeContext.Always ) ).toBe( false );
	} );

	it( "empty box", async () =>
	{
		let b1 = makeBox( [ -999, 999, -999, 999, -999, 999, ] );
		let e1 = makeEmpty();
		expect( volumesIntersect( b1, e1, EVolumeContext.Always ) ).toBe( false );
		expect( volumesIntersect( e1, b1, EVolumeContext.Always ) ).toBe( false );
	} );

	it( "infinite infinite", async () =>
	{
		let i1 = makeInfinite();
		let i2 = makeInfinite();
		expect( volumesIntersect( i1, i2, EVolumeContext.Always ) ).toBe( true );
	} );

	it( "infinite sphere", async () =>
	{
		let i = makeInfinite();
		let s = makeSphere( 1 );

		expect( volumesIntersect( i, s, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( s, i, EVolumeContext.Always ) ).toBe( true );
	} );

	it( "sphere", async () =>
	{
		let s1 = makeSphere( 1, new vec3( [ 0, 0.5, 0]) );
		let s2 = makeSphere( 1 );
		let s3 = makeSphere( 0.05, new vec3( [ 0, -0.6, 0]));
		let s4 = makeSphere( 1, new vec3( [ 0, -0.6, 0]), 0.05 );
		let s5 = makeSphere( 0.05, new vec3( [ 0, -0.6, 0]), 10 );

		expect( volumesIntersect( s1, s2, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( s2, s1, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( s3, s1, EVolumeContext.Always ) ).toBe( false );
		expect( volumesIntersect( s4, s1, EVolumeContext.Always ) ).toBe( false );
		expect( volumesIntersect( s5, s1, EVolumeContext.Always ) ).toBe( true );
	} );

	it( "sphere box", async () =>
	{
		let s1 = makeSphere( 0.5 );
		let s2 = makeSphere( 0.5, new vec3( [ 1, 0, 0 ] ) );
		let b1 = makeBox( [ -0.05, 0.05, -0.05, 0.05, -0.05, 0.05 ] );
		let b2 = makeBox( [ -5, 5, -5, 5, -5, 5 ] );
		let b3 = makeBox( [ -5, 5, -5, 5, -5, 5 ], scaleMat( new vec3( [ 0.08, 0.08, 0.08 ] )) );

		expect( volumesIntersect( s1, b1, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( s1, b2, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( s2, b1, EVolumeContext.Always ) ).toBe( false );
		expect( volumesIntersect( s2, b2, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( s1, b3, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( s2, b3, EVolumeContext.Always ) ).toBe( false );
		expect( volumesIntersect( b1, s1, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( b2, s1, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( b1, s2, EVolumeContext.Always ) ).toBe( false );
		expect( volumesIntersect( b2, s2, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( b3, s1, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( b3, s2, EVolumeContext.Always ) ).toBe( false );
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

		expect( volumesIntersect( b2, b1, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( b3, b1, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( b4, b1, EVolumeContext.Always ) ).toBe( false );
		expect( volumesIntersect( b1, b5, EVolumeContext.Always ) ).toBe( false );

		// TODO: Figure out why b5, b2 intersections, but b2, b5 does not.
		expect( volumesIntersect( b5, b2, EVolumeContext.Always ) ).toBe( true );
	} );

	it( "ray construction", () =>
	{
		let start = new vec3( [ 6, 1, 1 ] );
		let dir = new vec3( [ 1, -0.5, -0.5 ] ).normalize();
		let r4 = makeRay( start, dir );

		let [ s, d ] = rayFromMatrix( r4.universeFromVolume );

		expect( s.equals( start, 0.001 ) ).toBe( true );
		expect( d.equals( dir, 0.001 ) ).toBe( true );
	} );


	it( "ray sphere", async () =>
	{
		let s1 = makeSphere( 0.5 );
		let s2 = makeSphere( 0.5, new vec3( [ 0, 0.5, 0 ] ) );
		let r1 = makeRay( new vec3( [ 1, 0, 0 ] ), new vec3( [ -1, 0, 0 ] ) );
		let r2 = makeRay( new vec3( [ 1, 0, 0 ] ), new vec3( [ 0, 1, 0 ] ) );

		expect( volumesIntersect( r1, s1, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( r1, s2, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( r2, s1, EVolumeContext.Always ) ).toBe( false );
		expect( volumesIntersect( r2, s2, EVolumeContext.Always ) ).toBe( false );
	} );

	it( "ray box", async () =>
	{
		let b1 = makeBox( [ -0.5, 0.5, -0.5, 0.5, -0.5, 0.5 ] );
		let b2 = makeBox( [ -5, 5, -5, 5, -5, 5 ] );
		let r1 = makeRay( new vec3( [ 1, 0, 0 ] ), new vec3( [ -1, 0, 0 ] ) );
		let r2 = makeRay( new vec3( [ 1, 0, 0 ] ), new vec3( [ 0, 1, 0 ] ) );
		let r3 = makeRay( new vec3( [ 6, 0, 0 ] ), new vec3( [ 1, 0, 0 ] ) );

		expect( volumesIntersect( r1, b1, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( r1, b2, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( r2, b1, EVolumeContext.Always ) ).toBe( false );
		expect( volumesIntersect( r2, b2, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( r3, b1, EVolumeContext.Always ) ).toBe( false );
		expect( volumesIntersect( r3, b2, EVolumeContext.Always ) ).toBe( false );
	} );

	it( "ray ray", async () =>
	{
		let r1 = makeRay( new vec3( [ 1, 0, 0 ] ), new vec3( [ -1, 0, 0 ] ) );
		let r2 = makeRay( new vec3( [ 1, 0, 0 ] ), new vec3( [ 0, 1, 0 ] ) );
		let r3 = makeRay( new vec3( [ 6, 0, 0 ] ), new vec3( [ 1, 0, 0 ] ) );
		let r4 = makeRay( new vec3( [ 6, 1, 1 ] ), new vec3( [ 1, -0.5, -0.5 ] ).normalize() );

		expect( volumesIntersect( r1, r2, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( r2, r1, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( r1, r3, EVolumeContext.Always ) ).toBe( false );
		expect( volumesIntersect( r3, r1, EVolumeContext.Always ) ).toBe( false );
		expect( volumesIntersect( r4, r3, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( r3, r4, EVolumeContext.Always ) ).toBe( true );
	} );

	it( "context", async () =>
	{
		let always = makeSphere( 1, new vec3( [ 0, 0.0, 0]), undefined, EVolumeContext.Always );
		let start = makeSphere( 1, new vec3( [ 0, 0.0, 0]), undefined, EVolumeContext.StartOnly );
		let cont = makeSphere( 1, new vec3( [ 0, 0.0, 0]), undefined, EVolumeContext.ContinueOnly );

		expect( volumesIntersect( always, always, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( always, start, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( always, cont, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( start, start, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( cont, cont, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( start, cont, EVolumeContext.Always ) ).toBe( true );
		expect( volumesIntersect( cont, start, EVolumeContext.Always ) ).toBe( true );

		expect( volumesIntersect( always, always, EVolumeContext.StartOnly ) ).toBe( true );
		expect( volumesIntersect( always, start, EVolumeContext.StartOnly ) ).toBe( true );
		expect( volumesIntersect( always, cont, EVolumeContext.StartOnly ) ).toBe( false );
		expect( volumesIntersect( start, start, EVolumeContext.StartOnly ) ).toBe( true );
		expect( volumesIntersect( cont, cont, EVolumeContext.StartOnly ) ).toBe( false );
		expect( volumesIntersect( start, cont, EVolumeContext.StartOnly ) ).toBe( false );
		expect( volumesIntersect( cont, start, EVolumeContext.StartOnly ) ).toBe( false );

		expect( volumesIntersect( always, always, EVolumeContext.ContinueOnly ) ).toBe( true );
		expect( volumesIntersect( always, start, EVolumeContext.ContinueOnly ) ).toBe( false );
		expect( volumesIntersect( always, cont, EVolumeContext.ContinueOnly ) ).toBe( true );
		expect( volumesIntersect( start, start, EVolumeContext.ContinueOnly ) ).toBe( false );
		expect( volumesIntersect( cont, cont, EVolumeContext.ContinueOnly ) ).toBe( true );
		expect( volumesIntersect( start, cont, EVolumeContext.ContinueOnly ) ).toBe( false );
		expect( volumesIntersect( cont, start, EVolumeContext.ContinueOnly ) ).toBe( false );
	} );

} );



