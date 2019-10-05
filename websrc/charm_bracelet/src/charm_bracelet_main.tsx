import * as React from 'react';
import  * as ReactDOM from 'react-dom';

import bind from 'bind-decorator';
import { AvGadget, AvTransform, AvGrabbable, HighlightType, AvStandardHook, AvSphereHandle, AvModel, AvGrabButton } from 'aardvark-react';


interface CharmBraceletState
{
	highlight: HighlightType;
	charmCount: number;
}

interface CharmBraceletSettings
{
	charmCount: number;
}

interface CharmLocation
{
	x: number;
	y: number;
	z: number;
	rot: number;
}

let charmLocations: { [charmCount: number]: CharmLocation[] } =
{
	1: [ { x: 0, y: 0.1, z: 0.1, rot: 0 } ],
	2: [ { x: 0, y: 0.1, z: 0.1, rot: 0 }, { x: 0.1, y: 0.1, z: 0.1, rot: 0 } ],
	3: [ 
		{ x: 0, y: 0.1, z: 0.1, rot: 0 }, 
		{ x: 0.1, y: 0.1, z: 0.1, rot: 0 }, 
		{ x: -0.1, y: 0.1, z: 0.1, rot: 0 } 
	],
};

let charmLocationMax = 0;
for( let x in charmLocations )
{
	charmLocationMax = Math.max( parseInt( x ), charmLocationMax );
}

class CharmBracelet extends React.Component< {}, CharmBraceletState >
{
	private m_dirty = false;

	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
			highlight: HighlightType.None,
			charmCount: 1,
		};

		AvGadget.instance().registerForSettings( this.onSettingsReceived );
		AvGadget.instance().listenForEditMode( this.onEditModeUpdated );
	}

	@bind onGrabbableHighlight( newHighlight: HighlightType )
	{
		this.setState( { highlight: newHighlight } );
	}

	@bind onSettingsReceived( settings: CharmBraceletSettings )
	{
		this.setState( { charmCount: settings.charmCount })
	}

	@bind onPlus()
	{
		if( this.state.charmCount < charmLocationMax )
		{
			this.setState( { charmCount: this.state.charmCount + 1 } );
			this.m_dirty = true;
		}

	}

	@bind onMinus()
	{
		if( this.state.charmCount > 1 )
		{
			this.setState( { charmCount: this.state.charmCount - 1 } );
			this.m_dirty = true;
		}
	}

	@bind onEditModeUpdated()
	{
		if( !AvGadget.instance().editMode && this.m_dirty )
		{
			this.m_dirty = false;

			let settings: CharmBraceletSettings =
			{
				charmCount: this.state.charmCount,
			};
			AvGadget.instance().saveSettings( settings );
		}
		this.forceUpdate();
	}

	private renderControls()
	{
		if( !AvGadget.instance().editMode )
			return null;

		return <div>
			<AvTransform translateZ={0.2} translateY={0.1} translateX={ 0.05 }>
				<AvGrabButton modelUri="https://aardvark.install/models/plus.glb" 
					onTrigger={ this.onPlus } />
			</AvTransform>
			<AvTransform translateZ={0.2} translateY={0.1} translateX={ -0.05 }>
				<AvGrabButton modelUri="https://aardvark.install/models/minus.glb" 
					onTrigger={ this.onMinus } />
			</AvTransform>
		</div>
	}

	public render()
	{
		let grabbedMode = this.state.highlight == HighlightType.Grabbed;
		let charms: JSX.Element[] = [];

		let locs = charmLocations[ this.state.charmCount ];
		for( let i = 0; i < this.state.charmCount; i++ )
		{
			let loc = locs[ i ];
			charms.push(
				<AvTransform translateX={ loc.x } translateY={ loc.y } translateZ={ loc.z }  
					key={ i }>
					<AvStandardHook persistentName={ "hook" + i } />
				</AvTransform>
				);
		}

		return (
			<div className="FullPage" >
				<div>
					<AvGrabbable updateHighlight={ this.onGrabbableHighlight } >
						<AvSphereHandle radius={0.1} />
						{ charms }
						{ grabbedMode && <AvModel uri="http://aardvark.install/models/bracelet.glb" /> }
						{ this.renderControls() }
					</AvGrabbable>
				</div>
			</div>
		)
	}
}

ReactDOM.render( <CharmBracelet/>, document.getElementById( "root" ) );
