import { AvComposedEntity, AvGadget, AvGadgetSeed, AvOrigin, AvPrimitive, AvStandardGrabbable, AvTransform, MoveableComponent, MoveableComponentState, PrimitiveType, ShowGrabbableChildren } from '@aardvarkxr/aardvark-react';
import { EVolumeType, g_builtinModelGear } from '@aardvarkxr/aardvark-shared';
import * as React from 'react';
import * as ReactDOM from 'react-dom';



interface ControlPanelState
{
	installedGadgets?: string[];
}

class ControlPanel extends React.Component< {}, ControlPanelState >
{
	private ballMoveable = new MoveableComponent( () => { this.forceUpdate(); } );

	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
		};

		AvGadget.instance().getInstalledGadgets()
		.then( ( installedGadgets: string[] ) =>
		{
			this.setState( { installedGadgets } );
		} );
	}

	private renderGadgetSeedList()
	{
		if( !this.state.installedGadgets )
		{
			return <div>No Gadgets installed.</div>;
		}
		else
		{
			const k_cellWidth = 0.06;
			let rowCount = Math.ceil( this.state.installedGadgets.length / 3 );
			let top = rowCount * -k_cellWidth;
			let seeds: JSX.Element[] = [];
			for( let gadgetIndex = 0; gadgetIndex < this.state.installedGadgets.length; gadgetIndex++ )
			{
				let gadget = this.state.installedGadgets[ gadgetIndex ];
				let col = gadgetIndex % 3;
				let row = Math.floor( gadgetIndex / 3 );

				seeds.push( 
					<AvTransform translateZ = { top + row * k_cellWidth } 
						translateX = { ( col - 1 ) * k_cellWidth } 
						key={ gadget } >
						<AvGadgetSeed key="gadget" uri={ gadget } radius={ 0.025 }/>
					</AvTransform>);
			}
			return <>{ seeds }</>;
		}
	}

	public renderPanel()
	{
		return <AvTransform rotateX={ 45 } translateZ={ -0.1 }>
					{ this.renderGadgetSeedList() }
			</AvTransform>;
	}

	public render()
	{
		return (
			<AvOrigin path="/space/stage">
				<AvTransform translateY={ 1 }>
					<AvStandardGrabbable modelUri={ g_builtinModelGear } 
						showChildren={ ShowGrabbableChildren.OnlyWhenGrabbed } >
						{ this.renderPanel() }
					</AvStandardGrabbable>
				</AvTransform>

				<AvTransform translateY={ 1 }  translateZ={ 0.5 }>
					<AvComposedEntity components={ [this.ballMoveable ] } 
						volume={ { type: EVolumeType.Sphere, radius: 0.1} }>
						<AvPrimitive type={ PrimitiveType.Sphere } radius={0.1}
							color={ ( this.ballMoveable.state == MoveableComponentState.GrabberNearby
									|| this.ballMoveable.state == MoveableComponentState.Grabbed )
									? "yellow" : "turquoise" } />
					</AvComposedEntity>
				</AvTransform>
			</AvOrigin> );
	}
}


ReactDOM.render( <ControlPanel/>, document.getElementById( "root" ) );
