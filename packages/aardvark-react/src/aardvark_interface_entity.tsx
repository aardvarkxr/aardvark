import { AvNodeTransform, AvNodeType, EndpointAddr, endpointAddrsMatch, InterfaceLockResult, MessageType, MsgInterfaceLock, MsgInterfaceLockResponse, MsgInterfaceUnlock, MsgInterfaceUnlockResponse, AvVolume, ENodeFlags, MsgInterfaceSendEvent } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import { AvBaseNode, AvBaseNodeProps } from './aardvark_base_node';
import { AvGadget } from './aardvark_gadget';

export enum InterfaceRole
{
	Invalid,
	Transmitter,
	Receiver,
};

export interface ActiveInterface
{
	readonly peer: EndpointAddr;
	readonly interface: string;
	readonly role: InterfaceRole;
	lock():Promise<InterfaceLockResult>;
	unlock():Promise<InterfaceLockResult>;
	sendEvent( event: object ):void;
	onEnded( endedCallback:() => void ): void;
	onEvent( eventCallback:( event: object ) => void ): void;
	onTransformUpdated( transformCallback:( entityFromPeer: AvNodeTransform ) => void ): void;
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

	constructor( transmitter: EndpointAddr, receiver: EndpointAddr, iface: string, role: InterfaceRole )
	{
		this.transmitter = transmitter;
		this.receiver = receiver;
		this.iface = iface;
		this.role = role;
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

	sendEvent( event: object ):void
	{
		AvGadget.instance().sendMessage(MessageType.InterfaceSendEvent, 
			{
				destination: this.peer,
				peer: this.self,
				iface: this.iface,
				event,
			} as MsgInterfaceSendEvent );
	}

	onEnded( endedCallback:() => void ): void
	{
		this.endedCallback = endedCallback;
	}

	end()
	{
		this.endedCallback?.();
	}

	onEvent( eventCallback:( event: object ) => void ): void
	{
		this.eventCallback = eventCallback;
	}

	event( event: object )
	{
		this.eventCallback?.( event );
	}

	onTransformUpdated( transformCallback:( entityFromPeer: AvNodeTransform ) => void ): void
	{
		this.transformCallback = transformCallback;
	}

	transformUpdated( entityFromPeer: AvNodeTransform )
	{
		this.transformCallback?.( entityFromPeer );
	}
	
}


export interface InterfaceEntityProcessor
{
	( iface: ActiveInterface ): void;
}

interface AvInterfaceEntityProps extends AvBaseNodeProps
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
	transmits?: { [interfaceName: string] : InterfaceEntityProcessor };

	/** The list of interfaces that this entity receives. These can be any string of the form
	 * <interfacename>@<version>. When selecting an interface for a transmitter that is in range 
	 * of a receiver will select the first matching interface in the list, so each entity 
	 * should order its interfaces from highest to lowest priority if multiple interfaces of the 
	 * same type are available.
	 * 
	 * An entity could have any number of active received interfaces.
	 * @default []
	 */
	receives?: { [interfaceName: string] : InterfaceEntityProcessor };

	/** The volume to use when matching this entity with other interface entities. */
	volume: AvVolume;
}

/** Defines one participant in the interface system */
export class AvInterfaceEntity extends AvBaseNode< AvInterfaceEntityProps, {} >
{
	private activeInterfaces: CActiveInterface[] = [];

	public buildNode()
	{
		let node = this.createNodeObject( AvNodeType.InterfaceEntity, this.m_nodeId );

		let needProcessor = false;

		node.propTransmits = [];
		for( let interfaceName in this.props.transmits )
		{
			node.propTransmits.push( interfaceName );
			needProcessor = needProcessor || ( this.props.transmits[ interfaceName ] != null );
		}

		node.propReceives = [];
		for( let interfaceName in this.props.receives )
		{
			node.propReceives.push( interfaceName );
			needProcessor = needProcessor || ( this.props.receives[ interfaceName ] != null );
		}

		node.propVolumes = [ this.props.volume ];

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
			return [ this.props.transmits[ iface ], InterfaceRole.Transmitter ];
		}

		if( receiver.endpointId == AvGadget.instance().getEndpointId() && 
			this.m_nodeId == receiver.nodeId )
		{
			return [ this.props.receives[ iface ], InterfaceRole.Receiver ];
		}

		console.log( "getProcessor called when we weren't the transmitter or receiver" );
		return null;
	}

	@bind
	private onInterfaceStarted( transmitter: EndpointAddr, receiver: EndpointAddr, iface: string  ): void
	{
		let [ processor, role ] = this.getProcessor( transmitter, receiver, iface );
		if( processor )
		{
			let newInterface = new CActiveInterface( transmitter, receiver, iface, role );
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
	private onInterfaceEnded( transmitter: EndpointAddr, receiver: EndpointAddr, iface: string ): void
	{
		let activeInterface = this.findActiveInterface(transmitter, receiver, iface);
		if( activeInterface )
		{
			activeInterface.end();

			this.activeInterfaces.splice( this.activeInterfaces.indexOf( activeInterface ), 1 );
		}
	}

	@bind
	private onInterfaceEvent( destination: EndpointAddr, peer: EndpointAddr, iface: string, data: object ): void
	{
		let activeInterface = this.findActiveInterfaceByDest(destination, peer, iface);
		if( activeInterface )
		{
			activeInterface.event( data );
		}
	}

	@bind
	private onTransformUpdated( destination: EndpointAddr, peer: EndpointAddr, iface: string, 
		destinationFromPeer: AvNodeTransform ): void
	{
		let activeInterface = this.findActiveInterfaceByDest(destination, peer, iface);
		if( activeInterface )
		{
			activeInterface.transformUpdated( destinationFromPeer );
		}
	}
}
