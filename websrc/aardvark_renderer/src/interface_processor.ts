import { nodeTransformToMat4 } from '@aardvarkxr/aardvark-react';
import { EndpointAddr, endpointAddrsMatch, endpointAddrToString, InitialInterfaceLock, InterfaceLockResult } from '@aardvarkxr/aardvark-shared';
import { mat4 } from '@tlaukkan/tsm';
import { TransformedVolume, volumesIntersect } from './volume_intersection';

export interface InterfaceProcessorCallbacks
{
	interfaceStarted( transmitter: EndpointAddr, receiver: EndpointAddr, iface: string,
		transmitterFromReceiver: mat4, params?: object ):void;
	interfaceEnded( transmitter: EndpointAddr, receiver: EndpointAddr, iface: string,
		transmitterFromReceiver?: mat4 ):void;
	interfaceTransformUpdated( destination: EndpointAddr, peer: EndpointAddr, iface: string, destinationFromPeer: mat4 ): void;
	interfaceEvent( destination: EndpointAddr, peer: EndpointAddr, iface: string, event: object,
		destinationFromPeer: mat4 ): void;
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


function entitiesIntersect( transmitter: InterfaceEntity, receiver: InterfaceEntity )
{
	for( let tv of transmitter.volumes )
	{
		for( let rv of receiver.volumes )
		{
			if( volumesIntersect( tv, rv ) )
				return true;
		}
	}

	return false;
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


export class CInterfaceProcessor
{
	private interfacesInProgress: InterfaceInProgress[] = [];
	private lostLockedInterfaces = new Map<string, InterfaceInProgress>();
	private callbacks: InterfaceProcessorCallbacks;
	private lastEntityMap: InterfaceEntityMap;

	constructor( callbacks: InterfaceProcessorCallbacks )
	{
		this.callbacks = callbacks;
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
					transmitterFromReceiver, initialLock.params );
				
				let iip: InterfaceInProgress =
				{
					transmitter: transmitter.epa,
					receiver: initialLock.receiver,
					iface: initialLock.iface,
					locked: true,
					transmitterWantsTransforms: transmitter.wantsTransforms,
					receiverWantsTransforms: receiver?.wantsTransforms ?? false,
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
					this.callbacks.interfaceEnded( transmitter.epa, initialLock.receiver, initialLock.iface );
					this.lostLockedInterfaces.set( endpointAddrToString( transmitter.epa ), iip );
				}
			}
		}

		// end interfaces where one end or the other is gone
		let transmittersInUse = new Map<string, InterfaceInProgress | boolean >();
		let newInterfacesInProgress: InterfaceInProgress[] = []
		for( let iip of this.interfacesInProgress )
		{
			// if a transmitter goes away, the interface goes away
			let transmitter = entityMap.find( iip.transmitter );
			if( !transmitter || !transmitter.transmits.includes( iip.iface ) )
			{
				this.callbacks.interfaceEnded(iip.transmitter, iip.receiver, iip.iface );
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
				this.callbacks.interfaceEnded(iip.transmitter, iip.receiver, iip.iface );
				console.log( `interface end (no receiver/iface) ${ endpointAddrToString( transmitter.epa ) } `
					+` to ${ endpointAddrToString( iip.receiver ) } for ${ iip.iface }` );
				if( iip.locked )
				{
					//console.log( "adding lost lock to list for " + endpointAddrToString( iip.transmitter ) );
					this.lostLockedInterfaces.set( endpointAddrToString( iip.transmitter ), iip );
				}
				continue;
			}

			// if the iip isn't locked, we need to check that the volumes still exist and still
			// intersect
			if( !iip.locked )
			{
				if ( !entitiesIntersect( transmitter, receiver ) )
				{
					console.log( `interface end (no intersect) ${ endpointAddrToString( transmitter.epa ) } `
						+` to ${ endpointAddrToString( receiver.epa ) } for ${ iip.iface }` );
					this.callbacks.interfaceEnded( iip.transmitter, iip.receiver, iip.iface,
						this.computeEntityTransform( transmitter, receiver ) );
					continue;
				}
			}

			iip.transmitterWantsTransforms = transmitter.wantsTransforms;
			iip.receiverWantsTransforms = receiver.wantsTransforms;
			transmittersInUse.set( endpointAddrToString( iip.transmitter ), iip );
			newInterfacesInProgress.push( iip );
		}

