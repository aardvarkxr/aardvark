import * as React from 'react';
import { EndpointAddr, AvNodeTransform, endpointAddrToString, InitialInterfaceLock, endpointAddrsMatch } from '../../aardvark-shared/src/aardvark_protocol';
import { EntityComponent } from './aardvark_composed_entity';
import { InterfaceProp, ActiveInterface } from './aardvark_interface_entity';
import bind from 'bind-decorator';
import { AvTransform } from './aardvark_transform';
import { AvEntityChild } from './aardvark_entity_child';
import { ContainerRequestType, ContainerRequest } from './component_moveable';

export enum ContainerItemState
{
	Moving = "Moving",
	Resting = "Resting",
}

interface ContainerItem
{
	epa: EndpointAddr;
	containerFromEntity: AvNodeTransform;
	state: ContainerItemState;
	iface: ActiveInterface;
}

export interface ContainerItemStateEvent
{
	state: ContainerItemState;
	moveableToReplace?: EndpointAddr;
}

export class SimpleContainerComponent implements EntityComponent
{
	private contents: ContainerItem[] = [];
	private entityCallback: () => void = null;
	private activeContainer: ActiveInterface = null;

	constructor()
	{
	}

	private updateListener()
	{
		this.entityCallback?.();
	}

	@bind
	private onContainerStart( activeContainer: ActiveInterface )
	{
		let myItem: ContainerItem =
		{
			epa: activeContainer.peer,
			containerFromEntity: activeContainer.selfFromPeer,
			state: ContainerItemState.Moving,
			iface: activeContainer,
		};
		this.contents.push( myItem );

		activeContainer.onEvent( 
			( event: ContainerItemStateEvent ) =>
			{
				myItem.state = event.state;
				myItem.containerFromEntity = activeContainer.selfFromPeer;

				if( event.moveableToReplace )
				{
					console.log( `trying to send redrop complete to ${ endpointAddrToString( event.moveableToReplace ) }` );
					let item = this.contents.find(( item ) => endpointAddrsMatch(item.epa, event.moveableToReplace ) );
					if( item )
					{
						console.log( `found item for ${ endpointAddrToString( event.moveableToReplace ) }` );
						myItem.containerFromEntity = item.containerFromEntity;
						item.iface.sendEvent( 
							{ 
								type: ContainerRequestType.RedropComplete, 
								replacement: myItem.epa 
							} as ContainerRequest );
					}
					else
					{
						console.log( "didn't find matching item" );
					}
				}
				this.updateListener();
			}
		)

		activeContainer.onEnded( 
			() =>
			{
				let i = this.contents.indexOf( myItem );
				if( i != -1 )
				{
					this.contents.splice( i, 1 );
				}
				this.updateListener();
			} );
	}

	public get transmits(): InterfaceProp[]
	{
		return [];
	}

	public get receives(): InterfaceProp[]
	{
		return [ { iface: "aardvark-container@1", processor: this.onContainerStart } ];
	}

	public get parent(): EndpointAddr
	{
		return null;
	}
	
	public get wantsTransforms()
	{
		return false;
	}


	public get interfaceLocks(): InitialInterfaceLock[] { return []; }
	
	public onUpdate( callback: () => void ): void
	{
		this.entityCallback = callback;
	}


	public render(): JSX.Element
	{
		let contents: JSX.Element[] = [];
		for( let item of this.contents )
		{
			if( item.state == "Resting" )
			{
				contents.push( 
					<AvTransform transform={ item.containerFromEntity } key={ endpointAddrToString( item.epa ) }>
						<AvEntityChild child={ item.epa } />
					</AvTransform> );
			}
		}

		return <> { contents } </>;
	}
}