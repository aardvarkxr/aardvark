import { AvNodeTransform, AvNodeType, AvVolume, EndpointAddr, endpointAddrsMatch, ENodeFlags, InitialInterfaceLock, InterfaceLockResult, invertNodeTransform, MessageType, MsgInterfaceLock, MsgInterfaceLockResponse, MsgInterfaceRelock, MsgInterfaceRelockResponse, MsgInterfaceSendEvent, MsgInterfaceSendEventResponse, MsgInterfaceUnlock, MsgInterfaceUnlockResponse, AvConstraint, AvVector, matMultiplyPoint, nodeTransformToMat4, vecFromAvVector, vecToAvVector, MsgInterfaceStarted } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvGadget } from './aardvark_gadget';

/** Indicates the role of this {@link ActiveInterface} */
export enum InterfaceRole
{
	Invalid,
	Transmitter,
	Receiver,
};

/** Represents an active interface with another node in this 
 * or another gadget
 */
export interface ActiveInterface
{
	/** The local {@link AvInterfaceEntity} node's endpoint address */
	readonly self: EndpointAddr;

	/** The remote {@link AvInterfaceEntity} node's endpoint address */
	readonly peer: EndpointAddr;

	/** The name of the interface that triggered this active interface */
	readonly interface: string;

	/** Indicates whether this is the transmit or receive end of the interface */
	readonly role: InterfaceRole;

	/** The transform from the receiver's space to the transmitter's space */
	readonly transmitterFromReceiver: AvNodeTransform;

	/** The transform from the remote node's space to the local node's space */
	readonly selfFromPeer: AvNodeTransform;

	/** The intersection point in the transmitter's space */
	readonly transmitterIntersectionPoint: AvVector;

	/** The intersection point in the local node's space */
	readonly selfIntersectionPoint: AvVector;

	/** The params object, if any, that was provided when this interface was started */
	readonly params: object;

	/** Locks the interface so moving the two nodes apart will not cause it to end. */
	lock():Promise<InterfaceLockResult>;

	/** Unlocks the interface so it can be updated to higher priority collisions or
	 * end if the nodes move apart.
	 */
	unlock():Promise<InterfaceLockResult>;

	/** Atomically unlock the interface from one receiver and lock it to another */
	relock( newReceiver: EndpointAddr ):Promise<InterfaceLockResult>;

	/** Send an event object to the remote end. The interface name should define
	 * the format of these objects.
	 */
	sendEvent( event: object ):Promise<void>;

	/** Allows the local node to provide a callback that will be invoked when the 
	 * interface ends. For locked interfaces, this will be called if the remote end
	 * goes away.
	 */
	onEnded( endedCallback:() => void ): void;

	/** Allows the local node to provide a callback that will be invoked when the
	 * remote end sends an event. The interface name should define the format of
	 * these objects.
	 */
	onEvent( eventCallback:( event: object ) => void ): void;

	/** Allows the local node to provide a callback that will be invoked when the
	 * transform between the local and remote node has changed. This will only
	 * be called for interfaces with the wantsTransforms field set to true.
	 */
	onTransformUpdated( transformCallback:( entityFromPeer: AvNodeTransform ) => void ): void;

	/** The origin of the gadget that provided the peer to this active interface. */
	readonly origin: string;

	/** The user agent of the gadget that provided the peer to this active interface. */
	readonly userAgent: string;
}


class CActiveInterface implements ActiveInterface
{
	public transmitter: EndpointAddr;
	public receiver: EndpointAddr;
	public iface: string;
	public role: InterfaceRole;
	private endedCallback:() => void;
	private eventCallback:( event: object ) => void;
	private transformCallback:( entityFromPeer: AvNodeTransform ) => void;
	private lastTransmitterFromReceiver: AvNodeTransform;
	private lastTransmitterIntersectionPoint: AvVector;
	public params: object;
	private peerOrigin: string;
	private peerUserAgent: string;

