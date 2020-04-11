import * as React from 'react';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvNodeType, GadgetRoomCallbacks, GadgetRoom } from '@aardvarkxr/aardvark-shared';
import { AvGadget } from './aardvark_gadget';
import bind from 'bind-decorator';
import { AvTransform } from './aardvark_transform';

interface AvRoomMemberProps extends AvBaseNodeProps
{
	/** The id of the room that this member is in. This room must have
	 * been registered with Aardvark via an AvGadget.instance()->createRoom(...) 
	 * call.
	 * 
	 * @default none
	 */
	roomId: string;

	/** The id of the room member to position at the 
	 * current transform in the scene graph. This is the
	 * same Id that the gadget sent in a MemberJoined 
	 * message
	 * 
	 * @default none
	 */
	memberId: string;
}


/** Provides the transform for a room member. The room for this member
 * must have been created with an AvGadget.instance()->createRoom(...)
 * call for this component to have any effect.
 */
export class AvRoomMember extends AvBaseNode< AvRoomMemberProps, {} >
{
	public buildNode()
	{
		let node = this.createNodeObject( AvNodeType.RoomMember, this.m_nodeId );
		node.propRoomId = this.props.roomId;
		node.propMemberId = this.props.memberId;
		return node;
	}
}

