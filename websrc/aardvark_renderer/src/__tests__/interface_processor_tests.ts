import { TransformedVolume } from './../volume_intersection';
import { EndpointAddr, EndpointType, endpointAddrsMatch, endpointAddrToString, InterfaceLockResult, InitialInterfaceLock } from '@aardvarkxr/aardvark-shared';
import { mat4, vec3, vec4 } from '@tlaukkan/tsm';
import { CInterfaceProcessor, InterfaceProcessorCallbacks, InterfaceEntity } from './../interface_processor';
import { makeSphere, makeInfinite, makeEmpty } from '../volume_test_utils';
import { syncBuiltinESMExports } from 'module';
import { translateMat } from '@aardvarkxr/aardvark-react';

beforeEach( async() =>
{
} );

afterEach( () =>
{
} );


enum CallType
{
	Start,
	End,
	TransformUpdated,
	Event,
}

interface TestCall
{
	type: CallType;
	transmitter: EndpointAddr;
	receiver: EndpointAddr;
	iface: string;
	destinationFromPeer?: mat4;
	event?: object;
}

class TestCallbacks implements InterfaceProcessorCallbacks
{
	public calls: TestCall[] = [];

	interfaceStarted( transmitter: EndpointAddr, receiver: EndpointAddr, iface: string )
	{
		this.calls.push( 
			{
				type: CallType.Start,
				transmitter,
				receiver,
				iface
			} );
	}

	interfaceEnded( transmitter: EndpointAddr, receiver: EndpointAddr, iface: string ):void
	{
		this.calls.push( 
			{
				type: CallType.End,
				transmitter,
				receiver,
				iface
			} );
	}

	interfaceTransformUpdated( destination: EndpointAddr, peer: EndpointAddr, iface: string, destinationFromPeer: mat4 ): void
	{
		this.calls.push( 
			{
				type: CallType.TransformUpdated,
				transmitter: destination,
				receiver: peer,
				iface,
				destinationFromPeer,
			} );
	}

	interfaceEvent( destination: EndpointAddr, peer: EndpointAddr, iface: string, event: object ): void
	{
		this.calls.push( 
			{
				type: CallType.Event,
				transmitter: destination,
				receiver: peer,
				iface,
				event,
			} );
	}

}

let nextId = 1;

class CTestEntity implements InterfaceEntity
{
	public epa: EndpointAddr = { type: EndpointType.Node, endpointId: nextId++, nodeId: nextId++ };
	public transmits: string[] = [];
	public receives: string[] = [];
	public originPath: string = "/user/hand/right";
	public universeFromEntity: mat4 = mat4.identity;
	public wantsTransforms = false;
	public priority = 0;
	public volumes: TransformedVolume[] = [];
	public initialLocks: InitialInterfaceLock[] = [];

	public addSphere( radius: number, position?: vec3 )
	{
		this.volumes.push( makeSphere( radius, position ) );
	}

	public addInfinite( )
	{
		this.volumes.push( makeInfinite() );
	}

	public addEmpty( )
	{
		this.volumes.push( makeEmpty() );
	}
}

expect.extend({
	toHavePosition( received: mat4, expected: vec3 )
	{
		let pos = received.multiplyVec4( new vec4( [0, 0, 0, 1] ) );
		if( expected.equals( new vec3( pos.xyz ), 0.001 ) )
		{
			return (
				{
					message: () =>
						`expected ${ pos.xyz } to be `
							+`${ expected.xyz }`,
					pass: true,
				} );
		}
		else
		{
			return (
				{
					message: () =>
						`expected ${ pos.xyz } to not be `
							+`${ expected.xyz }`,
					pass: false,
				} );
		}
	}
} );

declare global {
	namespace jest {
	  interface Matchers<R> {
		toHavePosition( expected: vec3 ): R;
	  }
	}
  }

