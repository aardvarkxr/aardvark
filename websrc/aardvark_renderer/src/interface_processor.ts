import { matMultiplyPoint, EndpointAddr, endpointAddrsMatch, endpointAddrToString, EVolumeContext, InitialInterfaceLock, InterfaceLockResult, Device, stringToEndpointAddr, EVolumeType } from '@aardvarkxr/aardvark-shared';
import { mat4, vec3 } from '@tlaukkan/tsm';
import { volumeMatchesContext, TransformedVolume, volumesIntersect } from './volume_intersection';

export interface InterfaceProcessorCallbacks
{
	interfaceStarted( transmitter: EndpointAddr, receiver: EndpointAddr, iface: string,
		transmitterFromReceiver: [mat4, vec3], params?: object, reason?: string ):void;
	interfaceEnded( transmitter: EndpointAddr, receiver: EndpointAddr, iface: string,
		transmitterFromReceiver?: [mat4, vec3], reason?: string ):void;
	interfaceTransformUpdated( destination: EndpointAddr, peer: EndpointAddr, iface: string, 
		destinationFromPeer: [mat4, vec3], reason?: string ): void;
	interfaceEvent( destination: EndpointAddr, peer: EndpointAddr, iface: string, event: object,
		destinationFromPeer: [mat4, vec3], reason?: string ): void;
}

export interface InterfaceEntity
{
	readonly epa: EndpointAddr;
	readonly transmits: string[];
	readonly receives: string[];
	readonly universeFromEntity: mat4;
	readonly volumes: TransformedVolume[];
	readonly originPath: string;
	readonly wantsTransforms: boolean;
	readonly initialLocks: InitialInterfaceLock[];

	/** High numbers are selected before low numbers if multiple volumes match. */
	readonly priority: number;
}

interface InterfaceInProgress
{
	transmitter: EndpointAddr;
	receiver: EndpointAddr;
	iface: string;
	locked: boolean;
	transmitterWantsTransforms: boolean;
	receiverWantsTransforms: boolean;
	refreshTransforms: boolean;
	hasRealVolumes: boolean;
	emptyVolumeSource?: string;
}

export function findBestInterface( transmitter: InterfaceEntity, receiver: InterfaceEntity ): string | null
{
	for( let transmitterInterface of transmitter.transmits )
	{
		if( receiver.receives.includes( transmitterInterface ) )
		{
			return transmitterInterface;
		}
	}

	return null;
}

function hasRealVolume( ep: InterfaceEntity, context: EVolumeContext ) : [ boolean, string ]
{
	let bestSource: string = "gadget";
	for( let v of ep.volumes )
	{
		if( !volumeMatchesContext( v, context ) )
			continue;

		if( v.type != EVolumeType.Empty )
			return [ true, undefined ];

		if( v.source )
		{
			bestSource = v.source
		}
	}

	return [ false, bestSource ];
}


function pairHasRealVolume( transmitter: InterfaceEntity, receiver: InterfaceEntity, context: EVolumeContext )
	: [ boolean, string ]
{
	const [ tr, ts ] = hasRealVolume( transmitter, context );	
	const [ rr, rs ] = hasRealVolume( receiver, context );	
	if( tr && rr )
	{
		return [ true, undefined ];
	}

	if( tr && !rr )
	{
		return [ false, "receiver." + rs ];
	}
	else if( rr ) // && !tr
	{
		return [ false, "transmitter." + ts ];
	}
	else // neither
	{
		return [ false, "transmitter." + ts + " + receiver." + rs ];
	}
}

function entitiesIntersect( transmitter: InterfaceEntity, receiver: InterfaceEntity, context: EVolumeContext ):
	[ boolean, null | vec3 ]
{
	for( let tv of transmitter.volumes )
	{
		for( let rv of receiver.volumes )
		{
			const [ i, pt ] = volumesIntersect( tv, rv, context );
			if( i )
				return [i, pt ];
		}
	}

	return [ false, null ];
}

class InterfaceEntityMap
{
	private entities: { [ epa: string ] : InterfaceEntity } = {};

	constructor( entities: InterfaceEntity[] )
	{
		for( let entity of entities )
		{
			this.set( entity );
		}
	}

