import { RoomMessageType, RoomMemberIdReserved, GadgetRoomCallbacks, GadgetRoomEnvelope, GadgetRoomMemberJoined, GadgetRoomMemberLeft } from '@aardvarkxr/aardvark-shared';

export interface RoomMember
{
	memberId: string;
}

export interface Room
{
	roomId: string;
	gadgetPersistenceId: string;
	callbacks: GadgetRoomCallbacks;
	members: RoomMember[];
}

export function createRoom( roomId: string, gadgetPersistenceId: string, 
	callbacks: GadgetRoomCallbacks ): Room
{
	return (
		{
			roomId,
			gadgetPersistenceId,
			callbacks,
			members: [],
		} );
}

function findMemberIndex( room: Room, memberId: string )
{
	return room.members.findIndex( ( member: RoomMember ) =>
	{
		return member.memberId == memberId;
	} );
}

export function addRoomMember( room: Room, memberId: string )
{
	if( -1 != findMemberIndex( room, memberId ) )
		return;

	room.members.push(
		{
			memberId,
		} );
}


export function removeRoomMember( room: Room, memberId: string )
{
	let i = findMemberIndex( room, memberId );
	if( i != -1 )
	{
		console.log( "found member to remove: ", memberId );
		room.members.splice( i, 1 );
	}
	else
	{
		console.log( "did not find member to remove", memberId );
	}
}

function assertFromRoom( message: GadgetRoomEnvelope )
{
	if( message.source != RoomMemberIdReserved.Room )
	{
		throw new Error( `Message of type ${ message.type } must have ${ RoomMemberIdReserved.Room } as its source` );
	}
}


export function onRoomMessage( room: Room, message: GadgetRoomEnvelope )
{
	console.log( "processing message ", message );
	switch( message.type )
	{
		case RoomMessageType.MemberJoined:
			assertFromRoom( message );
			let mJoined = message as GadgetRoomMemberJoined;
			addRoomMember( room, mJoined.memberId );
			break;

		case RoomMessageType.MemberLeft:
			assertFromRoom( message );
			let mLeft = message as GadgetRoomMemberLeft;
			removeRoomMember( room, mLeft.memberId );
			break;
	}
}
