import { RoomMessageType, RoomMemberIdReserved, GadgetRoomCallbacks, GadgetRoomEnvelope, RMMemberJoined, RMMemberLeft, SharedGadget, MinimalPose } from '@aardvarkxr/aardvark-shared';

export interface RoomMemberGadget
{
	gadgetUri: string;
	persistenceUuid: string;
	hook?: string;
	gadgetId?: number;
}

export interface RoomMember
{
	memberId: string;
	gadgets: RoomMemberGadget[];
	poses: { [ originPath: string ] : MinimalPose };
}

export interface ServerRoomCallbacks extends GadgetRoomCallbacks
{
	getSharedGadgets: () => RoomMemberGadget[];
	addRemoteGadget: ( memberId: string, gadget: SharedGadget ) => Promise< number >;
	removeRemoteGadget: ( gadgetId: number ) => void;
	updateRemoteGadgetHook: ( gadgetId: number, newHook: string ) => void;
}


export interface Room
{
	roomId: string;
	callbacks: ServerRoomCallbacks;
	members: RoomMember[];
}

export enum RoomMessageTypePrivate
{
	AddGadget = "AddGadget",
	RemoveGadget = "RemoveGadget",
	UpdateGadgetHook = "UpdateGadgetHook",
	UpdatePose = "UpdatePose",
}

export interface RMAddGadget extends GadgetRoomEnvelope
{
	gadgetUri: string;
	persistenceUuid: string;
	hook?: string;
}

export interface RMRemoveGadget extends GadgetRoomEnvelope
{
	persistenceUuid: string;
}

export interface RMUpdateGadgetHook extends GadgetRoomEnvelope
{
	persistenceUuid: string;
	newHook?: string;
}

export interface RMUpdatePose extends GadgetRoomEnvelope
{
	originPath: string;
	newPose: MinimalPose;
}


export function createRoom( roomId: string, callbacks: ServerRoomCallbacks ): Room
{
	return (
		{
			roomId,
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

function findGadgetIndex( member: RoomMember, persistenceUuid: string )
{
	return member.gadgets.findIndex( ( gadget: RoomMemberGadget ) =>
	{
		return gadget.persistenceUuid == persistenceUuid;
	} );
}

export function addRoomMember( room: Room, memberId: string )
{
	if( -1 != findMemberIndex( room, memberId ) )
		return;

	room.members.push(
		{
			memberId,
			gadgets: [],
			poses: {},
		} );

	// tell this new member about our gadgets
	let localGadgets = room.callbacks.getSharedGadgets();
	for( let localGadget of localGadgets )
	{
		let m: RMAddGadget =
		{
			...localGadget,
			type: RoomMessageTypePrivate.AddGadget,
			destination: memberId,
		};
		room.callbacks.sendMessage( m );
	}
}


export function removeRoomMember( room: Room, memberId: string )
{
	let i = findMemberIndex( room, memberId );
	if( i != -1 )
	{
		//console.log( "found member to remove: ", memberId );
		room.members.splice( i, 1 );
	}
	else
	{
		//console.log( "did not find member to remove", memberId );
	}
}

function assertFromRoom( message: GadgetRoomEnvelope )
{
	if( message.source != RoomMemberIdReserved.Room )
	{
		throw new Error( `Message of type ${ message.type } must have ${ RoomMemberIdReserved.Room } as its source` );
	}
}

function assertFindSourceMember( room: Room, message: GadgetRoomEnvelope )
{
	let memberIndex = findMemberIndex( room, message.source );
	if( memberIndex == -1 )
	{
		throw new Error( `Message of type ${ message.type } was from ${ message.source } who we do not know` );
	}

	return room.members[ memberIndex ];
}

export async function onRoomMessage( room: Room, message: GadgetRoomEnvelope )
{
	let member: RoomMember;
	let gadgetIndex: number;
	//console.log( "processing message ", message );
	switch( message.type )
	{
		case RoomMessageType.MemberJoined:
			assertFromRoom( message );
			let mJoined = message as RMMemberJoined;
			addRoomMember( room, mJoined.memberId );
			break;

		case RoomMessageType.MemberLeft:
			assertFromRoom( message );
			let mLeft = message as RMMemberLeft;
			removeRoomMember( room, mLeft.memberId );
			break;

		case RoomMessageTypePrivate.AddGadget:
			member = assertFindSourceMember( room, message );
			let mAddGadget = message as RMAddGadget;
			let newGadget: RoomMemberGadget = 
				{
					gadgetUri: mAddGadget.gadgetUri,
					persistenceUuid: mAddGadget.persistenceUuid,
					hook: mAddGadget.hook,
				};

			let gadgetId = await room.callbacks.addRemoteGadget( message.source, newGadget );
			newGadget.gadgetId = gadgetId;
			console.log( "addgadget ", gadgetId );
			member.gadgets.push( newGadget );
			break;

		case RoomMessageTypePrivate.RemoveGadget:
			member = assertFindSourceMember( room, message );
			let mRemoveGadget = message as RMRemoveGadget;
			gadgetIndex = findGadgetIndex( member, mRemoveGadget.persistenceUuid );
			if( gadgetIndex == -1 )
			{
				throw new Error( `Gadget ${ mRemoveGadget.persistenceUuid } does not exist on member ${ message.source }` );
			}

			room.callbacks.removeRemoteGadget( member.gadgets[ gadgetIndex ].gadgetId );
			member.gadgets.splice( gadgetIndex, 1 );
			break;

		case RoomMessageTypePrivate.UpdateGadgetHook:
			member = assertFindSourceMember( room, message );
			let mUpdateHook = message as RMUpdateGadgetHook;
			gadgetIndex = findGadgetIndex( member, mUpdateHook.persistenceUuid );
			if( gadgetIndex == -1 )
			{
				throw new Error( `Gadget ${ mUpdateHook.persistenceUuid } does not exist on member ${ message.source }` );
			}

			member.gadgets[ gadgetIndex ].hook = mUpdateHook.newHook;
			room.callbacks.updateRemoteGadgetHook( member.gadgets[ gadgetIndex ].gadgetId, 
				mUpdateHook.newHook );
			break;

		case RoomMessageTypePrivate.UpdatePose:
			member = assertFindSourceMember( room, message );
			let mUpdatePose = message as RMUpdatePose;
			member.poses[ mUpdatePose.originPath ] = mUpdatePose.newPose;
			break;
	}
}

export function destroyLocalGadget( room: Room, persistenceUuid: string )
{
	let m: RMRemoveGadget =
	{
		type: RoomMessageTypePrivate.RemoveGadget,
		destination: RoomMemberIdReserved.Broadcast,
		persistenceUuid,
	};
	room.callbacks.sendMessage( m );
}

export function updateLocalGadgetHook( room: Room, persistenceUuid: string, newHook: string )
{
	let m: RMUpdateGadgetHook =
	{
		type: RoomMessageTypePrivate.UpdateGadgetHook,
		destination: RoomMemberIdReserved.Broadcast,
		persistenceUuid,
		newHook,
	};
	room.callbacks.sendMessage( m );
}

export function updateRoomPose( room: Room, originPath: string, newPose: MinimalPose )
{
	let m: RMUpdatePose =
	{
		type: RoomMessageTypePrivate.UpdatePose,
		destination: RoomMemberIdReserved.Broadcast,
		originPath,
		newPose,
	};
	room.callbacks.sendMessage( m );
}