	constructor( m: MsgInterfaceStarted, role: InterfaceRole )
	{
		this.transmitter = m.transmitter;
		this.receiver = m.receiver;
		this.iface = m.iface;
		this.lastTransmitterFromReceiver = m.transmitterFromReceiver;
		this.lastTransmitterIntersectionPoint = m.intersectionPoint;
		this.role = role;
		this.params = m.params;
		if( this.role == InterfaceRole.Transmitter )
		{
			this.peerOrigin = m.receiverOrigin;
			this.peerUserAgent = m.receiverUserAgent;
		}
		else
		{
			this.peerOrigin = m.transmitterOrigin;
			this.peerUserAgent = m.transmitterUserAgent;
		}
	}

	public lock(): Promise<InterfaceLockResult>
	{
		return new Promise<InterfaceLockResult>( async (resolve, reject ) =>
		{
			let [ msgResponse ] = await AvGadget.instance().sendMessageAndWaitForResponse<MsgInterfaceLockResponse>(
				MessageType.InterfaceLock, 
				{
					transmitter: this.transmitter,
					receiver: this.receiver,
					iface: this.iface
				} as MsgInterfaceLock,
				MessageType.InterfaceLockResponse );
			resolve( msgResponse.result )
		} );
	}

	public unlock(): Promise<InterfaceLockResult>
	{
		return new Promise<InterfaceLockResult>( async (resolve, reject ) =>
		{
			let [ msgResponse ] = await AvGadget.instance().sendMessageAndWaitForResponse<MsgInterfaceUnlockResponse>(
				MessageType.InterfaceUnlock, 
				{
					transmitter: this.transmitter,
					receiver: this.receiver,
					iface: this.iface
				} as MsgInterfaceUnlock,
				MessageType.InterfaceUnlockResponse );
			resolve( msgResponse.result )
		} );
	}

	public relock( newReceiver: EndpointAddr ): Promise<InterfaceLockResult>
	{
		return new Promise<InterfaceLockResult>( async (resolve, reject ) =>
		{
			let [ msgResponse ] = await AvGadget.instance().sendMessageAndWaitForResponse<MsgInterfaceRelockResponse>(
				MessageType.InterfaceRelock, 
				{
					transmitter: this.transmitter,
					oldReceiver: this.receiver,
					newReceiver,
					iface: this.iface
				} as MsgInterfaceRelock,
				MessageType.InterfaceRelockResponse );
			resolve( msgResponse.result )
		} );
	}

	public get self(): EndpointAddr
	{
		return this.role == InterfaceRole.Transmitter ? this.transmitter : this.receiver;
	}

	public get peer(): EndpointAddr
	{
		return this.role == InterfaceRole.Receiver ? this.transmitter : this.receiver;
	}
	
	public get interface() : string
	{
		return this.iface;
	}

	public get transmitterFromReceiver() : AvNodeTransform
	{
		return this.lastTransmitterFromReceiver;
	}

	public get selfFromPeer() : AvNodeTransform
	{
		if( this.role == InterfaceRole.Transmitter )
		{
			return this.lastTransmitterFromReceiver;
		}
		else
		{
			return invertNodeTransform( this.lastTransmitterFromReceiver );
		}
	}

	public get transmitterIntersectionPoint() : AvVector
	{
		return this.lastTransmitterIntersectionPoint;
	}

	public get selfIntersectionPoint() : AvVector
	{
		if( this.role == InterfaceRole.Transmitter )
		{
			return this.lastTransmitterIntersectionPoint;
		}
		else if( this.lastTransmitterIntersectionPoint )
		{
			let matTransmitterFromReceiver = nodeTransformToMat4( this.selfFromPeer );
			let receiverIntersectionPoint = matMultiplyPoint( matTransmitterFromReceiver, 
				vecFromAvVector( this.lastTransmitterIntersectionPoint ) );
			return vecToAvVector( receiverIntersectionPoint );
		}
		else
		{
			return null;
		}
	}

	public get origin(): string
	{
		return this.peerOrigin;
	}

