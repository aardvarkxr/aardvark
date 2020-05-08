import { AvVolume, EndpointAddr } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as React from 'react';
import { AvInterfaceEntity, InterfaceProp } from './aardvark_interface_entity';

export interface EntityComponent
{
	readonly transmits: InterfaceProp[];
	readonly receives: InterfaceProp[];
	readonly parent: EndpointAddr;
	readonly wantsTransforms: boolean;
	onUpdate( callback: () => void ): void;
	render() : JSX.Element;
}


export interface AvComposedEntityProps
{
	/** The list of components of which this entity is composed. The order of the components
	 * in this array defines the order of the registration of transmit and receive interfaces,
	 * as well as which component gets to determine the current parent if there are multiple 
	 * non-null parents.
	 */
	components: EntityComponent[];

	/** The volume to use when matching this entity with other interface entities. */
	volume: AvVolume;
}

/** Allows for the construction of interface entities out of reusable interface components.
 * 
 * Each component specifies zero or more interfaces that it implements on transmit or receive, 
 * the parent it desires for the entity, and whether or not it wants transforms. It also provices
 * a way for the composed entity to be called back when one of the components needs to refresh the 
 * entity itself.
 */
export class AvComposedEntity extends React.Component< AvComposedEntityProps, {} >
{

	constructor(props: any)
	{
		super( props );
		this.refreshUpdateListeners();
	}

	componentDidUpdate()
	{
		this.refreshUpdateListeners();
	}

	private refreshUpdateListeners()
	{
		for( let comp of this.props.components )
		{
			comp.onUpdate( this.onComponentUpdate );
		}
	}

	@bind
	private onComponentUpdate()
	{
		this.forceUpdate();
	}

	render()
	{
		let transmits: InterfaceProp[] = [];
		let receives: InterfaceProp[] = [];
		let wantsTransforms = false;
		let parent: EndpointAddr;
		for( let comp of this.props.components )
		{
			transmits = transmits.concat( comp.transmits );
			receives = receives.concat( comp.receives );
			wantsTransforms == wantsTransforms || comp.wantsTransforms;
			if( !parent )
			{
				parent = comp.parent;
			}
		}

		return <AvInterfaceEntity transmits={transmits} receives={ receives } wantsTransforms={ wantsTransforms }
					parent={ parent } volume={ this.props.volume }>
					{ this.props.children }
					{ this.props.components.map( ( value: EntityComponent ) => value.render() ) }
				</AvInterfaceEntity>;
	}
}
