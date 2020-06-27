import { AvVolume, EndpointAddr, EndpointType, InitialInterfaceLock, AvConstraint } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as React from 'react';
import { AvInterfaceEntity, InterfaceProp } from './aardvark_interface_entity';
import { AvGadget } from './aardvark_gadget';

export interface EntityComponent
{
	readonly transmits?: InterfaceProp[];
	readonly receives?: InterfaceProp[];
	readonly interfaceLocks?: InitialInterfaceLock[];
	readonly parent?: EndpointAddr;
	readonly wantsTransforms?: boolean;
	setEntityEpa?: ( epa: EndpointAddr ) => void;
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
	volume: AvVolume | AvVolume[];

	/** The priority to use for the entity. 
	 * 
	 * @default 0
	*/
	priority?: number;
	
	/** Sets the constraint to apply to this node's transform before applying the
	 * parent transform. Using constraints without a parent may have unexpected results.
	 * 
	 * @default none
	 */
	constraint?: AvConstraint;
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
	private entityEpa: EndpointAddr = null;

	constructor(props: any)
	{
		super( props );
		this.refreshUpdateListeners();
	}

	componentDidUpdate()
	{
		this.refreshUpdateListeners();
	}

	@bind
	private onEntityRef( entity: AvInterfaceEntity )
	{
		let epa = entity?.globalId ?? null;

		this.entityEpa = epa;
		for( let comp of this.props.components )
		{
			comp.setEntityEpa?.( epa );
		}
	}

	private refreshUpdateListeners()
	{
		for( let comp of this.props.components )
		{
			comp.onUpdate( this.onComponentUpdate );
		}
	}

	public get globalId(): EndpointAddr
	{
		return this.entityEpa;
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
		let interfaceLocks: InitialInterfaceLock[] = [];
		for( let comp of this.props.components )
		{
			transmits = transmits.concat( comp.transmits ?? [] );
			receives = receives.concat( comp.receives ?? []);
			wantsTransforms = wantsTransforms || ( comp.wantsTransforms ?? false );
			if( !parent )
			{
				parent = comp.parent ?? null;
			}

			let compLocks = comp.interfaceLocks ?? null;
			if( compLocks )
			{
				interfaceLocks = interfaceLocks.concat( compLocks );
			}
		}

		return <AvInterfaceEntity transmits={transmits} receives={ receives } wantsTransforms={ wantsTransforms }
					parent={ parent } volume={ this.props.volume } ref={ this.onEntityRef } 
					priority={ this.props.priority } interfaceLocks={ interfaceLocks }
					constraint={ this.props.constraint }>
					{ this.props.children }
					{ this.props.components.map( ( value: EntityComponent ) => value.render() ) }
				</AvInterfaceEntity>;
	}
}
