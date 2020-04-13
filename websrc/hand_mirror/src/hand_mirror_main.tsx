import { AvGadget, AvRoomMember, AvStandardGrabbable, AvTransform, ShowGrabbableChildren } from '@aardvarkxr/aardvark-react';
import { GadgetRoom, GadgetRoomCallbacks, GadgetRoomEnvelope, g_builtinModelHandMirror, RMMemberJoined, RoomMemberIdReserved, RoomMessageType } from '@aardvarkxr/aardvark-shared';
import * as React from 'react';
import * as ReactDOM from 'react-dom';


class MirrorImpl implements GadgetRoomCallbacks
{
	public room: GadgetRoom = null;
	public cancelThisRoom = false;
	
	public sendMessage( message: GadgetRoomEnvelope )
	{
		if( !this.room )
			return;

		// pretend all messages are from an illusionary user called "reflection"
		// since there's really only one user.
		message.source = "reflection";

		// For mirrors, just jam these message back down the pipe with the right
		// routing information
		switch( message.destination )
		{
			case "reflection":
				message.destination = "user";
				break;
		}

		this.room.onMessage( message );
	}
}

function HandMirror()
{
	const [ mirror, setMirror ] = React.useState<MirrorImpl>( null );
	const [ updateCount, setUpdateCount ] = React.useState( 0 );

	let onGrabStart = () =>
	{
		let newMirror = new MirrorImpl;
		setMirror( newMirror );
		AvGadget.instance().createRoom( "mirror", newMirror )
		.then( ( room: GadgetRoom ) =>
		{
			if( newMirror.cancelThisRoom )
			{
				room.destroy();
			}

			newMirror.room = room;
			setUpdateCount( updateCount + 1 );

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

	let onGrabEnd = () =>
	{
		if( mirror )
		{
			if( mirror.room )
			{
				mirror.room.destroy();
			}
			else
			{
				mirror.cancelThisRoom = true;
			}
			setMirror( null );
		}
	}

	return <AvStandardGrabbable modelUri={ g_builtinModelHandMirror } 
				showChildren= { ShowGrabbableChildren.OnlyWhenGrabbed }
				onGrab={ onGrabStart } onEndGrab={ onGrabEnd }>
					{ mirror && mirror.room && 
						<AvTransform rotateY={ 180 } uniformScale={ 0.1 }>
							<AvRoomMember roomId="mirror" memberId="reflection"/>
						</AvTransform>
					}
			</AvStandardGrabbable>;
}


ReactDOM.render( <HandMirror/>, document.getElementById( "root" ) );
