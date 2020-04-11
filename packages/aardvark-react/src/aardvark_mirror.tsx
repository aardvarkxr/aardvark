import { GadgetRoom, GadgetRoomCallbacks, GadgetRoomEnvelope, RMMemberJoined, RoomMemberIdReserved, RoomMessageType } from '@aardvarkxr/aardvark-shared';
import * as React from 'react';
import { AvGadget } from './aardvark_gadget';
import { AvRoomMember } from './aardvark_room';


interface AvMirrorProps
{
	/** The id to use for the mirror associated with the chamber. This only needs 
	 * to be unique within the gadget.
	 * 
	 * @default "mirror"
	 */
	mirrorId?: string;
}


interface AvMirrorState
{
	room: GadgetRoom;
}

/** Causes the user to enter a chamber that reflects their own shared gadgets back to them.
 * 
 * This component does not apply any kind of transform to the mirror. Whatever includes the component
 * should apply the transform it wants on top of the AvMirror.
 */
export class AvMirror extends React.Component< AvMirrorProps, AvMirrorState > 
	implements GadgetRoomCallbacks
{
	constructor( props: any )
	{
		super( props );
	}

	public componentDidMount()
	{
		if( !AvGadget.instance().isRemote )
		{
			AvGadget.instance().createRoom( this.props.mirrorId ?? "mirror", this )
			.then( ( room: GadgetRoom ) =>
			{
				this.setState( { room } );

				let msg: RMMemberJoined =
				{
					type: RoomMessageType.MemberJoined,
					destination: "user",
					source: RoomMemberIdReserved.Room,
					memberId: "reflection",
				}
				room.onMessage( msg );
			} );	
		}
	}
	
	public componentWillUnmount()
	{
		if( this.state.room )
		{
			this.state.room.destroy();
		}
	}

	sendMessage( message: GadgetRoomEnvelope ): void
	{
		// For mirrors, just jam these message back down the pipe with the right
		// routing information
		switch( message.destination )
		{
			case "user":
				// just forward messages to the local user on unmolested
				this.state.room.onMessage( message );
				break;

			case "reflection":
				message.source = "user";
				this.state.room.onMessage( message );
				break;

			case RoomMemberIdReserved.Broadcast:
				message.source = "user";
				this.state.room.onMessage( message );
				break;

			default:
				console.log( `Mirror received message with unexpected routing ${ message }` );
				break;
		}
	}

	public render()
	{
		if( !this.state.room )
			return null;

		return <AvRoomMember roomId={ this.props.mirrorId ?? "mirror" } 
					memberId="reflection"/>;
	}
}