	public get userAgent(): string
	{
		return this.peerUserAgent;
	}


	sendEvent( event: object ): Promise<void>
	{
		return new Promise<void>( async (resolve, reject ) =>
		{
			let [ msgResponse ] = await AvGadget.instance().sendMessageAndWaitForResponse<MsgInterfaceSendEventResponse>(
				MessageType.InterfaceSendEvent, 
				{
					destination: this.peer,
					peer: this.self,
					iface: this.iface,
					event
				} as MsgInterfaceSendEvent,
				MessageType.InterfaceSendEventResponse );
			resolve();
		} );
	}

	onEnded( endedCallback:() => void ): void
	{
		this.endedCallback = endedCallback;
	}

	end( transmitterFromReceiver : AvNodeTransform, intersectionPoint: AvVector )
	{
		if( transmitterFromReceiver )
		{
			this.lastTransmitterFromReceiver = transmitterFromReceiver;
		}
		this.endedCallback?.();
	}

	onEvent( eventCallback:( event: object ) => void ): void
	{
		this.eventCallback = eventCallback;
	}

	event( event: object, destinationFromPeer: AvNodeTransform, intersectionPoint: AvVector )
	{
		if( destinationFromPeer )
		{
			if( this.role == InterfaceRole.Transmitter )
			{
				this.lastTransmitterFromReceiver = destinationFromPeer;
				this.lastTransmitterIntersectionPoint = intersectionPoint;
			}
			else
			{
				this.lastTransmitterFromReceiver = invertNodeTransform( destinationFromPeer );

				if( intersectionPoint )
				{
					let matTransmitterFromReceiver = nodeTransformToMat4( this.lastTransmitterFromReceiver );
					this.lastTransmitterIntersectionPoint = matMultiplyPoint( matTransmitterFromReceiver, 
						vecFromAvVector( intersectionPoint ) );	
				}
				else
				{
					this.lastTransmitterIntersectionPoint = null;
				}
			}
		}

		this.eventCallback?.( event );
	}

	onTransformUpdated( transformCallback:( entityFromPeer: AvNodeTransform ) => void ): void
	{
		this.transformCallback = transformCallback;
	}

	transformUpdated( entityFromPeer: AvNodeTransform, intersectionPoint: AvVector )
	{
		if( this.role == InterfaceRole.Transmitter )
		{
			this.lastTransmitterFromReceiver = entityFromPeer;
			this.lastTransmitterIntersectionPoint = intersectionPoint;
		}
		else
		{
			this.lastTransmitterFromReceiver = invertNodeTransform( entityFromPeer );

			if( intersectionPoint )
			{
				let matTransmitterFromReceiver = nodeTransformToMat4( this.lastTransmitterFromReceiver );
				this.lastTransmitterIntersectionPoint = matMultiplyPoint( matTransmitterFromReceiver, 
					vecFromAvVector( intersectionPoint ) );
			}
			else
			{
				this.lastTransmitterIntersectionPoint = null;
			}
		}
		this.transformCallback?.( entityFromPeer );
	}
}


/** Defines the function signature of an interface handler for {@link InterfaceProp} */
export interface InterfaceEntityProcessor
{
	( iface: ActiveInterface ): void;
}

/** Represents a single interface in the transmit or receive list for an 
 * {@link AvInterfaceEntity}
 */
export interface InterfaceProp
{
	iface: string;
	processor?: InterfaceEntityProcessor;
}

/** Props for {@link AvInterfaceEntity} */
export interface AvInterfaceEntityProps extends AvBaseNodeProps
{
	/** The address of the parent entity that will provide the transform
	 * for this node. If this is not specified, this node must be under an
	 * AvOrigin node or it will not be displayed. If the node provided via
	 * this property does not provide an AvChild node that refers to this entity
	 * or if that child is not visible, this entity will not be displayed.
	 * 
	 * @default none
	 */
	parent?: EndpointAddr;