		// lost locks count as "in use" so they won't trigger new interfaces
		for( let transmitterEpaString of this.lostLockedInterfaces.keys() )
		{
			transmittersInUse.set( transmitterEpaString, false );
		}

		// Look for new interfaces
		for ( let transmitter of entities )
		{
			if( transmitter.transmits.length == 0 )
			{
				// this entity isn't transmitting anything
				continue;
			}

			let currentIip: InterfaceInProgress | boolean 
				= transmittersInUse.get(endpointAddrToString( transmitter.epa ));
			//console.log( "current iip", currentIip );
			if( typeof currentIip == "boolean" || ( currentIip && currentIip.locked ) )
			{
				// This interface was locked. Wait for the unlock before changing anything
				continue;
			}

			let bestReceiver: InterfaceEntity;
			let bestIface: string;
			for( let receiver of entities )
			{
				if( transmitter == receiver )
				{
					// you can't interface with yourself
					continue;
				}

				if( transmitter.originPath == receiver.originPath && transmitter.originPath != "/space/stage" )
				{
					// right hand can't interface with stuff that's also 
					// on the right hand, etc.

					// This rule does not apply to entities that originate on the stage because they aren't
					// moving around the way that hands and the head are.
					continue;
				}

				let iface = findBestInterface(transmitter, receiver)
				if( !iface )
				{
					// if the receiver doesn't implement any of the interfaces
					// from the transmitter, they just don't care about each other
					continue;
				}

				if( !entitiesIntersect( transmitter, receiver ) )
				{
					continue;
				}

				if( !bestReceiver || bestReceiver.priority < receiver.priority )
				{
					bestReceiver = receiver;
					bestIface = iface;
				}
			}

			if( bestReceiver )
			{
				if( currentIip )
				{
					// make sure the new one is higher priority
					let oldReceiver = entityMap.find( currentIip.receiver );
					if( oldReceiver.priority >= bestReceiver.priority 
						|| currentIip.iface != bestIface )
					{
						continue;
					}

					// end the old interface before starting the new one
					this.callbacks.interfaceEnded( transmitter.epa, oldReceiver.epa, bestIface );
					let oldIndex = newInterfacesInProgress.findIndex( ( iip: InterfaceInProgress ) => 
						( iip == currentIip ) );
					if( oldIndex != -1 )
					{
						newInterfacesInProgress.splice( oldIndex, 1 );
					}
				}

				console.log( `interface started ${ endpointAddrToString( transmitter.epa ) } `
					+` to ${ endpointAddrToString( bestReceiver.epa ) } for ${ bestIface }` );

				// we found a transmitter and receiver that are touching and share an interface.
				this.callbacks.interfaceStarted( transmitter.epa, bestReceiver.epa, bestIface,
					this.computeEntityTransform( transmitter, bestReceiver ) );

				newInterfacesInProgress.push(
					{
						transmitter: transmitter.epa,
						receiver: bestReceiver.epa,
						iface: bestIface,
						locked: false,
						transmitterWantsTransforms: transmitter.wantsTransforms,
						receiverWantsTransforms: bestReceiver.wantsTransforms,
					} );
			}
		}

		// Now that we've sorted out the new InterfaceInProgress list, sent transforms
		// to whomever wants them
		this.interfacesInProgress = newInterfacesInProgress;
		for( let iip of this.interfacesInProgress )
		{
			if( !iip.receiverWantsTransforms && !iip.transmitterWantsTransforms )
			{
				continue;
			}

			let transmitter = entityMap.find( iip.transmitter );
			let receiver = entityMap.find( iip.receiver );

			if( iip.transmitterWantsTransforms )
			{
				this.callbacks.interfaceTransformUpdated(iip.transmitter, iip.receiver, iip.iface, 
					this.computeEntityTransform( transmitter, receiver ) );
			}

			if( iip.receiverWantsTransforms )
			{
				this.callbacks.interfaceTransformUpdated( iip.receiver, iip.transmitter, iip.iface,
					this.computeEntityTransform( receiver, transmitter ) );
			}
		}