	public find( epa: EndpointAddr )
	{
		return this.entities[ endpointAddrToString( epa ) ];
	}

	public set( entity: InterfaceEntity )
	{
		this.entities[ endpointAddrToString( entity.epa ) ] = entity;
	}

	public has( epa: EndpointAddr )
	{
		return this.entities.hasOwnProperty( endpointAddrToString( epa ) );
	}
}

class TransmitterInUseMap
{
	private iipMap: { [key: string ]: InterfaceInProgress| boolean } = {};

	private makeKey( transmitterEpa: EndpointAddr, iface: string )
	{
		return `${ endpointAddrToString( transmitterEpa ) }/${ iface }`;
	}

	public set( transmitterEpa: EndpointAddr, iface: string, iip: InterfaceInProgress| boolean )
	{
		this.iipMap[ this.makeKey( transmitterEpa, iface )] = iip;
	}

	public find( transmitterEpa: EndpointAddr, iface: string )
	{
		return this.iipMap[ this.makeKey( transmitterEpa, iface ) ];
	}

	public has( transmitterEpa: EndpointAddr, iface: string )
	{
		return this.iipMap.hasOwnProperty( this.makeKey( transmitterEpa, iface ) );
	}
}


export interface InterfaceProcessorOptions
{
	verboseLogging: boolean;
}

export class CInterfaceProcessor
{
	private interfacesInProgress: InterfaceInProgress[] = [];
	private lostLockedInterfaces = new Map<string, InterfaceInProgress>();
	private callbacks: InterfaceProcessorCallbacks;
	private lastEntityMap: InterfaceEntityMap;
	private options: InterfaceProcessorOptions;

	constructor( callbacks: InterfaceProcessorCallbacks, options?: InterfaceProcessorOptions )
	{
		this.callbacks = callbacks;
		this.options = options ??
		{
			verboseLogging: false,
		};
	}

	private log( msg: string, ...args: any[] )
	{
		if( this.options.verboseLogging )
		{
			console.log( msg, ...args );
		}
	}