	/** Instructs Aardvark to provide this entity with a stream of updated 
	 * transforms for any active interfaces that involve this entity.
	 * 
	 * @default false
	 */
	wantsTransforms?: boolean;

	/** The list of interfaces that this entity transmits. These can be any string of the form
	 * <interfacename>@<version>. When selecting an interface for a transmitter that is in range 
	 * of a receiver will select the first matching interface in the list, so each entity 
	 * should order its interfaces from highest to lowest priority if multiple interfaces of the 
	 * same type are available.
	 * 
	 * At most one of these interfaces will be active at a time.
	 * 
	 * @default []
	 */
	transmits?: InterfaceProp[];

	/** The list of interfaces that this entity receives. These can be any string of the form
	 * <interfacename>@<version>. When selecting an interface for a transmitter that is in range 
	 * of a receiver will select the first matching interface in the list, so each entity 
	 * should order its interfaces from highest to lowest priority if multiple interfaces of the 
	 * same type are available.
	 * 
	 * An entity could have any number of active received interfaces.
	 * @default []
	 */
	receives?: InterfaceProp[];

	/** The priority to use when breaking ties among multiple simultaneous intersections for the same entity.
	 * Higher numbers are chosen before lower numbers.
	 * 
	 * @default 0
	 */
	priority?: number;

	/** The volume to use when matching this entity with other interface entities. */
	volume: AvVolume | AvVolume[];

	/** A list of interface names and receivers that Aardvark should force this entity to 
	 * have an interface with when it is created. Each of these initial interfaces must be
	 * included in this entity's transmitter list. Both the receiver and and transmitter will
	 * receive InterfaceStarted events with the new interface. This new active interface starts
	 * locked, so the transmitter will need to unlock it if it wants to return its transmitter to
	 * a floating state.
	 * 
	 * If the endpoint address specified an initial lock does not exist, the active interface will receive 
	 * an InterfaceEnded event. This non-functional interface will still be locked, and the transmitter
	 * on this active interface will not start any new interfaces until it calls unlock.
	 * 
	 * @default []
	 */
	interfaceLocks?: InitialInterfaceLock[];

	/** Sets the constraint to apply to this node's transform before applying the
	 * parent transform. Using constraints without a parent may have unexpected results.
	 * 
	 * @default none
	 */
	constraint?: AvConstraint;
}

/** Defines one participant in the interface system */
export class AvInterfaceEntity extends AvBaseNode< AvInterfaceEntityProps, {} >
{
	private activeInterfaces: CActiveInterface[] = [];

	/** @hidden */
	public buildNode()
	{
		let node = this.createNodeObject( AvNodeType.InterfaceEntity, this.m_nodeId );

		let needProcessor = false;

		node.propTransmits = [];
		for( let interfaceProp of this.props.transmits ?? [] )
		{
			node.propTransmits.push( interfaceProp.iface );
			needProcessor = needProcessor || ( interfaceProp.processor != null );
		}

		node.propReceives = [];
		for( let interfaceProp of this.props.receives ?? [] )
		{
			node.propReceives.push( interfaceProp.iface );
			needProcessor = needProcessor || ( interfaceProp.processor != null );
		}

		if( Array.isArray( this.props.volume ) )
		{
			node.propVolumes = this.props.volume;
		}
		else
		{
			node.propVolumes = [ this.props.volume ];
		}
		node.propParentAddr = this.props.parent;
		node.propConstraint = this.props.constraint;
		node.propPriority = this.props.priority;
		
		for( let interfaceLock of ( this.props.interfaceLocks ?? [] ) )
		{
			let foundIt = false;
			for( let transmitter of this.props.transmits ?? [] )
			{
				if( interfaceLock.iface == transmitter.iface )
				{
					foundIt = true;
					break;
				}				
			}
			if( !foundIt )
			{
				throw new Error( `Entity included an initial interface ${ interfaceLock.iface } but does not `
					+ `transmit that interface` );
			}
		}
		node.propInterfaceLocks = this.props.interfaceLocks;

		if( this.props.wantsTransforms )
		{
			node.flags |= ENodeFlags.NotifyOnTransformChange;
		}

		if( needProcessor )
		{
			AvGadget.instance().setInterfaceEntityProcessor( this.m_nodeId, 
				{
					started: this.onInterfaceStarted,
					ended: this.onInterfaceEnded,
					event: this.onInterfaceEvent,
					transformUpdated: this.onTransformUpdated,
				} );
		}

		return node;
	}

