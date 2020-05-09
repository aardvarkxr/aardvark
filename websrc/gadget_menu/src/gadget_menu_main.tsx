import { AvGadget, AvGadgetSeed, AvGrabbable, AvModel, AvModelBoxHandle, AvPanel, AvPanelAnchor, AvTransform, HighlightType, HookInteraction, AvOrigin, AvPrimitive, PrimitiveType, AvInterfaceEntity, ActiveInterface, MoveableComponent, AvComposedEntity, MoveableComponentState, AvStandardGrabbable, ShowGrabbableChildren } from '@aardvarkxr/aardvark-react';
import { EndpointAddr, g_builtinModelGear, EVolumeType, EAction } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
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
			let seeds: JSX.Element[] = [];
			for( let gadget of this.state.installedGadgets )
			{
				seeds.push( 
					<div className="GadgetSeed">
						<AvPanelAnchor>
							<AvGadgetSeed key="gadget" uri={ gadget } 
								radius={ 0.1 }/>
						</AvPanelAnchor>
					</div> );
			}
			return <div className="GadgetSeedContainer">{ seeds }</div>;
		}
	}

	public renderPanel()
	{
		return <AvTransform rotateX={ 45 } translateZ={ -0.1 }>
				<AvTransform uniformScale={0.25}>
					<AvTransform translateZ={ -0.55 }>
						<AvPanel interactive={false}>
							<div className="FullPage" >
								<h1>This is the control panel</h1>
								{ this.renderGadgetSeedList() }
							</div>;
						</AvPanel>
					</AvTransform>
				</AvTransform>
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