	public processFrame( entities: InterfaceEntity[]  )
	{
		let entityMap = new InterfaceEntityMap( entities );

		// Start interfaces from the initial interface list of new entities
		for( let transmitter of entities )
		{
			// we only do this the very first frame we see an entity
			if( this.lastEntityMap?.has( transmitter.epa ) )
			{
				continue;
			}

			for( let initialLock of transmitter.initialLocks )
			{
				let receiver = entityMap.find( initialLock.receiver );
				let transmitterFromReceiver = this.computeEntityTransform( transmitter, receiver );
				this.callbacks.interfaceStarted( transmitter.epa, initialLock.receiver, initialLock.iface, 
					transmitterFromReceiver, initialLock.params, "Initial lock" );
				
				const [ hasRealVolumes, emptyVolumeSource ] = 
					pairHasRealVolume( transmitter, receiver, EVolumeContext.StartOnly );
				let iip: InterfaceInProgress =
				{
					transmitter: transmitter.epa,
					receiver: initialLock.receiver,
					iface: initialLock.iface,
					locked: true,
					transmitterWantsTransforms: transmitter.wantsTransforms,
					receiverWantsTransforms: receiver?.wantsTransforms ?? false,
					refreshTransforms: false,
					hasRealVolumes,
					emptyVolumeSource,
				};

				if( receiver && receiver.receives.includes( initialLock.iface ) )
				{
					// we actually know this receiver, so this new forced interface/lock goes on the
					// active list
					this.interfacesInProgress.push( iip );
				}
				else
				{
					// There is no such receiver, so the interface is immediately lost. Because of
					// the implied lock, it goes into our lost lock list
					this.callbacks.interfaceEnded( transmitter.epa, initialLock.receiver, 
						initialLock.iface, undefined, "No such receiver (initial lock)" );
					this.lostLockedInterfaces.set( endpointAddrToString( transmitter.epa ), iip );
				}
			}
		}

		// end interfaces where one end or the other is gone
		let transmittersInUse = new TransmitterInUseMap();
		let newInterfacesInProgress: InterfaceInProgress[] = []
		for( let iip of this.interfacesInProgress )
		{
			// if a transmitter goes away, the interface goes away
			let transmitter = entityMap.find( iip.transmitter );
			if( !transmitter || !transmitter.transmits.includes( iip.iface ) )
			{
				this.callbacks.interfaceEnded(iip.transmitter, iip.receiver, iip.iface, undefined,
					"Lost transmitter" );
				continue;
			}

			// if a receiver goes away we will also report that
			// the interface has ended, but if the interface was
			// locked, we need to keep the transmitter from starting
			// any new interfaces until it's unlocked
			let receiver = entityMap.find( iip.receiver );
			if( !receiver || !receiver.receives.includes( iip.iface ) )
			{
				// console.log( "receiver no longer exists or lost iface", receiver );
				this.callbacks.interfaceEnded(iip.transmitter, iip.receiver, iip.iface, undefined,
					"Lost receiver" + ( iip.locked ? " (locked)" : "" ) );
				this.log( `interface end (no receiver/iface) ${ endpointAddrToString( transmitter.epa ) } `
					+` to ${ endpointAddrToString( iip.receiver ) } for ${ iip.iface }` );
				if( iip.locked )
				{
					//this.log( "adding lost lock to list for " + endpointAddrToString( iip.transmitter ) );
					this.lostLockedInterfaces.set( endpointAddrToString( iip.transmitter ), iip );
				}
				continue;
			}

			// if the iip isn't locked, we need to check that the volumes still exist and still
			// intersect
			if( !iip.locked )
			{
				const [ int, pt ] = entitiesIntersect( transmitter, receiver, EVolumeContext.ContinueOnly );
				if ( !int )
				{
					this.log( `interface end (no intersect) ${ endpointAddrToString( transmitter.epa ) } `
						+` to ${ endpointAddrToString( receiver.epa ) } for ${ iip.iface }` );
					this.callbacks.interfaceEnded( iip.transmitter, iip.receiver, iip.iface,
						this.computeEntityTransform( transmitter, receiver ), "no intersect" );
					continue;
				}

				if( !shouldAllowMatch( transmitter, receiver ) )
				{
					this.log( `interface end (matching origins) ${ endpointAddrToString( transmitter.epa ) } `
						+` to ${ endpointAddrToString( receiver.epa ) } for ${ iip.iface }` );
					this.callbacks.interfaceEnded( iip.transmitter, iip.receiver, iip.iface,
						this.computeEntityTransform( transmitter, receiver ), "match disallowed" );
					continue;
				}
			}

			iip.transmitterWantsTransforms = transmitter.wantsTransforms;
			iip.receiverWantsTransforms = receiver.wantsTransforms;

			const [ hasRealVolumes, emptyVolumeSource ] = 
				pairHasRealVolume( transmitter, receiver, EVolumeContext.StartOnly );

			iip.hasRealVolumes = hasRealVolumes;
			iip.emptyVolumeSource = emptyVolumeSource;

			transmittersInUse.set( iip.transmitter, iip.iface, iip );
			newInterfacesInProgress.push( iip );
		}

		// lost locks count as "in use" so they won't trigger new interfaces
		for( let transmitterEpaString of this.lostLockedInterfaces.keys() )
		{
			let iip = this.lostLockedInterfaces.get( transmitterEpaString );
			transmittersInUse.set( iip.transmitter, iip.iface, false );
		}

		// Look for new interfaces
		for ( let transmitter of entities )
		{
			if( transmitter.transmits.length == 0 )
			{
				// this entity isn't transmitting anything
				continue;
			}

			for( let iface of transmitter.transmits )
			{
				let currentIip	= transmittersInUse.find( transmitter.epa, iface );

				//console.log( "current iip", currentIip );
				if( typeof currentIip == "boolean" || ( currentIip && currentIip.locked ) )
				{
					// This interface was locked. Wait for the unlock before changing anything
					continue;
				}

				let bestReceiver: InterfaceEntity;
				let bestPt: vec3;
				for( let receiver of entities )
				{
					if( transmitter == receiver )
					{
						// you can't interface with yourself
						continue;
					}

					if( !shouldAllowMatch( transmitter, receiver ) )
					{
						// right hand can't interface with stuff that's also 
						// on the right hand, etc.

						// This rule does not apply to entities that originate on the stage because they aren't
						// moving around the way that hands and the head are.
						continue;
					}

					if( !receiver.receives.includes( iface ) )
					{
						// if the receiver doesn't implement this of the interfaces
						// from the transmitter, they just don't care about each other
						continue;
					}

					const [ int, pt ] = entitiesIntersect( transmitter, receiver, EVolumeContext.StartOnly );
					if( !int )
					{
						continue;
					}

					if( !bestReceiver || bestReceiver.priority < receiver.priority )
					{
						bestReceiver = receiver;
						bestPt = pt;
					}
				}

				if( bestReceiver )
				{
					if( currentIip )
					{
						// make sure the new one is higher priority
						let oldReceiver = entityMap.find( currentIip.receiver );
						if( oldReceiver.priority >= bestReceiver.priority )
						{
							continue;
						}

						// end the old interface before starting the new one
						this.callbacks.interfaceEnded( transmitter.epa, oldReceiver.epa, iface,
							this.computeEntityTransform( transmitter, oldReceiver ),
							`higher priority receiver `
							+ `${ bestReceiver.priority } > ${ oldReceiver.priority }` );
						let oldIndex = newInterfacesInProgress.findIndex( ( iip: InterfaceInProgress ) => 
							( iip == currentIip ) );
						if( oldIndex != -1 )
						{
							newInterfacesInProgress.splice( oldIndex, 1 );
						}
					}

					this.log( `interface started ${ endpointAddrToString( transmitter.epa ) } `
						+` to ${ endpointAddrToString( bestReceiver.epa ) } for ${ iface }` );

					// we found a transmitter and receiver that are touching and share an interface.
					this.callbacks.interfaceStarted( transmitter.epa, bestReceiver.epa, iface,
						this.computeEntityTransform( transmitter, bestReceiver ), undefined, "intersection" );

					newInterfacesInProgress.push(
						{
							transmitter: transmitter.epa,
							receiver: bestReceiver.epa,
							iface: iface,
							locked: false,
							transmitterWantsTransforms: transmitter.wantsTransforms,
							receiverWantsTransforms: bestReceiver.wantsTransforms,
							refreshTransforms: false,
							hasRealVolumes: true,
						} );
				}

			}
		}

		// Now that we've sorted out the new InterfaceInProgress list, sent transforms
		// to whomever wants them
		this.interfacesInProgress = newInterfacesInProgress;
		for( let iip of this.interfacesInProgress )
		{
			if( !iip.receiverWantsTransforms && !iip.transmitterWantsTransforms && !iip.refreshTransforms )
			{
				continue;
			}

			let transmitter = entityMap.find( iip.transmitter );
			let receiver = entityMap.find( iip.receiver );

			if( iip.transmitterWantsTransforms || iip.refreshTransforms )
			{
				this.callbacks.interfaceTransformUpdated(iip.transmitter, iip.receiver, iip.iface, 
					this.computeEntityTransform( transmitter, receiver ), "transmitterWantsTransforms" );
			}

			if( iip.receiverWantsTransforms || iip.refreshTransforms )
			{
				this.callbacks.interfaceTransformUpdated( iip.receiver, iip.transmitter, iip.iface,
					this.computeEntityTransform( receiver, transmitter ), "receiverWantsTransforms" );
			}

			iip.refreshTransforms = false;
		}

		this.lastEntityMap = entityMap;
	}

