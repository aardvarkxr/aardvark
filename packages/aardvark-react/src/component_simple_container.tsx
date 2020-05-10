import * as React from 'react';
import { EndpointAddr, AvNodeTransform, endpointAddrToString, InitialInterfaceLock } from '../../aardvark-shared/src/aardvark_protocol';
import { EntityComponent } from './aardvark_composed_entity';
import { InterfaceProp, ActiveInterface } from './aardvark_interface_entity';
import bind from 'bind-decorator';
import { AvTransform } from './aardvark_transform';
import { AvEntityChild } from './aardvark_entity_child';

interface ContainerItem
{
	epa: EndpointAddr;
	containerFromEntity: AvNodeTransform;
	state: "Moving" | "Resting";
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
			state: "Moving",
		};
		this.contents.push( myItem );

		activeContainer.onEvent( 
			( event: any ) =>
			{
				myItem.state = event.state;
				myItem.containerFromEntity = activeContainer.selfFromPeer;
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