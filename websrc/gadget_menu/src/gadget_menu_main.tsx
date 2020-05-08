import { AvGadget, AvGadgetSeed, AvGrabbable, AvModel, AvModelBoxHandle, AvPanel, AvPanelAnchor, AvTransform, HighlightType, HookInteraction, AvOrigin, AvPrimitive, PrimitiveType, AvInterfaceEntity, ActiveInterface, MoveableComponent, AvComposedEntity, MoveableComponentState } from '@aardvarkxr/aardvark-react';
import { EndpointAddr, g_builtinModelGear, EVolumeType, EAction } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as React from 'react';
import * as ReactDOM from 'react-dom';



interface ControlPanelState
{
	highlight: HighlightType;
	installedGadgets?: string[];
	// activeGrab: ActiveInterface;
	// grabber?: EndpointAddr;
	// activeContainer: ActiveInterface;
}

class ControlPanel extends React.Component< {}, ControlPanelState >
{
	private ballMoveable = new MoveableComponent( () => { this.forceUpdate(); } );

	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
			highlight: HighlightType.None,
			// activeGrab: null,
			// activeContainer: null,
		};

		AvGadget.instance().getInstalledGadgets()
		.then( ( installedGadgets: string[] ) =>
		{
			this.setState( { installedGadgets } );
		} );
	}

	@bind onUpdateHighlight( highlight: HighlightType, handleAddr: EndpointAddr, tethered: boolean )
	{
		console.log( `Highlight state is ${ HighlightType[ highlight ] }` );
		this.setState( { highlight } );
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
		if( this.state.highlight != HighlightType.Grabbed )
			return null;

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

	// @bind
	// private onGrabStart( activeGrab: ActiveInterface )
	// {
	// 	activeGrab.onEnded(() =>
	// 	{
	// 		this.setState( { activeGrab: null } );
	// 	} );

	// 	activeGrab.onEvent( async ( event: any ) =>
	// 	{
	// 		console.log( "Event received", event );
	// 		switch( event.type )
	// 		{
	// 			case "SetGrabber":
	// 				this.setState( { grabber: this.state.activeGrab.peer } );

	// 				if( this.state.activeContainer )
	// 				{
	// 					this.state.activeContainer?.sendEvent( { state: "Moving" } );
	// 					this.state.activeContainer.unlock();
	// 				}

	// 				break;

	// 			case "DropYourself":
	// 				if( this.state.activeContainer )
	// 				{
	// 					await this.state.activeContainer.lock();
	// 					this.state.activeContainer?.sendEvent( { state: "Resting" } );
	// 				}
	// 				this.setState( { grabber: null } );
	// 				break;
	// 		}
	// 	} );

	// 	this.setState( { activeGrab } );
	// }

	// @bind
	// private onContainerStart( activeContainer: ActiveInterface )
	// {
	// 	activeContainer.onEnded(() =>
	// 	{
	// 		this.setState( { activeContainer: null } );
	// 	} );

	// 	this.setState( { activeContainer } );
	// }

	public render()
	{
		return (
			<AvGrabbable updateHighlight={ this.onUpdateHighlight } preserveDropTransform={ true }
				grabWithIdentityTransform={ true }
				hookInteraction={ HookInteraction.HighlightAndDrop }> 
				<AvTransform uniformScale={ this.state.highlight == HighlightType.InRange ? 1.1 : 1.0 } >
					<AvModel uri={ g_builtinModelGear } />
					<AvModelBoxHandle uri={ g_builtinModelGear }/>
				</AvTransform>

				{ this.renderPanel() }

				<AvOrigin path="/space/stage">
					<AvTransform translateY={ 1 } >
						<AvComposedEntity components={ [this.ballMoveable ] } 
							volume={ { type: EVolumeType.Sphere, radius: 0.1} }>
							<AvPrimitive type={ PrimitiveType.Sphere } radius={0.1}
								color={ ( this.ballMoveable.state == MoveableComponentState.GrabberNearby
										|| this.ballMoveable.state == MoveableComponentState.Grabbed )
										? "yellow" : "turquoise" } />
						</AvComposedEntity>
					</AvTransform>
				</AvOrigin> 
			</AvGrabbable> );
	}
}


ReactDOM.render( <ControlPanel/>, document.getElementById( "root" ) );