	computeEntityTransform( to: InterfaceEntity, from: InterfaceEntity ) : [ mat4, vec3 | null ]
	{
		if( !to || !from )
		{
			return undefined;
		}

		let toFromUniverse = to.universeFromEntity.copy().inverse();
		let transform = mat4.product( toFromUniverse, from.universeFromEntity, new mat4() );
		const [ int, pt ] = entitiesIntersect(to, from, EVolumeContext.Always );
		let ptInTo: vec3;
		if( pt )
		{
			// transform the point to be in "to" space
			ptInTo = matMultiplyPoint( toFromUniverse, pt );
		}
		return [transform, ptInTo ];
	}

	public interfaceEvent( destEpa: EndpointAddr, peerEpa: EndpointAddr, iface: string, event: object ): void
	{
		let foundIip = false;
		for( let iip of this.interfacesInProgress )
		{
			// look for an iip where the destination is the transmitter and the peer is the receiver
			// or vice versa
			if( endpointAddrsMatch( destEpa, iip.transmitter ) 
					&& endpointAddrsMatch( peerEpa, iip.receiver )
				|| endpointAddrsMatch( destEpa, iip.receiver ) 
					&& endpointAddrsMatch( peerEpa, iip.transmitter ) )
			{
				foundIip = true;
				if( iip.iface != iface )
				{
					this.log( `Discarding interface event from ${ endpointAddrToString( peerEpa ) } `
						+` to ${ endpointAddrToString( destEpa ) } for ${ iface }`
						+` because the interface between those two is ${ iip.iface }`, event );
					break;
				}

				let destination = this.lastEntityMap?.find( destEpa );
				let peer = this.lastEntityMap?.find( peerEpa );

				let destinationFromPeer = this.computeEntityTransform( destination, peer );
				this.log( `Reflecting interface event from ${ endpointAddrToString( peerEpa ) } `
					+` to ${ endpointAddrToString( destEpa ) } for ${ iface }`, event, destinationFromPeer );

				this.callbacks.interfaceEvent( destEpa, peerEpa, iface, event, destinationFromPeer,
					`sent by ${ endpointAddrToString( peerEpa ) }` );

				iip.refreshTransforms = true;

				// we should only have one iip for this transmitter
				break;
			}
		}

		if( !foundIip )
		{
			this.log( `Discarding interface event from ${ endpointAddrToString( peerEpa ) } `
			+` to ${ endpointAddrToString( destEpa ) } for ${ iface }`
			+` because the interface was not found`, event );
		}
	}