		this.lastEntityMap = entityMap;
	}

	computeEntityTransform( to: InterfaceEntity, from: InterfaceEntity )
	{
		if( !to || !from )
		{
			return undefined;
		}

		return mat4.product( to.universeFromEntity.copy().inverse(), from.universeFromEntity, new mat4() );
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
					console.log( `Discarding interface event from ${ endpointAddrToString( peerEpa ) } `
						+` to ${ endpointAddrToString( destEpa ) } for ${ iface }`
						+` because the interface between those two is ${ iip.iface }`, event );
					break;
				}

				let destination = this.lastEntityMap?.find( destEpa );
				let peer = this.lastEntityMap?.find( peerEpa );

				let destinationFromPeer = this.computeEntityTransform( destination, peer );
				console.log( `Reflecting interface event from ${ endpointAddrToString( peerEpa ) } `
					+` to ${ endpointAddrToString( destEpa ) } for ${ iface }`, event, destinationFromPeer );

				this.callbacks.interfaceEvent( destEpa, peerEpa, iface, event, destinationFromPeer );

				// we should only have one iip for this transmitter
				break;
			}
		}

		if( !foundIip )
		{
			console.log( `Discarding interface event from ${ endpointAddrToString( peerEpa ) } `
			+` to ${ endpointAddrToString( destEpa ) } for ${ iface }`
			+` because the interface was not found`, event );
		}
	}

	private findIip( transmitter: EndpointAddr ): InterfaceInProgress
	{
		for( let iip of this.interfacesInProgress )
		{
			if( endpointAddrsMatch( transmitter, iip.transmitter ) )
			{
				return iip;
			}
		}

		return null;
	}

	public lockInterface( transmitter: EndpointAddr, receiver: EndpointAddr, iface: string ): InterfaceLockResult
	{
		let iip = this.findIip(transmitter);
		if( !iip )
		{
			return InterfaceLockResult.InterfaceNotFound;
		}

		if( iip.locked )
		{
			return InterfaceLockResult.AlreadyLocked;
		}

		if( iip.iface != iface )
		{
			return InterfaceLockResult.InterfaceNameMismatch;
		}

		console.log( `Locking interface ${ endpointAddrToString( transmitter ) } `
			+` to ${ endpointAddrToString( receiver ) } for ${ iface }` );

		iip.locked = true;
		return InterfaceLockResult.Success;
	}


	public unlockInterface( transmitter: EndpointAddr, receiver: EndpointAddr, iface: string ): InterfaceLockResult
	{
		let iip = this.findIip(transmitter);
		if( !iip )
		{
			if( this.lostLockedInterfaces.has( endpointAddrToString( transmitter ) ) )
			{
				iip = this.lostLockedInterfaces.get( endpointAddrToString( transmitter ) );
				if( iip.iface != iface )
				{
					return InterfaceLockResult.InterfaceNameMismatch;
				}

				// we lost the other end of the lock and told the transmitter about that already.
				this.lostLockedInterfaces.delete( endpointAddrToString( transmitter ) );
				return InterfaceLockResult.Success;
			}
			else
			{
				return InterfaceLockResult.InterfaceNotFound;
			}
		}

		if( !iip.locked )
		{
			return InterfaceLockResult.NotLocked;
		}

		if( iip.iface != iface )
		{
			return InterfaceLockResult.InterfaceNameMismatch;
		}

		if( !endpointAddrsMatch( iip.receiver, receiver ) )
		{
			return InterfaceLockResult.InterfaceReceiverMismatch;
		}

		console.log( `Unlocking interface ${ endpointAddrToString( transmitter ) } `
			+` to ${ endpointAddrToString( receiver ) } for ${ iface }` );

		iip.locked = false;
		return InterfaceLockResult.Success;
		
	}

	public relockInterface( transmitterEpa: EndpointAddr, oldReceiverEpa: EndpointAddr, 
		newReceiverEpa: EndpointAddr, iface: string ): InterfaceLockResult
	{
		let iip = this.findIip( transmitterEpa );
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

		this.callbacks.interfaceEnded( transmitterEpa, oldReceiverEpa, iface, transmitterFromOldReceiver );
		this.callbacks.interfaceStarted( transmitterEpa, newReceiverEpa, iface, transmitterFromNewReceiver );

		console.log( `Relocking interface ${ endpointAddrToString( transmitterEpa ) } `
		+ ` from ${ endpointAddrToString( oldReceiverEpa ) }`
		+` to ${ endpointAddrToString( newReceiverEpa ) } for ${ iface }` );

		iip.receiver = newReceiverEpa;
		iip.receiverWantsTransforms = newReceiver.wantsTransforms;

		return InterfaceLockResult.Success;
	}

}