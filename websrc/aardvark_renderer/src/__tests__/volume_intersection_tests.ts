import { EVolumeContext, rotationMatFromEulerDegrees, scaleMat, translateMat } from '@aardvarkxr/aardvark-shared';
import { mat4, vec3 } from '@tlaukkan/tsm';
import { makeBox, makeEmpty, makeInfinite, makeRay, makeSphere } from '../volume_test_utils';
import { rayFromMatrix, volumesIntersect } from './../volume_intersection';
import 'common/testutils';

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

		{
			const [ res, pt ] = volumesIntersect( i1, e1, EVolumeContext.Always );
			expect( res ).toBe( false );
			expect( pt ).toBeNull();
		}

		{
			const [ res, pt ] = volumesIntersect( e1, i1, EVolumeContext.Always );
			expect( res ).toBe( false );
			expect( pt ).toBeNull();
		}
	} );

	it( "empty sphere", async () =>
	{
		let s1 = makeSphere( 999 );
		let e1 = makeEmpty();

		{
			const [ res, pt ] = volumesIntersect( s1, e1, EVolumeContext.Always );
			expect( res ).toBe( false );
			expect( pt ).toBeNull();
		}
		{
			const [ res, pt ] = volumesIntersect( e1, s1, EVolumeContext.Always );
			expect( res ).toBe( false );
			expect( pt ).toBeNull();
		}
	} );

	it( "empty box", async () =>
	{
		let b1 = makeBox( [ -999, 999, -999, 999, -999, 999, ] );
		let e1 = makeEmpty();
		{
			const [ res, pt ] = volumesIntersect( b1, e1, EVolumeContext.Always );
			expect( res ).toBe( false );
			expect( pt ).toBeNull();
		}
		{
			const [ res, pt ] = volumesIntersect( e1, b1, EVolumeContext.Always );
			expect( res ).toBe( false );
			expect( pt ).toBeNull();
		}
	} );

	it( "infinite infinite", async () =>
	{
		let i1 = makeInfinite();
		let i2 = makeInfinite();

		const [ res, pt ] = volumesIntersect( i1, i2, EVolumeContext.Always );
		expect( res ).toBe( true );
	} );

	it( "infinite sphere", async () =>
	{
		let i = makeInfinite();
		let s = makeSphere( 1 );

		{
			const [ res, pt ] = volumesIntersect( i, s, EVolumeContext.Always );
			expect( res ).toBe( true );
		}
		{
			const [ res, pt ] = volumesIntersect( s, i, EVolumeContext.Always );
			expect( res ).toBe( true );
		}
	} );

	it( "sphere", async () =>
	{
		let s1 = makeSphere( 1, new vec3( [ 0, 0.5, 0]) );
		let s2 = makeSphere( 1 );
		let s3 = makeSphere( 0.05, new vec3( [ 0, -0.6, 0]));
		let s4 = makeSphere( 1, new vec3( [ 0, -0.6, 0]), 0.05 );
		let s5 = makeSphere( 0.05, new vec3( [ 0, -0.6, 0]), 10 );
		let s6 = makeSphere( 10, new vec3( [0, 1, 0] ) );
		let s7 = makeSphere( 10, new vec3( [0, 2, 0] ) );

		{
			const [ int, pt ] = volumesIntersect( s1, s2, EVolumeContext.Always );
			expect( int ).toBe( true );
			expect( pt ).toBeVec3( new vec3( [ 0, 0.5, 0 ] ) );

		}
		{
			const [ int, pt ] = volumesIntersect( s2, s1, EVolumeContext.Always );
			expect( int ).toBe( true );
			expect( pt ).toBeVec3( new vec3( [ 0, 0, 0 ] ) );

		}
		{
			const [ int, pt ] = volumesIntersect( s6, s2, EVolumeContext.Always );
			expect( int ).toBe( true );
			expect( pt ).toBeVec3( new vec3( [ 0, 1, 0 ] ) );
		}
		{
			const [ int, pt ] = volumesIntersect( s7, s2, EVolumeContext.Always );
			expect( int ).toBe( true );
			expect( pt ).toBeVec3( new vec3( [ 0, 1, 0 ] ) );
		}
		expect( volumesIntersect( s3, s1, EVolumeContext.Always )[0] ).toBe( false );
		expect( volumesIntersect( s4, s1, EVolumeContext.Always )[0] ).toBe( false );
		expect( volumesIntersect( s5, s1, EVolumeContext.Always )[0] ).toBe( true );
	} );

	it( "sphere box", async () =>
	{
		let s1 = makeSphere( 0.5 );
		let s2 = makeSphere( 0.5, new vec3( [ 1, 0, 0 ] ) );
		let b1 = makeBox( [ -0.05, 0.05, -0.05, 0.05, -0.05, 0.05 ] );
		let b2 = makeBox( [ -5, 5, -5, 5, -5, 5 ] );
		let b3 = makeBox( [ -5, 5, -5, 5, -5, 5 ], scaleMat( new vec3( [ 0.08, 0.08, 0.08 ] )) );

		const [res, pt ] = volumesIntersect( s2, b1, EVolumeContext.Always );

		expect( volumesIntersect( s1, b1, EVolumeContext.Always )[0] ).toBe( true );
		expect( volumesIntersect( s1, b2, EVolumeContext.Always )[0] ).toBe( true );
		expect( volumesIntersect( s2, b1, EVolumeContext.Always )[0] ).toBe( false );
		expect( volumesIntersect( s2, b2, EVolumeContext.Always )[0] ).toBe( true );
		expect( volumesIntersect( s1, b3, EVolumeContext.Always )[0] ).toBe( true );
		expect( volumesIntersect( s2, b3, EVolumeContext.Always )[0] ).toBe( false );
		expect( volumesIntersect( b1, s1, EVolumeContext.Always )[0] ).toBe( true );
		expect( volumesIntersect( b2, s1, EVolumeContext.Always )[0] ).toBe( true );
		expect( volumesIntersect( b1, s2, EVolumeContext.Always )[0] ).toBe( false );
		expect( volumesIntersect( b2, s2, EVolumeContext.Always )[0] ).toBe( true );
		expect( volumesIntersect( b3, s1, EVolumeContext.Always )[0] ).toBe( true );
		expect( volumesIntersect( b3, s2, EVolumeContext.Always )[0] ).toBe( false );
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

		expect( volumesIntersect( b2, b1, EVolumeContext.Always )[0] ).toBe( true );
		expect( volumesIntersect( b3, b1, EVolumeContext.Always )[0] ).toBe( true );
		expect( volumesIntersect( b4, b1, EVolumeContext.Always )[0] ).toBe( false );
		expect( volumesIntersect( b1, b5, EVolumeContext.Always )[0] ).toBe( false );

		// TODO: Figure out why b2, b5 intersects, but b5, b2 does not.
		expect( volumesIntersect( b2, b5, EVolumeContext.Always )[0] ).toBe( true );
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

		{
			const [ int, pt ] = volumesIntersect( r1, s1, EVolumeContext.Always );
			expect( int ).toBe( true );
			expect( pt ).toBeVec3( new vec3( [ 0.5, 0, 0 ] ) );
		}
		{
			const [ int, pt ] = volumesIntersect( r1, s2, EVolumeContext.Always );
			expect( int ).toBe( true );
			expect( pt ).toBeVec3( new vec3( [ 0, 0, 0 ] ) );
		}
		expect( volumesIntersect( r2, s1, EVolumeContext.Always )[0] ).toBe( false );
		expect( volumesIntersect( r2, s2, EVolumeContext.Always )[0] ).toBe( false );
	} );

	it( "ray box", async () =>
	{
		let b1 = makeBox( [ -0.5, 0.5, -0.5, 0.5, -0.5, 0.5 ] );
		let b2 = makeBox( [ -5, 5, -5, 5, -5, 5 ] );
		let r1 = makeRay( new vec3( [ 1, 0, 0 ] ), new vec3( [ -1, 0, 0 ] ) );
		let r2 = makeRay( new vec3( [ 1, 0, 0 ] ), new vec3( [ 0, 1, 0 ] ) );
		let r3 = makeRay( new vec3( [ 6, 0, 0 ] ), new vec3( [ 1, 0, 0 ] ) );

		{
			const [ int, pt ] = volumesIntersect( r1, b1, EVolumeContext.Always );
			expect( int ).toBe( true );
			expect( pt ).toBeVec3( new vec3( [ 0.5, 0, 0 ] ) );
		}

		{
			const [ int, pt ] = volumesIntersect( r1, b2, EVolumeContext.Always );
			expect( int ).toBe( true );
			expect( pt ).toBeVec3( new vec3( [ 1, 0, 0 ] ) );
		}

		{
			const [ int, pt ] = volumesIntersect( r2, b2, EVolumeContext.Always );
			expect( int ).toBe( true );
			expect( pt ).toBeVec3( new vec3( [ 1, 0, 0 ] ) );
		}

		expect( volumesIntersect( r2, b1, EVolumeContext.Always )[0] ).toBe( false );
		expect( volumesIntersect( r3, b1, EVolumeContext.Always )[0] ).toBe( false );
		expect( volumesIntersect( r3, b2, EVolumeContext.Always )[0] ).toBe( false );
	} );

	it( "ray ray", async () =>
	{
		let r1 = makeRay( new vec3( [ 1, 0, 0 ] ), new vec3( [ -1, 0, 0 ] ) );
		let r2 = makeRay( new vec3( [ 1, 0, 0 ] ), new vec3( [ 0, 1, 0 ] ) );
		let r3 = makeRay( new vec3( [ 6, 0, 0 ] ), new vec3( [ 1, 0, 0 ] ) );
		let r4 = makeRay( new vec3( [ 6, 1, 1 ] ), new vec3( [ 1, -0.5, -0.5 ] ).normalize() );

		expect( volumesIntersect( r1, r2, EVolumeContext.Always )[0] ).toBe( true );
		expect( volumesIntersect( r2, r1, EVolumeContext.Always )[0] ).toBe( true );
		expect( volumesIntersect( r1, r3, EVolumeContext.Always )[0] ).toBe( false );
		expect( volumesIntersect( r3, r1, EVolumeContext.Always )[0] ).toBe( false );
		expect( volumesIntersect( r4, r3, EVolumeContext.Always )[0] ).toBe( true );
		expect( volumesIntersect( r3, r4, EVolumeContext.Always )[0] ).toBe( true );
	} );

	it( "context", async () =>
	{
		let always = makeSphere( 1, new vec3( [ 0, 0.0, 0]), undefined, EVolumeContext.Always );
		let start = makeSphere( 1, new vec3( [ 0, 0.0, 0]), undefined, EVolumeContext.StartOnly );
		let cont = makeSphere( 1, new vec3( [ 0, 0.0, 0]), undefined, EVolumeContext.ContinueOnly );

		expect( volumesIntersect( always, always, EVolumeContext.Always )[0] ).toBe( true );
		expect( volumesIntersect( always, start, EVolumeContext.Always )[0] ).toBe( true );
		expect( volumesIntersect( always, cont, EVolumeContext.Always )[0] ).toBe( true );
		expect( volumesIntersect( start, start, EVolumeContext.Always )[0] ).toBe( true );
		expect( volumesIntersect( cont, cont, EVolumeContext.Always )[0] ).toBe( true );
		expect( volumesIntersect( start, cont, EVolumeContext.Always )[0] ).toBe( true );
		expect( volumesIntersect( cont, start, EVolumeContext.Always )[0] ).toBe( true );

		expect( volumesIntersect( always, always, EVolumeContext.StartOnly )[0] ).toBe( true );
		expect( volumesIntersect( always, start, EVolumeContext.StartOnly )[0] ).toBe( true );
		expect( volumesIntersect( always, cont, EVolumeContext.StartOnly )[0] ).toBe( false );
		expect( volumesIntersect( start, start, EVolumeContext.StartOnly )[0] ).toBe( true );
		expect( volumesIntersect( cont, cont, EVolumeContext.StartOnly )[0] ).toBe( false );
		expect( volumesIntersect( start, cont, EVolumeContext.StartOnly )[0] ).toBe( false );
		expect( volumesIntersect( cont, start, EVolumeContext.StartOnly )[0] ).toBe( false );

		expect( volumesIntersect( always, always, EVolumeContext.ContinueOnly )[0] ).toBe( true );
		expect( volumesIntersect( always, start, EVolumeContext.ContinueOnly )[0] ).toBe( false );
		expect( volumesIntersect( always, cont, EVolumeContext.ContinueOnly )[0] ).toBe( true );
		expect( volumesIntersect( start, start, EVolumeContext.ContinueOnly )[0] ).toBe( false );
		expect( volumesIntersect( cont, cont, EVolumeContext.ContinueOnly )[0] ).toBe( true );
		expect( volumesIntersect( start, cont, EVolumeContext.ContinueOnly )[0] ).toBe( false );
		expect( volumesIntersect( cont, start, EVolumeContext.ContinueOnly )[0] ).toBe( false );
	} );

} );