	private findIip( transmitter: EndpointAddr, receiver: EndpointAddr ): InterfaceInProgress
	{
		for( let iip of this.interfacesInProgress )
		{
			if( endpointAddrsMatch( transmitter, iip.transmitter )
				&& endpointAddrsMatch( receiver, iip.receiver ) )
			{
				return iip;
			}
		}

		return null;
	}

	public lockInterface( transmitter: EndpointAddr, receiver: EndpointAddr, iface: string ): InterfaceLockResult
	{
		let iip = this.findIip( transmitter, receiver );
		if( !iip )
		{
			this.log( `Failed to lock interface ${ endpointAddrToString( transmitter ) } `
				+` to ${ endpointAddrToString( receiver ) } for ${ iface }: `
				+ `no interface in progress` );
			return InterfaceLockResult.InterfaceNotFound;
		}

		if( iip.locked )
		{
			this.log( `Failed to lock interface ${ endpointAddrToString( transmitter ) } `
				+` to ${ endpointAddrToString( receiver ) } for ${ iface }: `
				+ `already locked` );
			return InterfaceLockResult.AlreadyLocked;
		}

		if( iip.iface != iface )
		{
			this.log( `Failed to lock interface ${ endpointAddrToString( transmitter ) } `
				+` to ${ endpointAddrToString( receiver ) } for ${ iface }: `
				+ `mismatched interface (${ iip.iface })` );
			return InterfaceLockResult.InterfaceNameMismatch;
		}

		this.log( `Locking interface ${ endpointAddrToString( transmitter ) } `
			+` to ${ endpointAddrToString( receiver ) } for ${ iface }` );

		iip.locked = true;
		iip.refreshTransforms = true;
				
		return InterfaceLockResult.Success;
	}


