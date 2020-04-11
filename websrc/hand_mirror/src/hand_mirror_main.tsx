import { AvGadget, AvRoomMember, AvStandardGrabbable, AvTransform, ShowGrabbableChildren } from '@aardvarkxr/aardvark-react';
import { GadgetRoom, GadgetRoomEnvelope, g_builtinModelHandMirror, RMMemberJoined, RoomMemberIdReserved, RoomMessageType } from '@aardvarkxr/aardvark-shared';
import * as React from 'react';
import * as ReactDOM from 'react-dom';


function HandMirror()
{
	const [ room, setRoom ] = React.useState<GadgetRoom>( null );

	let sendMessage = ( message: GadgetRoomEnvelope ) =>
	{
		if( !room )
			return;

		// For mirrors, just jam these message back down the pipe with the right
		// routing information
		switch( message.destination )
		{
			case "user":
				// just forward messages to the local user on unmolested
				room.onMessage( message );
				break;

			case "reflection":
				message.source = "user";
				room.onMessage( message );
				break;

			case RoomMemberIdReserved.Broadcast:
				message.source = "user";
				room.onMessage( message );
				break;

			default:
				console.log( `Mirror received message with unexpected routing ${ message }` );
				break;
		}
	}

	let onGrabStart = () =>
	{
		AvGadget.instance().createRoom( "mirror", { sendMessage } )
		.then( ( room: GadgetRoom ) =>
		{
			setRoom( room );

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
		if( room )
		{
			room.destroy();
			setRoom( null );
		}
	}

	return <AvStandardGrabbable modelUri={ g_builtinModelHandMirror } 
				showChildren= { ShowGrabbableChildren.OnlyWhenGrabbed }
				onGrab={ onGrabStart } onEndGrab={ onGrabEnd }>
					{ room && 
						<AvTransform rotateY={ 180 } uniformScale={ 0.1 }>
							<AvRoomMember roomId="mirror" memberId="reflection"/>
						</AvTransform>
					}
			</AvStandardGrabbable>;
}


ReactDOM.render( <HandMirror/>, document.getElementById( "root" ) );
