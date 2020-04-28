import { AvGrabbableCollision, GrabberHookState, EHookVolume } from "../../../../packages/aardvark-shared/src/aardvark_protocol";
import { findBestInterface } from '../grab_state_processor';

beforeEach( async() =>
{
} );

afterEach( () =>
{
} );

function blankGrabberWithInterfaces( interfaces: string[] ): AvGrabbableCollision
{
	return {
		grabbableId: null,
		handleId: null,
		handleFlags: 0,
		grabbableFlags: 0,
		interfaces,
	};
}

function blankHookWithInterfaces( interfaces: string[] ): GrabberHookState
{
	return {
		hookId: null,
		whichVolume: EHookVolume.Inner,
		interfaces,
	};
}

describe( "gadget state processor ", () =>
{
	it( "simple findBestInterface", async () =>
	{
		let grabbable = blankGrabberWithInterfaces(
			[ 
				"foo@2",
				"foo@1",
				"bar@1"
			] );

		let hook = blankHookWithInterfaces(
			[ 
				"foo@2",
				"foo@1",
			] );

		expect( findBestInterface( grabbable, hook ) ).toBe( "foo@2" );
	} );

	it( "fail to findBestInterface", async () =>
	{
		let grabbable = blankGrabberWithInterfaces(
			[ 
				"bar@1"
			] );

		let hook = blankHookWithInterfaces(
			[ 
				"foo@2",
				"foo@1",
			] );

		expect( findBestInterface( grabbable, hook ) ).toBe( null );
	} );

	it( "fallback findBestInterface", async () =>
	{
		let grabbable = blankGrabberWithInterfaces(
			[ 
				"foo@2",
				"foo@1",
				"bar@1"
			] );

		let hook = blankHookWithInterfaces(
			[ 
				"foo@1",
			] );

		expect( findBestInterface( grabbable, hook ) ).toBe( "foo@1" );
	} );


} );