	public unlockInterface( transmitter: EndpointAddr, receiver: EndpointAddr, iface: string ): 
		[ InterfaceLockResult, () => void ]
	{
		let iip = this.findIip( transmitter, receiver );
		if( !iip )
		{
			if( this.lostLockedInterfaces.has( endpointAddrToString( transmitter ) ) )
			{
				iip = this.lostLockedInterfaces.get( endpointAddrToString( transmitter ) );
				if( iip.iface != iface )
				{
					return [ InterfaceLockResult.InterfaceNameMismatch, null ];
				}

				// we lost the other end of the lock and told the transmitter about that already.
				this.lostLockedInterfaces.delete( endpointAddrToString( transmitter ) );
				return [ InterfaceLockResult.Success, null ];
			}
			else
			{
				return [ InterfaceLockResult.InterfaceNotFound, null ];
			}
		}

		if( !iip.locked )
		{
			return [ InterfaceLockResult.NotLocked, null ];
		}

		if( iip.iface != iface )
		{
			return [ InterfaceLockResult.InterfaceNameMismatch, null ];
		}

		if( !endpointAddrsMatch( iip.receiver, receiver ) )
		{
			return [ InterfaceLockResult.InterfaceReceiverMismatch, null ];
		}

		this.log( `Unlocking interface ${ endpointAddrToString( transmitter ) } `
			+` to ${ endpointAddrToString( receiver ) } for ${ iface }` );

		iip.locked = false;
		iip.refreshTransforms = true;
				
		let fn: () => void;
		if( !iip.hasRealVolumes )
		{
			// This interface is guaranteed to edit on the next frame... unless somebody sneaks in
			// with a new lock. End this interface immediately so there's no risk of that happening
			// and the behavior from the gadget side is deterministic 

			// we this with a callback so that the unlock result always shows up before the interface
			// end
			fn = () =>
			{
				this.callbacks.interfaceEnded(iip.transmitter, iip.receiver, iip.iface,
					undefined, "unlock without real volumes " + iip.emptyVolumeSource );
				this.interfacesInProgress.filter( ( testIip ) => testIip != iip );
			}
		}

		return [ InterfaceLockResult.Success, fn ];
	}

	public relockInterface( transmitterEpa: EndpointAddr, oldReceiverEpa: EndpointAddr, 
		newReceiverEpa: EndpointAddr, iface: string ): InterfaceLockResult
	{
		let iip = this.findIip( transmitterEpa, oldReceiverEpa );
		if( !iip )
		{
			return InterfaceLockResult.InterfaceNotFound;
		}

		if( !iip.locked )
		{
			return InterfaceLockResult.NotLocked;
		}

		if( iip.iface != iface )
		{
			return InterfaceLockResult.InterfaceNameMismatch;
		}

		if( !endpointAddrsMatch( iip.receiver, oldReceiverEpa ) )
		{
			return InterfaceLockResult.InterfaceReceiverMismatch;
		}

		let newReceiver = this.lastEntityMap.find( newReceiverEpa );
		if( !newReceiver )
		{
			return InterfaceLockResult.NewReceiverNotFound;			
		}

		let transmitter = this.lastEntityMap.find( transmitterEpa )
		let oldReceiver = this.lastEntityMap.find( oldReceiverEpa )
		let transmitterFromOldReceiver = this.computeEntityTransform( transmitter, oldReceiver );
		let transmitterFromNewReceiver = this.computeEntityTransform( transmitter, newReceiver );

		this.callbacks.interfaceEnded( transmitterEpa, oldReceiverEpa, iface, transmitterFromOldReceiver,
			"relock" );
		this.callbacks.interfaceStarted( transmitterEpa, newReceiverEpa, iface, 
			transmitterFromNewReceiver, undefined, "relock" );

		this.log( `Relocking interface ${ endpointAddrToString( transmitterEpa ) } `
		+ ` from ${ endpointAddrToString( oldReceiverEpa ) }`
		+` to ${ endpointAddrToString( newReceiverEpa ) } for ${ iface }` );

		iip.receiver = newReceiverEpa;
		iip.receiverWantsTransforms = newReceiver.wantsTransforms;

		return InterfaceLockResult.Success;
	}

}

function shouldAllowMatch( transmitter: InterfaceEntity, receiver: InterfaceEntity ): boolean
{
	if( transmitter.originPath == "/space/stage" || !transmitter.originPath || !receiver.originPath )
		return true;

	if( transmitter.originPath == receiver.originPath )
		return false;

	let to = transmitter.originPath.split( '/' );
	let ro = receiver.originPath.split( '/' );

	if( to.length > 3 && ro.length > 3 )
	{
		if( to[1] == ro[1] && to[2] == ro[2] && to[3] == ro[3] )
			return false;
	}

	return true;
}
