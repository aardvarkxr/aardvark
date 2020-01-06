import * as React from 'react';
import  * as ReactDOM from 'react-dom';

import bind from 'bind-decorator';
import { AvGadget, AvTransform, AvGrabButton, AvPanelAnchor, AvGadgetSeed, AvPanel, AvGrabbable, AvModelBoxHandle, HighlightType, AvModel } from '@aardvarkxr/aardvark-react';
import { g_builtinModelGear, EndpointAddr, AvColor, AvGadgetManifest, g_builtinModelBackfacedSphere, AvVector } from '@aardvarkxr/aardvark-shared';


interface ControlPanelState
{
	highlight: HighlightType;
	installedGadgets?: string[];
	installedGadgetManifests?: Map<string, AvGadgetManifest>;
}

class ControlPanel extends React.Component< {}, ControlPanelState >
{
	defaultGadgetColor: AvColor = {r: 1, g: 1, b: 1, a: 1};
	sphereGadgetConstraint: AvVector = { x: 0.125, y: 0.125, z: 0.125};

	constructor( props: any )
	{
		super( props );
		this.state = 
		{
			highlight: HighlightType.None,
		};

		AvGadget.instance().getInstalledGadgets()
		.then( ( installedGadgets: string[] ) =>
		{
			var installedGadgetManifests: Map<string, AvGadgetManifest> = new Map()
			for( let gadget of installedGadgets )
			{
				if (!installedGadgetManifests.has(gadget)){
					AvGadget.instance().loadManifest(gadget).then(( manifest: AvGadgetManifest ) =>{	
						installedGadgetManifests.set(gadget, manifest);		  
					});
				}
			}

			this.setState( { 
				installedGadgets,
				installedGadgetManifests,
			} );
		} );
	}

	@bind onUpdateHighlight( highlight: HighlightType, handleAddr: EndpointAddr, tethered: boolean )
	{
		console.log( `Highlight state is ${ HighlightType[ highlight ] }` );
		this.setState( { highlight } );
	}

	private arbitraryColorFromString(seedName: string){
		if(seedName == null || seedName.length < 3){
			return this.defaultGadgetColor
		}

		var seed1 = seedName.charCodeAt(0) ^ seedName.charCodeAt(1);
		var seed2 = seedName.charCodeAt(1) ^ seedName.charCodeAt(2);
		var seed3 = seedName.charCodeAt(0) ^ seedName.charCodeAt(2);

		let avColor : AvColor;

		avColor = {r: (seed1 * 100 % 256) / 256, g: (seed2 * 100 % 256) / 256, b: (seed3 * 100  % 256) / 256};
  
		return avColor
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
				const modelColor = this.state.installedGadgetManifests 
					? this.arbitraryColorFromString(this.state.installedGadgetManifests.get(gadget).name)
					: this.defaultGadgetColor

				seeds.push( 
					<div className="GadgetSeed">
						<AvPanelAnchor>
							<AvModel uri={ g_builtinModelBackfacedSphere } scaleToFit={ this.sphereGadgetConstraint } color={ modelColor } >
								<AvGadgetSeed key="gadget" uri={ gadget } 
									radius={ 0.1 }/>
							</AvModel>
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
			<AvGrabbable updateHighlight={ this.onUpdateHighlight } preserveDropTransform={ true }
				grabWithIdentityTransform={ true }> 
				<AvTransform uniformScale={ this.state.highlight == HighlightType.InRange ? 1.1 : 1.0 } >
					<AvModel uri={ g_builtinModelGear } />
					<AvModelBoxHandle uri={ g_builtinModelGear }/>
				</AvTransform>

				{ this.renderPanel() }
			</AvGrabbable>	);
	}
}


ReactDOM.render( <ControlPanel/>, document.getElementById( "root" ) );
