import { AvComposedEntity, AvGadget, AvGadgetSeed, AvOrigin, AvPrimitive, AvStandardGrabbable, AvTransform, MoveableComponent, MoveableComponentState, PrimitiveType, ShowGrabbableChildren, AvModel, AvPanel, AvHeadFacingTransform, ActiveInterface, AvInterfaceEntity } from '@aardvarkxr/aardvark-react';
import { EVolumeType, g_builtinModelGear, AvNodeTransform, emptyVolume } from '@aardvarkxr/aardvark-shared';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import Axios from 'axios';
import bind from 'bind-decorator';


const k_gadgetRegistryUI = "aardvark-gadget-registry@1";

interface RegistryEntry
{
	url: string;
}

interface Registry
{
	minimumAardvarkVersion: string;
	gadgets: RegistryEntry[];
}

interface ControlPanelState
{
	visible: boolean;
	registry?: Registry;
	registryLoadFailed?: boolean;
}

interface GadgetUIEvent
{
	type: "toggle_visibility";
}

class ControlPanel extends React.Component< {}, ControlPanelState >
{
	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
			visible: false,
		};

		Axios.get( "https://aardvarkxr.github.io/gadget-registry/registry.json" )
		.then( ( response ) =>
		{
			this.setState( { registry: response.data as Registry } );
		} )
		.catch( ( reason: any ) =>
		{
			this.setState( { registryLoadFailed: true } );
		} );
	}

	private renderErrorPanel( text: string )
	{
		return <>
			<div>{ text }</div>
			<AvPanel widthInMeters={ 1 } interactive={ false } />
			</>
	}


	private renderGadgetSeedList()
	{
		if( !this.state.registry )
		{
			if( this.state.registryLoadFailed )
			{
				return this.renderErrorPanel( "Error loading gadget registry" );
			}
			else
			{
				return this.renderErrorPanel( "Loading gadget registry..." );
			}
		}
		if( !this.state.registry?.gadgets?.length )
		{
			return this.renderErrorPanel( "Gadget registry was empty" );
		}
		else
		{
			const k_cellWidth = 0.06;
			let rowCount = Math.ceil( this.state.registry?.gadgets.length / 3 );
			let top = rowCount * -k_cellWidth;
			let seeds: JSX.Element[] = [];
			for( let gadgetIndex = 0; gadgetIndex < this.state.registry?.gadgets.length; gadgetIndex++ )
			{
				let gadget = this.state.registry?.gadgets[ gadgetIndex ].url;
				let col = gadgetIndex % 3;
				let row = Math.floor( gadgetIndex / 3 );

				seeds.push( 
					<AvTransform translateY = { top + row * k_cellWidth } 
						translateX = { ( col - 1 ) * k_cellWidth } 
						key={ gadget } >
						<AvGadgetSeed key="gadget" uri={ gadget } radius={ 0.025 }/>
					</AvTransform>);
			}
			return <AvTransform rotateX={ 90 }>
				{ seeds }
				</AvTransform>;
		}
	}

	private show( stageFromHead: AvNodeTransform )
	{
		this.setState( { visible: true } );
	}

	private hide( )
	{
		this.setState( { visible: false } );
	}

	@bind
	private onRegistryUI( activeInterface: ActiveInterface )
	{
		activeInterface.onEnded( () =>
		{
			console.log( "Exiting gadget menu because the hand gadget went away" );
			window.close();
			return;
		} );
		
		activeInterface.onEvent( ( event: GadgetUIEvent ) =>
		{
			switch( event.type )
			{
				case "toggle_visibility":
				{
					if( this.state.visible )
					{
						this.hide();
					}
					else
					{
						this.show( activeInterface.selfFromPeer );
					}
				}
				break;
			}
		} );
	}

	public render()
	{
		return (
			<AvOrigin path="/space/stage">
				<AvInterfaceEntity volume={ emptyVolume() } transmits={
					[
						{ 
							iface: k_gadgetRegistryUI,
							processor: this.onRegistryUI,
						}
					]
				} 
				interfaceLocks={ [ AvGadget.instance().findInitialInterface( k_gadgetRegistryUI ) ]}
				/>
				<AvTransform translateY={ 1 } visible={ this.state.visible }>
					<AvHeadFacingTransform>
						{ this.renderGadgetSeedList() }
					</AvHeadFacingTransform>
				</AvTransform>
			</AvOrigin> );
	}
}


ReactDOM.render( <ControlPanel/>, document.getElementById( "root" ) );
