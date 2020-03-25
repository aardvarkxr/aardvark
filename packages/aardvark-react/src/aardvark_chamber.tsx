import * as React from 'react';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvNodeType, AvColor, EndpointAddr, ChamberNamespace, AvNodeTransform } from '@aardvarkxr/aardvark-shared';
import { AvGadget, ChamberMemberListHandler } from './aardvark_gadget';
import bind from 'bind-decorator';
import { AvTransform } from './aardvark_transform';

interface AvChamberMemberProps extends AvBaseNodeProps
{
	/** The uuid of the chamber member to position at the 
	 * current transform in the scene graph.
	 * 
	 * @default none
	 */
	memberUuid: string;
}


/** Provides the transform for a chamber member. This node must be inside of 
 * an AvChamber node to have any effect.
 */
export class AvChamberMember extends AvBaseNode< AvChamberMemberProps, {} >
{
	public buildNode()
	{
		let node = this.createNodeObject( AvNodeType.ChamberMember, this.m_nodeId );
		node.propChamberMemberUuid = this.props.memberUuid;
		return node;
	}
}

interface AvChamberProps extends AvBaseNodeProps
{
	/** The id to use for this chamber. With the provided namespace,
	 * This identifies which shared chamber to join.
	 * 
	 * @default none
	 */
	chamberId: string;

	/** The namespace that the provided ID should be used within. 
	 * Chamber IDs are either gadget URL-wide or unique to the specific
	 * persistent UUID of the gadget. (That latter namespace is really only
	 * useful if the "UUID" of the gadget is actually a constant that multiple
	 * users would have.)
	 * 
	 * @default ChamberNamespace.GadgetClass
	 */
	namespace: ChamberNamespace;

	/** This function is called whenever the list of members in the chamber 
	 * changes. The component that owns the AvChamber should render AvChamberMember
	 * components for each member in this list that they want to 
	 */
	memberListHandler: ChamberMemberListHandler;

	/** If this is true, the chamber will show the local user as one of the 
	 * members. It is up to the implementor of memberListHandler to render 
	 * an AvChamberMember component for the local user.
	 * 
	 * @default false
	 */
	showSelf?: boolean;
}


/** Provides the transform for a chamber member. This node must be inside of 
 * an AvChamber node to have any effect.
 */
export class AvChamber extends AvBaseNode< AvChamberProps, {} >
{
	public componentDidMount()
	{
		AvGadget.instance().joinChamber( this.props.chamberId, this.props.namespace, 
			this.props.memberListHandler, this.props.showSelf );
	}

	public componentWillUnmount()
	{
		AvGadget.instance().leaveChamber( this.props.chamberId, this.props.namespace );
	}

	public buildNode()
	{
		let node = this.createNodeObject( AvNodeType.Chamber, this.m_nodeId );
		node.propChamberId = this.props.chamberId;
		node.propChamberNamespace = this.props.namespace;
		return node;
	}
}


interface AvDefaultChamberProps
{
	/** The id to use for this chamber. With the provided namespace,
	 * This identifies which shared chamber to join.
	 * 
	 * @default none
	 */
	chamberId: string;
}


interface AvDefaultChamberMember
{
	uuid: string;
	x: number;
	z: number;
	rotY: number;
}

interface AvDefaultChamberState
{
	members: AvDefaultChamberMember[];
}

/** Provides the transform for a chamber member. This node must be inside of 
 * an AvChamber node to have any effect.
 */
export class AvDefaultChamber extends React.Component< AvDefaultChamberProps, AvDefaultChamberState >
{
	constructor( props: any )
	{
		super( props );
		this.state = { members: [] };
	}

	@bind
	private onMemberListUpdated( chamberId: string, members: string[] )
	{
		if( !members.length )
		{
			// don't bother setting positions for no members
			return;
		}

		let stateMembers: AvDefaultChamberMember[] = [];
		let localUserIndex = members.indexOf( AvGadget.instance().localUserInfo.userUuid );
		for( let n = 0; n < members.length; n++ )
		{
			// don't send a position for the actual local user
			if( n == localUserIndex )
				continue;

			let rotationIndex = ( n - localUserIndex + members.length ) % members.length;
			let yRotRadians = rotationIndex * 360 / members.length;

			const circleRadius = 0.5;

			stateMembers.push(
				{
					uuid: members[ n ],
					x: circleRadius * Math.sin( yRotRadians ),
					z: circleRadius * ( 1 - Math.cos( yRotRadians ) ),
					rotY: yRotRadians,
				}
			);
		}

		this.setState( { members: stateMembers } );
	}

	public render()
	{
		let members: JSX.Element[] = [];
		for( let mem of this.state.members )
		{
			members.push( <AvTransform key={ mem.uuid } 
				translateX={ mem.x } translateZ={ mem.z }
				rotateY={ mem.rotY } >
					<AvChamberMember memberUuid={ mem.uuid } />
				</AvTransform> );
		}

		return <AvChamber chamberId={ this.props.chamberId } 
					namespace={ ChamberNamespace.GadgetClass}
					memberListHandler={ this.onMemberListUpdated }>
						{ members }
				</AvChamber>;
	}
}


interface AvMirrorProps
{
	/** The id to use for the mirror associated with the chamber. This only needs 
	 * to be unique within the gadget.
	 * 
	 * @default "mirror"
	 */
	mirrorId?: string;
}


/** Causes the user to enter a chamber that reflects their own shared gadgets back to them.
 * 
 * This component does not apply any kind of transform to the mirror. Whatever includes the component
 * should apply the transform it wants on top of the AvMirror.
 */
export class AvMirror extends React.Component< AvMirrorProps, {} >
{
	constructor( props: any )
	{
		super( props );
	}

	@bind
	private onMemberListUpdated( chamberId: string, members: string[] )
	{
		// we know our own uuid, so there's nothing to do here
	}

	public render()
	{
		return <AvChamber chamberId={ this.props.mirrorId ?? "mirror" } 
					namespace={ ChamberNamespace.GadgetInstance }
					showSelf={ true }
					memberListHandler={ this.onMemberListUpdated }>
					<AvChamberMember memberUuid={ AvGadget.instance().localUserInfo.userUuid } />
				</AvChamber>;
	}
}
