import { GadgetRoomCallbacks, GadgetRoomEnvelope, GadgetRoomMemberJoined, RoomMessageType, RoomMemberIdReserved, GadgetRoomMemberLeft } from '@aardvarkxr/aardvark-shared';
import { createRoom, addRoomMember, removeRoomMember, onRoomMessage } from '../rooms';

beforeEach( async() =>
{
} );

afterEach( () =>
{
} );

function emptyCallbacks(): GadgetRoomCallbacks
{
	return ( 
		{
			sendMessage: ( message: GadgetRoomEnvelope ) => {},
		} );
}

function joinMessage( memberId: string ): GadgetRoomMemberJoined
{
	return (
		{
			type: RoomMessageType.MemberJoined,
			source: RoomMemberIdReserved.Room,
			memberId,
		}
	);
}

function leftMessage( memberId: string ): GadgetRoomMemberLeft
{
	return (
		{
			type: RoomMessageType.MemberLeft,
			source: RoomMemberIdReserved.Room,
			memberId,
		}
	);
}


describe( "server ", () =>
{
	it( "create", async () =>
	{
		let room = createRoom( "fred", "sam", emptyCallbacks() );
		expect( room.roomId ).toBe( "fred" );
		expect( room.gadgetPersistenceId ).toBe( "sam" );
	} );

	it( "addMember", async () =>
	{
		let room = createRoom( "fred", "sam", emptyCallbacks() );
		addRoomMember( room, "julie" );
		expect( room.members.length ).toBe( 1 );
		expect( room.members[0].memberId ).toBe( "julie" );
	} );

	it( "dupMember", async () =>
	{
		let room = createRoom( "fred", "sam", emptyCallbacks() );
		addRoomMember( room, "julie" );
		addRoomMember( room, "julie" );
		expect( room.members.length ).toBe( 1 );
		expect( room.members[0].memberId ).toBe( "julie" );
	} );

	it( "removeMember", async () =>
	{
		let room = createRoom( "fred", "sam", emptyCallbacks() );
		addRoomMember( room, "julie" );
		addRoomMember( room, "christine" );
		expect( room.members.length ).toBe( 2 );
		removeRoomMember( room, "julie" );
		expect( room.members.length ).toBe( 1 );
		expect( room.members[0].memberId ).toBe( "christine" );
	} );

	it( "addMemberFromMessage", async () =>
	{
		let room = createRoom( "fred", "sam", emptyCallbacks() );
		onRoomMessage( room, joinMessage( "julie" ) );
		expect( room.members.length ).toBe( 1 );
		expect( room.members[0].memberId ).toBe( "julie" );
	} );

	it( "dupMemberFromMessage", async () =>
	{
		let room = createRoom( "fred", "sam", emptyCallbacks() );
		onRoomMessage( room, joinMessage( "julie" ) );
		onRoomMessage( room, joinMessage( "julie" ) );
		expect( room.members.length ).toBe( 1 );
		expect( room.members[0].memberId ).toBe( "julie" );
	} );

	it( "removeMemberFromMessage", async () =>
	{
		let room = createRoom( "fred", "sam", emptyCallbacks() );
		onRoomMessage( room, joinMessage( "julie" ) );
		onRoomMessage( room, joinMessage( "christine" ) );
		expect( room.members.length ).toBe( 2 );
		onRoomMessage( room, leftMessage( "christine" ) );
		expect( room.members.length ).toBe( 1 );
		expect( room.members[0].memberId ).toBe( "julie" );
	} );


} );