	private getProcessor( transmitter: EndpointAddr, receiver: EndpointAddr, iface: string ) 
		: [ InterfaceEntityProcessor, InterfaceRole ]
	{
		if( transmitter.endpointId == AvGadget.instance().getEndpointId() && 
			this.m_nodeId == transmitter.nodeId )
		{
			for( let interfaceProp of this.props.transmits )
			{
				if( interfaceProp.iface == iface )
				{
					return [ interfaceProp.processor, InterfaceRole.Transmitter ];
				}
			}
		}

		if( receiver.endpointId == AvGadget.instance().getEndpointId() && 
			this.m_nodeId == receiver.nodeId )
		{
			for( let interfaceProp of this.props.receives )
			{
				if( interfaceProp.iface == iface )
				{
					return [ interfaceProp.processor, InterfaceRole.Receiver ];
				}
			}
		}

		console.log( "getProcessor called when we weren't the transmitter or receiver" );
		return [ null, InterfaceRole.Invalid ];
	}

	@bind
	private onInterfaceStarted( m: MsgInterfaceStarted  ): void
	{
		let [ processor, role ] = this.getProcessor( m.transmitter, m.receiver, m.iface );
		if( processor )
		{
			let newInterface = new CActiveInterface( m, role );
			this.activeInterfaces.push( newInterface );
			processor( newInterface );
		}
	}

	private findActiveInterface(transmitter: EndpointAddr, receiver: EndpointAddr, iface: string )
	{
		for( let i of this.activeInterfaces )
		{
			if( endpointAddrsMatch( i.transmitter, transmitter )
				&& endpointAddrsMatch( i.receiver, receiver )
				&& iface == i.iface )
			{
				return i;				
			}
		}

		return null;
	}

	private findActiveInterfaceByDest( destination: EndpointAddr, peer: EndpointAddr, iface: string )
	{
		for( let i of this.activeInterfaces )
		{
			if( endpointAddrsMatch( i.self, destination )
				&& endpointAddrsMatch( i.peer, peer )
				&& iface == i.iface )
			{
				return i;				
			}
		}

		return null;
	}

	@bind
	private onInterfaceEnded( transmitter: EndpointAddr, receiver: EndpointAddr, iface: string,
		transmitterFromReceiver: AvNodeTransform, intersectionPoint?: AvVector ): void
	{
		let activeInterface = this.findActiveInterface(transmitter, receiver, iface);
		if( activeInterface )
		{
			activeInterface.end( transmitterFromReceiver, intersectionPoint );

			this.activeInterfaces.splice( this.activeInterfaces.indexOf( activeInterface ), 1 );
		}
	}

	@bind
	private onInterfaceEvent( destination: EndpointAddr, peer: EndpointAddr, iface: string, data: object,
		destinationFromPeer: AvNodeTransform, intersectionPoint?: AvVector ): void
	{
		let activeInterface = this.findActiveInterfaceByDest(destination, peer, iface);
		if( activeInterface )
		{
			activeInterface.event( data, destinationFromPeer, intersectionPoint );
		}
	}

	@bind
	private onTransformUpdated( destination: EndpointAddr, peer: EndpointAddr, iface: string, 
		destinationFromPeer: AvNodeTransform, intersectionPoint?: AvVector ): void
	{
		let activeInterface = this.findActiveInterfaceByDest(destination, peer, iface);
		if( activeInterface )
		{
			activeInterface.transformUpdated( destinationFromPeer, intersectionPoint );
		}
	}
}