describe( "interface processor", () =>
{
	it( "empty list", async () =>
	{
		let cb = new TestCallbacks();
		let ip = new CInterfaceProcessor( cb );
		ip.processFrame([]);
		expect( cb.calls.length ).toBe(0);
		ip.processFrame([]);
		expect( cb.calls.length ).toBe(0);
	} );

	it( "self intersect", async () =>
	{
		let cb = new TestCallbacks();
		let ip = new CInterfaceProcessor( cb );

		let e1 = new CTestEntity();
		e1.addSphere( 100 );
		e1.transmits.push( "test@1" );
		e1.receives.push( "test@1" );

		// we still don't expect any intersections
		// because an entity can't interface with 
		// itself
		ip.processFrame([e1]);
		expect( cb.calls.length ).toBe(0);
		ip.processFrame([e1]);
		expect( cb.calls.length ).toBe(0);
	} );

	it( "same hand intersect", async () =>
	{
		let cb = new TestCallbacks();
		let ip = new CInterfaceProcessor( cb );

		let e1 = new CTestEntity();
		e1.addSphere( 100 );
		e1.transmits.push( "test@1" );

		let e2 = new CTestEntity();
		e2.addSphere( 100 );
		e2.receives.push( "test@1" );

		// we still don't expect any intersections
		// because an entity can't interface with 
		// anything else on the same hand
		ip.processFrame([e1, e2]);
		expect( cb.calls.length ).toBe(0);
		ip.processFrame([e1, e2]);
		expect( cb.calls.length ).toBe(0);
	} );

	it( "simple intersect", async () =>
	{
		let cb = new TestCallbacks();
		let ip = new CInterfaceProcessor( cb );

		let e1 = new CTestEntity();
		e1.addSphere( 1 );
		e1.transmits.push( "test@1" );

		let e2 = new CTestEntity();
		e2.addSphere( 1 );
		e2.originPath = "/space/stage";
		e2.receives.push( "test@1" );

		ip.processFrame([e1, e2]);
		expect( cb.calls.length ).toBe(1);
		expect( cb.calls[0] ).toEqual(
			{
				type: CallType.Start,
				transmitter: e1.epa,
				receiver: e2.epa,
				iface: "test@1",
			});
		cb.calls = [];

		// no repeated start
		ip.processFrame([e1, e2]);
		expect( cb.calls.length ).toBe(0);
		cb.calls = [];

		// e2 went away, so end
		ip.processFrame([ e1 ]);
		expect( cb.calls.length ).toBe(1);
		expect( cb.calls[0] ).toEqual(
			{
				type: CallType.End,
				transmitter: e1.epa,
				receiver: e2.epa,
				iface: "test@1",
			});
		cb.calls = [];

		// e2 came back so start again
		ip.processFrame([e1, e2]);
		expect( cb.calls.length ).toBe(1);
		expect( cb.calls[0] ).toEqual(
			{
				type: CallType.Start,
				transmitter: e1.epa,
				receiver: e2.epa,
				iface: "test@1",
			});
		cb.calls = [];

		// e2 lost interface, so go away again
		e2.receives = [];
		ip.processFrame([ e1, e2 ]);
		expect( cb.calls.length ).toBe(1);
		expect( cb.calls[0] ).toEqual(
			{
				type: CallType.End,
				transmitter: e1.epa,
				receiver: e2.epa,
				iface: "test@1",
			});
		cb.calls = [];

		// e2's interface came back so start again
		e2.receives.push("test@1");
		ip.processFrame([e1, e2]);
		expect( cb.calls.length ).toBe(1);
		expect( cb.calls[0] ).toEqual(
			{
				type: CallType.Start,
				transmitter: e1.epa,
				receiver: e2.epa,
				iface: "test@1",
			});
		cb.calls = [];

		// e1 lost interface, so go away again
		e1.transmits = [];
		ip.processFrame([ e1, e2 ]);
		expect( cb.calls.length ).toBe(1);
		expect( cb.calls[0] ).toEqual(
			{
				type: CallType.End,
				transmitter: e1.epa,
				receiver: e2.epa,
				iface: "test@1",
			});
		cb.calls = [];
	} );


	it( "two transmits one receive", async () =>
	{
		let cb = new TestCallbacks();
		let ip = new CInterfaceProcessor( cb );

		let t1 = new CTestEntity();
		t1.addSphere( 1 );
		t1.transmits.push( "test@1" );

		let t2 = new CTestEntity();
		t2.addSphere( 1 );
		t2.transmits.push( "test@1" );

		let r1 = new CTestEntity();
		r1.addSphere( 1 );
		r1.originPath = "/space/stage";
		r1.receives.push( "test@1" );

		ip.processFrame([r1, t1]);
		expect( cb.calls.length ).toBe(1);
		expect( cb.calls[0] ).toEqual(
			{
				type: CallType.Start,
				transmitter: t1.epa,
				receiver: r1.epa,
				iface: "test@1",
			});
		cb.calls = [];

		// t2 arrived so start again
		ip.processFrame([t1, r1, t2]);
		expect( cb.calls.length ).toBe(1);
		expect( cb.calls[0] ).toEqual(
			{
				type: CallType.Start,
				transmitter: t2.epa,
				receiver: r1.epa,
				iface: "test@1",
			});
		cb.calls = [];

		// r1 went away, so lose both
		ip.processFrame([ t1, t2 ]);
		expect( cb.calls ).toHaveLength( 2 );
		expect( cb.calls ).toContainEqual(
			{
				type: CallType.End,
				transmitter: t1.epa,
				receiver: r1.epa,
				iface: "test@1",
			});
		expect( cb.calls ).toContainEqual(
			{
				type: CallType.End,
				transmitter: t2.epa,
				receiver: r1.epa,
				iface: "test@1",
			});
		cb.calls = [];

	} );

	it( "no intersect", async () =>
	{
		let cb = new TestCallbacks();
		let ip = new CInterfaceProcessor( cb );

		let t1 = new CTestEntity();
		t1.addSphere( 1 );
		t1.transmits.push( "test@1" );

		let r1 = new CTestEntity();
		r1.addSphere( 1, new vec3([ 10, 0, 0 ]) );
		r1.originPath = "/space/stage";
		r1.receives.push( "test@1" );

		ip.processFrame([r1, t1]);
		expect( cb.calls.length ).toBe(0);
	} );

	it( "highest priority", async () =>
	{
		let cb = new TestCallbacks();
		let ip = new CInterfaceProcessor( cb );

		let t1 = new CTestEntity();
		t1.addSphere( 1 );
		t1.transmits.push( "test@1" );

		let r1 = new CTestEntity();
		r1.addSphere( 1 );
		r1.originPath = "/space/stage";
		r1.receives.push( "test@1" );

		let r2 = new CTestEntity();
		r2.addSphere( 1 );
		r2.originPath = "/space/stage";
		r2.priority = 100;
		r2.receives.push( "test@1" );

		ip.processFrame([r1, r2, t1]);
		expect( cb.calls.length ).toBe(1);
		expect( cb.calls[0] ).toEqual(
			{
				type: CallType.Start,
				transmitter: t1.epa,
				receiver: r2.epa,
				iface: "test@1",
			});
	} );

	it( "love the one you're with", async () =>
	{
		let cb = new TestCallbacks();
		let ip = new CInterfaceProcessor( cb );

		let t1 = new CTestEntity();
		t1.addSphere( 1 );
		t1.transmits.push( "test@1" );

		let r1 = new CTestEntity();
		r1.addSphere( 1 );
		r1.originPath = "/space/stage";
		r1.receives.push( "test@1" );

		let r2 = new CTestEntity();
		r2.addSphere( 1 );
		r2.originPath = "/space/stage";
		r2.receives.push( "test@1" );

		ip.processFrame([r1, t1]);
		expect( cb.calls.length ).toBe(1);
		expect( cb.calls[0] ).toEqual(
			{
				type: CallType.Start,
				transmitter: t1.epa,
				receiver: r1.epa,
				iface: "test@1",
			});
		cb.calls = [];

		// t1 should not switch interfaces to
		// r2 because it's the same priority.
		ip.processFrame([r2, r1, t1]);
		expect( cb.calls.length ).toBe(0);
		cb.calls = [];
	} );

	it( "new shiny", async () =>
	{
		let cb = new TestCallbacks();
		let ip = new CInterfaceProcessor( cb );

		let t1 = new CTestEntity();
		t1.addSphere( 1 );
		t1.transmits.push( "test@1" );

		let r1 = new CTestEntity();
		r1.addSphere( 1 );
		r1.originPath = "/space/stage";
		r1.receives.push( "test@1" );

		let r2 = new CTestEntity();
		r2.addSphere( 1 );
		r2.originPath = "/space/stage";
		r2.priority = 100;
		r2.receives.push( "test@1" );

		ip.processFrame([r1, t1]);
		expect( cb.calls.length ).toBe(1);
		expect( cb.calls[0] ).toEqual(
			{
				type: CallType.Start,
				transmitter: t1.epa,
				receiver: r1.epa,
				iface: "test@1",
			});
		cb.calls = [];

		// t1 should switch interfaces to
		// r2 because it's higher priority.
		ip.processFrame([r2, r1, t1]);
		expect( cb.calls.length ).toBe(2);
		expect( cb.calls[0] ).toEqual(
			{
				type: CallType.End,
				transmitter: t1.epa,
				receiver: r1.epa,
				iface: "test@1",
			});
		expect( cb.calls[1] ).toEqual(
			{
				type: CallType.Start,
				transmitter: t1.epa,
				receiver: r2.epa,
				iface: "test@1",
			});
		cb.calls = [];
	} );

	it( "updating transforms", async () =>
	{
		let cb = new TestCallbacks();
		let ip = new CInterfaceProcessor( cb );

		let t1 = new CTestEntity();
		t1.addSphere( 1 );
		t1.transmits.push( "test@1" );

		let r1 = new CTestEntity();
		r1.addSphere( 1 );
		r1.originPath = "/space/stage";
		r1.receives.push( "test@1" );

		ip.processFrame([r1, t1]);
		expect( cb.calls.length ).toBe(1);
		cb.calls = [];

		t1.wantsTransforms = true;

		t1.universeFromEntity = translateMat( new vec3( [ 0, 1, 0 ] ) );
		ip.processFrame([r1, t1]);
		expect( cb.calls.length ).toBe(1);
		expect( cb.calls[0] ).toMatchObject(
			{
				type: CallType.TransformUpdated,
				transmitter: t1.epa,// really destination
				receiver: r1.epa, // really peer
				iface: "test@1",
			});
		expect( cb.calls[0].destinationFromPeer ).toHavePosition( new vec3( [ 0, -1, 0 ]));
		cb.calls = [];

		t1.universeFromEntity = translateMat( new vec3( [ 0, 2, 0 ] ) );
		r1.wantsTransforms = true;
		ip.processFrame([r1, t1]);
		expect( cb.calls.length ).toBe(2);
		expect( cb.calls[0] ).toMatchObject(
			{
				type: CallType.TransformUpdated,
				transmitter: t1.epa,// really destination
				receiver: r1.epa, // really peer
				iface: "test@1",
			});
		expect( cb.calls[0].destinationFromPeer ).toHavePosition( new vec3( [ 0, -2, 0 ]));
		expect( cb.calls[1] ).toMatchObject(
			{
				type: CallType.TransformUpdated,
				transmitter: r1.epa,// really destination
				receiver: t1.epa, // really peer
				iface: "test@1",
			});
		expect( cb.calls[1].destinationFromPeer ).toHavePosition( new vec3( [ 0, 2, 0 ]));
		cb.calls = [];

		r1.universeFromEntity = translateMat( new vec3( [ 0, 1, 0 ] ) );
		t1.wantsTransforms = false;
		ip.processFrame([r1, t1]);
		expect( cb.calls.length ).toBe(1);
		expect( cb.calls[0] ).toMatchObject(
			{
				type: CallType.TransformUpdated,
				transmitter: r1.epa,// really destination
				receiver: t1.epa, // really peer
				iface: "test@1",
			});
		expect( cb.calls[0].destinationFromPeer ).toHavePosition( new vec3( [ 0, 1, 0 ]));
		cb.calls = [];

	} );

	it( "new shiny but locked", async () =>
	{
		let cb = new TestCallbacks();
		let ip = new CInterfaceProcessor( cb );

		let t1 = new CTestEntity();
		t1.addSphere( 1 );
		t1.transmits.push( "test@1" );

		let r1 = new CTestEntity();
		r1.addSphere( 1 );
		r1.originPath = "/space/stage";
		r1.receives.push( "test@1" );

		let r2 = new CTestEntity();
		r2.addSphere( 1 );
		r2.originPath = "/space/stage";
		r2.priority = 100;
		r2.receives.push( "test@1" );

		ip.processFrame([r1, t1]);
		expect( cb.calls.length ).toBe(1);
		expect( cb.calls[0] ).toEqual(
			{
				type: CallType.Start,
				transmitter: t1.epa,
				receiver: r1.epa,
				iface: "test@1",
			});
		cb.calls = [];

		expect( ip.lockInterface(r2.epa, r1.epa, "blargh@34") ).toBe( InterfaceLockResult.InterfaceNotFound );
		expect( ip.lockInterface(t1.epa, r1.epa, "blargh@34") ).toBe( InterfaceLockResult.InterfaceNameMismatch );
		expect( ip.lockInterface(t1.epa, r1.epa, "test@1") ).toBe( InterfaceLockResult.Success );
		expect( ip.lockInterface(t1.epa, r1.epa, "test@1") ).toBe( InterfaceLockResult.AlreadyLocked );

		// t1 should not switch interfaces to
		// r2 because it's locked
		ip.processFrame([r2, r1, t1]);
		expect( cb.calls.length ).toBe(0);
		cb.calls = [];

		expect( ip.unlockInterface(r2.epa, r1.epa, "blargh@34") ).toBe( InterfaceLockResult.InterfaceNotFound );
		expect( ip.unlockInterface(t1.epa, r1.epa, "blargh@34") ).toBe( InterfaceLockResult.InterfaceNameMismatch );
		expect( ip.unlockInterface(t1.epa, r1.epa, "test@1") ).toBe( InterfaceLockResult.Success );
		expect( ip.unlockInterface(t1.epa, r1.epa, "test@1") ).toBe( InterfaceLockResult.NotLocked );

		// t1 should not switch interfaces to
		// r2 because it's locked
		ip.processFrame([r2, r1, t1]);
		expect( cb.calls.length ).toBe(2);
		expect( cb.calls[0] ).toEqual(
			{
				type: CallType.End,
				transmitter: t1.epa,
				receiver: r1.epa,
				iface: "test@1",
			});
		expect( cb.calls[1] ).toEqual(
			{
				type: CallType.Start,
				transmitter: t1.epa,
				receiver: r2.epa,
				iface: "test@1",
			});
		cb.calls = [];
	} );

	it( "lost receiver but locked", async () =>
	{
		let cb = new TestCallbacks();
		let ip = new CInterfaceProcessor( cb );

		let t1 = new CTestEntity();
		t1.addSphere( 1 );
		t1.transmits.push( "test@1" );

		let r1 = new CTestEntity();
		r1.addSphere( 1 );
		r1.originPath = "/space/stage";
		r1.receives.push( "test@1" );

		let r2 = new CTestEntity();
		r2.addSphere( 1 );
		r2.originPath = "/space/stage";
		r2.receives.push( "test@1" );

		ip.processFrame([r1, r2, t1]);
		expect( cb.calls.length ).toBe(1);
		expect( cb.calls[0] ).toEqual(
			{
				type: CallType.Start,
				transmitter: t1.epa,
				receiver: r1.epa,
				iface: "test@1",
			});
		cb.calls = [];

		expect( ip.lockInterface(t1.epa, r1.epa, "test@1") ).toBe( InterfaceLockResult.Success );

		// End will be sent, but the transmitter won't match with r2 because it's still locked
		ip.processFrame([r2, t1]);
		expect( cb.calls.length ).toBe(1);
		expect( cb.calls[0] ).toEqual(
			{
				type: CallType.End,
				transmitter: t1.epa,
				receiver: r1.epa,
				iface: "test@1",
			});
		cb.calls = [];

		expect( ip.unlockInterface(t1.epa, r1.epa, "test@1") ).toBe( InterfaceLockResult.Success );

		// End will be sent, but the transmitter won't match with r2 because it's still locked
		ip.processFrame([r2, t1]);
		expect( cb.calls.length ).toBe(1);
		expect( cb.calls[0] ).toEqual(
			{
				type: CallType.Start,
				transmitter: t1.epa,
				receiver: r2.epa,
				iface: "test@1",
			});
		cb.calls = [];

	} );

	it( "new shiny but initially locked", async () =>
	{
		let cb = new TestCallbacks();
		let ip = new CInterfaceProcessor( cb );

		let r1 = new CTestEntity();
		r1.addEmpty(); // nothing will pick this without an initial lock
		r1.originPath = "/space/stage";
		r1.receives.push( "test@1" );

		let r2 = new CTestEntity();
		r2.addSphere( 1 );
		r2.originPath = "/space/stage";
		r2.priority = 100;
		r2.receives.push( "test@1" );

		let t1 = new CTestEntity();
		t1.addSphere( 1 );
		t1.transmits.push( "test@1" );
		t1.initialLocks.push(
			{
				receiver: r1.epa,
				iface: "test@1",
			}
		)

		ip.processFrame([r1, t1]);
		expect( cb.calls.length ).toBe(1);
		expect( cb.calls[0] ).toEqual(
			{
				type: CallType.Start,
				transmitter: t1.epa,
				receiver: r1.epa,
				iface: "test@1",
			});
		cb.calls = [];

		expect( ip.lockInterface(r2.epa, r1.epa, "blargh@34") ).toBe( InterfaceLockResult.InterfaceNotFound );
		expect( ip.lockInterface(t1.epa, r1.epa, "test@1") ).toBe( InterfaceLockResult.AlreadyLocked );

		// t1 should not switch interfaces to
		// r2 because it's locked
		ip.processFrame([r2, r1, t1]);
		expect( cb.calls.length ).toBe(0);
		cb.calls = [];

		expect( ip.unlockInterface(r2.epa, r1.epa, "blargh@34") ).toBe( InterfaceLockResult.InterfaceNotFound );
		expect( ip.unlockInterface(t1.epa, r1.epa, "blargh@34") ).toBe( InterfaceLockResult.InterfaceNameMismatch );
		expect( ip.unlockInterface(t1.epa, r1.epa, "test@1") ).toBe( InterfaceLockResult.Success );
		expect( ip.unlockInterface(t1.epa, r1.epa, "test@1") ).toBe( InterfaceLockResult.NotLocked );

		// t1 should not switch interfaces to
		// r2 because it's locked
		ip.processFrame([r2, r1, t1]);
		expect( cb.calls.length ).toBe(2);
		expect( cb.calls[0] ).toEqual(
			{
				type: CallType.End,
				transmitter: t1.epa,
				receiver: r1.epa,
				iface: "test@1",
			});
		expect( cb.calls[1] ).toEqual(
			{
				type: CallType.Start,
				transmitter: t1.epa,
				receiver: r2.epa,
				iface: "test@1",
			});
		cb.calls = [];
	} );

	it( "initial lock but no matching interface", async () =>
	{
		let cb = new TestCallbacks();
		let ip = new CInterfaceProcessor( cb );

		let r1 = new CTestEntity();
		r1.addEmpty(); // nothing will pick this without an initial lock
		r1.originPath = "/space/stage";
		r1.receives.push( "test@1" );

		let r2 = new CTestEntity();
		r2.addSphere( 1 );
		r2.originPath = "/space/stage";
		r2.priority = 100;
		r2.receives.push( "test@1" );

		let t1 = new CTestEntity();
		t1.addSphere( 1 );
		t1.transmits.push( "fred@1" );
		t1.transmits.push( "test@1" );
		t1.initialLocks.push(
			{
				receiver: r1.epa,
				iface: "fred@1",
			}
		)

		ip.processFrame([r1, t1]);
		expect( cb.calls.length ).toBe(2);
		expect( cb.calls[0] ).toEqual(
			{
				type: CallType.Start,
				transmitter: t1.epa,
				receiver: r1.epa,
				iface: "fred@1",
			});
		expect( cb.calls[1] ).toEqual(
			{
				type: CallType.End,
				transmitter: t1.epa,
				receiver: r1.epa,
				iface: "fred@1",
			});
		cb.calls = [];

		expect( ip.lockInterface(r2.epa, r1.epa, "blargh@34") ).toBe( InterfaceLockResult.InterfaceNotFound );
		expect( ip.lockInterface(t1.epa, r1.epa, "fred@1") ).toBe( InterfaceLockResult.InterfaceNotFound );

		// t1 should not switch interfaces to
		// r2 because it's locked
		ip.processFrame([r2, t1]);
		expect( cb.calls.length ).toBe(0);
		cb.calls = [];

		expect( ip.unlockInterface(r2.epa, r1.epa, "blargh@34") ).toBe( InterfaceLockResult.InterfaceNotFound );
		expect( ip.unlockInterface(t1.epa, r1.epa, "blargh@34") ).toBe( InterfaceLockResult.InterfaceNameMismatch );
		expect( ip.unlockInterface(t1.epa, r1.epa, "fred@1") ).toBe( InterfaceLockResult.Success );
		expect( ip.unlockInterface(t1.epa, r1.epa, "fred@1") ).toBe( InterfaceLockResult.InterfaceNotFound );

		// t1 should switch interfaces to
		// r2 because it's no longer locked
		// There's no end with r1 here because we already sent it
		ip.processFrame([r2, r1, t1]);
		expect( cb.calls.length ).toBe(1);
		expect( cb.calls[0] ).toEqual(
			{
				type: CallType.Start,
				transmitter: t1.epa,
				receiver: r2.epa,
				iface: "test@1",
			});
		cb.calls = [];
	} );

	it( "initial lock with missing receiver", async () =>
	{
		let cb = new TestCallbacks();
		let ip = new CInterfaceProcessor( cb );

		let r1 = new CTestEntity();
		r1.addEmpty(); // nothing will pick this without an initial lock
		r1.originPath = "/space/stage";
		r1.receives.push( "test@1" );

		let r2 = new CTestEntity();
		r2.addSphere( 1 );
		r2.originPath = "/space/stage";
		r2.priority = 100;
		r2.receives.push( "test@1" );

		let t1 = new CTestEntity();
		t1.addSphere( 1 );
		t1.transmits.push( "test@1" );
		t1.initialLocks.push(
			{
				receiver: r1.epa,
				iface: "test@1",
			}
		)

		ip.processFrame([r2, t1]);
		expect( cb.calls.length ).toBe(2);
		expect( cb.calls[0] ).toEqual(
			{
				type: CallType.Start,
				transmitter: t1.epa,
				receiver: r1.epa,
				iface: "test@1",
			});
		expect( cb.calls[1] ).toEqual(
			{
				type: CallType.End,
				transmitter: t1.epa,
				receiver: r1.epa,
				iface: "test@1",
			});
		cb.calls = [];

		expect( ip.lockInterface(r2.epa, r1.epa, "blargh@34") ).toBe( InterfaceLockResult.InterfaceNotFound );
		expect( ip.lockInterface(t1.epa, r1.epa, "test@1") ).toBe( InterfaceLockResult.InterfaceNotFound );

		// t1 should not switch interfaces to
		// r2 because it's locked
		ip.processFrame([r2, t1]);
		expect( cb.calls.length ).toBe(0);
		cb.calls = [];

		expect( ip.unlockInterface(r2.epa, r1.epa, "blargh@34") ).toBe( InterfaceLockResult.InterfaceNotFound );
		expect( ip.unlockInterface(t1.epa, r1.epa, "blargh@34") ).toBe( InterfaceLockResult.InterfaceNameMismatch );
		expect( ip.unlockInterface(t1.epa, r1.epa, "test@1") ).toBe( InterfaceLockResult.Success );
		expect( ip.unlockInterface(t1.epa, r1.epa, "test@1") ).toBe( InterfaceLockResult.InterfaceNotFound );

		// t1 should not switch interfaces to
		// r2 because it's no longer locked
		// There's no end with r1 here because we already sent it
		ip.processFrame([r2, r1, t1]);
		expect( cb.calls.length ).toBe(1);
		expect( cb.calls[0] ).toEqual(
			{
				type: CallType.Start,
				transmitter: t1.epa,
				receiver: r2.epa,
				iface: "test@1",
			});
		cb.calls = [];
	} );

	it( "events", async () =>
	{
		let cb = new TestCallbacks();
		let ip = new CInterfaceProcessor( cb );

		let t1 = new CTestEntity();
		t1.addSphere( 1 );
		t1.transmits.push( "test@1" );

		let r1 = new CTestEntity();
		r1.addSphere( 1 );
		r1.originPath = "/space/stage";
		r1.receives.push( "test@1" );

		let r2 = new CTestEntity();
		r2.addSphere( 1 );
		r2.originPath = "/space/stage";
		r2.receives.push( "test@1" );

		ip.processFrame([r1, r2, t1]);
		expect( cb.calls.length ).toBe(1);
		cb.calls = [];

		ip.interfaceEvent(t1.epa, r1.epa, "test@1", {msg: "Hello"} );
		ip.interfaceEvent(t1.epa, r1.epa, "bargle@5", {msg: "failed"} );
		ip.interfaceEvent(t1.epa, r2.epa, "test@1", {msg: "failed"} );

		// End will be sent, but the transmitter won't match with r2 because it's still locked
		ip.processFrame([r2, r1, t1]);
		expect( cb.calls.length ).toBe(1);
		expect( cb.calls[0] ).toEqual(
			{
				type: CallType.Event,
				transmitter: t1.epa,
				receiver: r1.epa,
				iface: "test@1",
				event: { msg: "Hello" },
			});
		cb.calls = [];

		ip.interfaceEvent(r1.epa, t1.epa, "test@1", {msg: "Goodbye"} );
		ip.interfaceEvent(r1.epa, t1.epa, "bargle@5", {msg: "failed"} );
		ip.interfaceEvent(r2.epa, t1.epa, "test@1", {msg: "failed"} );

		// End will be sent, but the transmitter won't match with r2 because it's still locked
		ip.processFrame([r2, r1, t1]);
		expect( cb.calls.length ).toBe(1);
		expect( cb.calls[0] ).toEqual(
			{
				type: CallType.Event,
				transmitter: r1.epa,
				receiver: t1.epa,
				iface: "test@1",
				event: { msg: "Goodbye" },
			});
		cb.calls = [];

	} );

} );



