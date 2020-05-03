import { EndpointAddr, endpointAddrToString } from '@aardvarkxr/aardvark-shared';
import { mat4 } from '@tlaukkan/tsm';
import { TransformedVolume, volumesIntersect } from './volume_intersection';

export interface InterfaceProcessorCallbacks
{
	interfaceStarted( transmitter: EndpointAddr, receiver: EndpointAddr, iface: string ):void;
	interfaceEnded( transmitter: EndpointAddr, receiver: EndpointAddr, iface: string ):void;
	interfaceTransformUpdated( destination: EndpointAddr, peer: EndpointAddr, iface: string, destinationFromPeer: mat4 ): void;
	interfaceEvent( destination: EndpointAddr, peer: EndpointAddr, iface: string, event: object ): void;
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
}


export class CInterfaceProcessor
{
	private interfacesInProgress: InterfaceInProgress[] = [];
	private lostLockedInterfaces: { [ transmitterEpa: string ] : InterfaceInProgress } = {};
	private callbacks: InterfaceProcessorCallbacks;

	constructor( callbacks: InterfaceProcessorCallbacks )
	{
		this.callbacks = callbacks;
	}

	public processFrame( entities: InterfaceEntity[]  )
	{
		let entityMap = new InterfaceEntityMap( entities );

		// end interfaces where one end or the other is gone
		let transmittersInUse = new Map<string, InterfaceInProgress | false >();
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
				if( iip.locked )
				{
					this.lostLockedInterfaces[ endpointAddrToString( iip.transmitter ) ] = iip;
				}
				continue;
			}

			// if the iip isn't locked, we need to check that the volumes still exist and still
			// intersect
			if( !iip.locked )
			{
				if ( !entitiesIntersect( transmitter, receiver ) )
				{
					// console.log( "entities no longer intersect");
					this.callbacks.interfaceEnded( iip.transmitter, iip.receiver, iip.iface );
					continue;
				}
			}

			iip.transmitterWantsTransforms = transmitter.wantsTransforms;
			iip.receiverWantsTransforms = receiver.wantsTransforms;
			transmittersInUse.set( endpointAddrToString( iip.transmitter ), iip );
			newInterfacesInProgress.push( iip );
		}

		// lost locks count as "in use" so they won't trigger new interfaces
		for( let transmitterEpaString in this.lostLockedInterfaces )
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

			let currentIip: InterfaceInProgress | false 
				= transmittersInUse.get(endpointAddrToString( transmitter.epa ));
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

				if( transmitter.originPath == receiver.originPath )
				{
					// right hand can't interface with stuff that's also 
					// on the right hand, etc.
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

				// we found a transmitter and receiver that are touching and share an interface.
				this.callbacks.interfaceStarted( transmitter.epa, bestReceiver.epa, bestIface );

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
				let transmitterFromReceiver = mat4.product( transmitter.universeFromEntity.copy().inverse(), receiver.universeFromEntity, new mat4() );
				this.callbacks.interfaceTransformUpdated(iip.transmitter, iip.receiver, iip.iface, transmitterFromReceiver );
			}

			if( iip.receiverWantsTransforms )
			{
				let receiverFromTransmitter = mat4.product( receiver.universeFromEntity.copy().inverse(), transmitter.universeFromEntity, new mat4() );
				this.callbacks.interfaceTransformUpdated( iip.receiver, iip.transmitter, iip.iface, receiverFromTransmitter );
			}
		}
	}

	public interfaceEvent( destination: EndpointAddr, peer: EndpointAddr, iface: string, event: object ): void
	{

	}

	public lockInterface( transmitter: EndpointAddr, receiver: EndpointAddr, iface: string )
	{

	}

	public unlockInterface( transmitter: EndpointAddr, receiver: EndpointAddr, iface: string )
	{
		
	}

}