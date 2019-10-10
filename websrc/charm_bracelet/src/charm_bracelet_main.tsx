import * as React from 'react';
import  * as ReactDOM from 'react-dom';

import bind from 'bind-decorator';
import { AvGadget, AvTransform, AvGrabbable, HighlightType, AvStandardHook, AvSphereHandle, AvModel, AvGrabButton, AvNodeTransform, AvVector, AvQuaternion, AvTransformControl } from 'aardvark-react';


interface CharmProps
{
	id: number;
	initialSettings: CharmSettings;
	setSettings( id: number, settings: CharmSettings ): void;
}

interface CharmState
{
	currentSettings?: CharmSettings;
}

interface CharmSettings
{
	translate?: AvVector;
	rotation?: AvQuaternion;
}

class Charm extends React.Component< CharmProps, CharmState >
{
	constructor( props: any )
	{
		super( props );

		this.state = 
		{
		};

		AvGadget.instance().listenForEditMode( this.onEditModeUpdated );
	}

	@bind onEditModeUpdated()
	{
		this.forceUpdate();
	}

	@bind private onTransform( newTransform: AvNodeTransform ): void
	{
		let newSettings: CharmSettings = 
		{
			translate: newTransform.position,
			rotation: newTransform.rotation,
		}
		this.setState( { currentSettings: newSettings } );
		this.props.setSettings( this.props.id, newSettings );
	}

	private get settings(): CharmSettings
	{
		if( this.state.currentSettings )
		{
			return this.state.currentSettings;
		}
		else
		{
			return this.props.initialSettings;
		}
	}

	render()
	{
		let editMode = AvGadget.instance().editMode;
		let transform: AvNodeTransform = 
		{
			position: this.settings.translate,
			rotation: this.settings.rotation,
		};

		return 	(
			<AvTransformControl initialTransform={ transform }
				onSetValue= { this.onTransform } 
				translate={ editMode } rotate={ editMode } general={ editMode }
				key={ this.props.id }
				minimizeUntilNearby={ true }>
				<AvStandardHook persistentName={ "hook" + this.props.id } />
			</AvTransformControl> );
	}
}


interface CharmBraceletState
{
	highlight: HighlightType;
	charmCount: number;
}

interface CharmBraceletSettings
{
	charmCount: number;
	charms: { [id: number ]: CharmSettings };
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
	private m_charmSettings: { [ id: number ]: CharmSettings } = {};

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
		if( !settings )
		{
			settings = { charmCount: 1, charms: {} };
		}
		this.setState( { charmCount: settings.charmCount } );
		this.m_charmSettings = settings.charms;
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
				charms: this.m_charmSettings,
			};
			AvGadget.instance().saveSettings( settings );
		}
		this.forceUpdate();
	}

	@bind setCharmSetting( id: number, settings: CharmSettings )
	{
		this.m_charmSettings[ id ] = settings;
		this.m_dirty = true;
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
			let initialSettings: CharmSettings = this.m_charmSettings[ i ];

			if( !initialSettings )
			{
				initialSettings =
				{
					translate: { x: loc.x, y: loc.y, z: loc.z },
				}	
			}

			charms.push( <Charm id={ i } initialSettings={ initialSettings } setSettings={ this.setCharmSetting } /> );
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
