import { ActiveInterface, AvGadget, AvGadgetSeed, AvGrabButton, AvHeadFacingTransform, AvHighlightTransmitters, AvInterfaceEntity, AvLine, AvModel, AvOrigin, AvPanel, AvPrimitive, AvStandardGrabbable, AvTransform, GadgetInfoEvent, GadgetSeedHighlight, HiddenChildrenBehavior, k_GadgetInfoInterface, PrimitiveType, PrimitiveYOrigin, renderGadgetIcon, ShowGrabbableChildren } from '@aardvarkxr/aardvark-react';
import { Av, WindowInfo, AardvarkManifest, AvNodeTransform, AvVector, emptyVolume, EndpointAddr, g_builtinModelBarcodeScanner, nodeTransformToMat4, nodeTransformFromMat4, g_builtinModelDropAttract, g_builtinModelNetwork, g_builtinModelHammerAndWrench, g_builtinModelStar, g_builtinModelTrashcan, MessageType, MsgDestroyGadget, rayVolume, MsgInstallGadget, g_builtinModelPanel, AvVolume, EVolumeType, g_builtinModelArrowFlat } from '@aardvarkxr/aardvark-shared';
import { mat4, vec3, vec4 } from '@tlaukkan/tsm';
import Axios from 'axios';
import bind from 'bind-decorator';
import * as React from 'react';
import * as ReactDOM from 'react-dom';


const k_gadgetRegistryUI = "aardvark-gadget-registry@1";

interface InfoPanelProps
{
	widthInMeters: number;
	translation: AvVector;
	children: JSX.Element[] | JSX.Element;
}

function InfoPanel( props: InfoPanelProps )
{
	return <div className="FullPageContentWrapperOuter"><div className="FullPageContentWrapperInner">
		<div className="GadgetInfoPanel">
			{ props.children }
		</div>
	</div>
		<AvTransform translateX={ props.translation.x } translateY={ props.translation.y }
			translateZ={ props.translation.z }>
			<AvPanel widthInMeters={ props.widthInMeters } interactive={ false } />
		</AvTransform>
	</div>;
}


interface GadgetInfoPanelProps
{
	manifest: AardvarkManifest;
	highlight?: GadgetSeedHighlight;
}

const k_desktopWindowGadget = "http://localhost:23842/gadgets/desktop_window";

function GadgetInfoPanel( props: GadgetInfoPanelProps )
{
	return <InfoPanel widthInMeters={ 0.2 } translation={ { x: 0.13, y: 0, z: 0.03 } }>
			<div className="GadgetName">{ props.manifest.name }</div>
			<div className="GadgetDescription">{ props.manifest.description }</div>
			{ props.manifest.categories && props.manifest.categories.length > 0 &&
				<div className="GadgetDescription">
					Categories: { props.manifest.categories.join( ", " ) }
				</div> }
			{ props.highlight == GadgetSeedHighlight.GadgetStarting &&
				<div className="GadgetMessage">Loading...</div> }
		</InfoPanel>
}

function windowDimsToSize( widthInPixels: number, heightInPixels: number, constraintInMeters: number )
{
	if( widthInPixels <= 0 || heightInPixels <= 0 )
	{
		return [constraintInMeters, constraintInMeters];
	}

	if( widthInPixels > heightInPixels )
	{
		return [ constraintInMeters, constraintInMeters * heightInPixels / widthInPixels ];
	}
	else
	{
		return [ constraintInMeters * widthInPixels / heightInPixels, constraintInMeters  ];
	}
}

interface WindowInfoPanelProps
{
	window: WindowInfo;
	highlight?: GadgetSeedHighlight;
}

function WindowInfoPanel( props: WindowInfoPanelProps )
{
	const [ previewWidth, previewHeight ] = 
		windowDimsToSize( props.window.texture.width, props.window.texture.height, 0.3 );

	return <>
		{/* <InfoPanel widthInMeters={ 0.2 } translation={ { x: 0.13, y: 0, z: 0.03 } }>
			<div className="GadgetName">{ props.window.name }</div>
			<div className="GadgetDescription">{ props.window.handle }</div>
			<div className="GadgetDescription">{ props.window.texture.width }</div>
			<div className="GadgetDescription">{ props.window.texture.height }</div>
		</InfoPanel> */}
		<AvTransform translateX={ 0.22 } translateZ={ 0.08 }
			rotateX={ 90 } rotateZ={ 30 }
			scaleX={ previewWidth } scaleZ={ previewHeight }>
			<AvModel uri={ g_builtinModelPanel } sharedTexure={ props.window.texture }/>
		</AvTransform>
		</>
}

interface GadgetScannerPanelProps
{
	manifest?: AardvarkManifest;
	endpointAddr?: EndpointAddr;
	gadgetUrl?: string;
	children?: JSX.Element[] | JSX.Element;
}

function GadgetScannerPanel( props: GadgetScannerPanelProps )
{
	return <InfoPanel widthInMeters={ 0.3 } translation={ { x: 0, y: 0.13, z: 0.03 } }>
			{ props.manifest && 
				<>
					<div className="GadgetName">{ props.manifest.name }</div>
					<div className="GadgetDescription">{ props.manifest.description }</div>
					{ props.manifest.categories && props.manifest.categories.length > 0 &&
						<div className="GadgetDescription">
							Categories: { props.manifest.categories.join( ", " ) }
						</div> }
				</> }
			{ !props.manifest &&
				<div className="GadgetDescription">Aim the scanner at a gadget to learn more about it.</div>
			}
		</InfoPanel>
}

interface ErrorPanelProps
{
	error: string;
}

function ErrorPanel( props: ErrorPanelProps )
{
	return <InfoPanel widthInMeters={ 0.3 } translation={ { x: 0, y: 0.13, z: 0.03 } }>
			<div className="GadgetDescription">{ props.error }</div>
		</InfoPanel>
}


interface RegistryEntry
{
	url: string;
}

interface Registry
{
	minimumAardvarkVersion: string;
	gadgets: RegistryEntry[];
}

interface GadgetInfoPanel
{
	gadgetUrl: string;
	highlight: GadgetSeedHighlight;
}

interface WindowInfoPanel
{
	window: WindowInfo;
	highlight: GadgetSeedHighlight;
}

interface ScannerGadget
{
	gadgetUrl: string;
	gadgetManifest: AardvarkManifest;
	gadgetEndpoint: EndpointAddr;
}

enum ControlPanelTab
{
	Main,
	Favorites,
	Builtin,
	DesktopWindows,
}

interface ControlPanelState
{
	visible: boolean;
	tab: ControlPanelTab;
	registryLoadFailed?: boolean;
	transform?: AvNodeTransform;
	panel?: GadgetInfoPanel;
	window?: WindowInfoPanel;
	scannerGadget?: ScannerGadget;
	windows?: WindowInfo[];
	scrollPosition: number;
}

interface GadgetUIEvent
{
	type: "toggle_visibility";
}


const k_rayStart = new vec3( [  0.000, 0.045, -0.02 ] );
const k_rayDir = new vec3( [ 0, 0, -1 ] );

interface GadgetMenuSettings
{
	favorites: string[];
}

const k_alwaysInstalledGadgets =
[
	"http://localhost:23842/gadgets/test_panel",
	"http://localhost:23842/gadgets/hand_mirror",
	"http://localhost:23842/gadgets/control_test",
	"http://localhost:23842/gadgets/whiteboard",
];

function subscribeWindowList(): Promise<WindowInfo[]>
{
	return new Promise( (resolve, reject ) =>
	{
		Av().subscribeWindowList( ( windows: WindowInfo[] ) =>
		{
			resolve( windows );
		})
	})
}


class ControlPanel extends React.Component< {}, ControlPanelState >
{
	private highlights = new Map<string, GadgetInfoPanel>();
	private windowHighlights = new Map<string, WindowInfoPanel>();
	private registry: Registry;
	readonly rays = [ rayVolume( k_rayStart, k_rayDir ) ];
	private settings: GadgetMenuSettings = null;
	private manifestsByUrl = new Map< string, AardvarkManifest >();

	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
			visible: false,
			tab: ControlPanelTab.Main,
			scrollPosition: 0,
		};

		AvGadget.instance().registerMessageHandler( MessageType.InstallGadget,  this.onWebFavorite );

		let settingsString = window.localStorage.getItem( "aardvark_gadget_menu_settings" );
		if( !settingsString )
		{
			this.settings = { favorites: [] };
		}
		else
		{
			this.settings = JSON.parse( settingsString ) as GadgetMenuSettings;
		}

		Axios.get( "https://aardvarkxr.github.io/gadget-registry/registry.json" )
		.then( ( response ) =>
		{
			this.registry = response.data as Registry;
			for( let entry of this.registry.gadgets )
			{
				this.requestManifest( entry.url );
			}
		} )
		.catch( ( reason: any ) =>
		{
			this.setState( { registryLoadFailed: true } );
		} );

		AvGadget.instance().getInstalledGadgets()
		.then( ( installedGadgets: string[] ) =>
		{
			let addedOne = false;
			for( let gadgetUrl of installedGadgets )
			{
				if( -1 == this.settings.favorites.indexOf( gadgetUrl ) )
				{
					console.log( `Adding favorite from installed list: ${ gadgetUrl } ` );
					this.settings.favorites.push( gadgetUrl );
					this.requestManifest( gadgetUrl );
					addedOne = true;
				}
			}

			if( addedOne )
			{
				this.updateSettings();
			}
		} );

		for( let favorite of this.settings.favorites )
		{
			this.requestManifest( favorite );
		}

		for( let builtin of k_alwaysInstalledGadgets )
		{
			this.requestManifest( builtin );
		}

		this.requestManifest( k_desktopWindowGadget );
	}

	private requestManifest( url: string )
	{
		AvGadget.instance().loadManifest( url )
		.then( ( manifest: AardvarkManifest ) =>
		{
			// all we do here is stuff the manifest into the map.
			// This will be populated into the UI itself next time the UI is 
			// rendered
			this.manifestsByUrl.set( url, manifest );
		} );
	}

	private updateSettings()
	{
		window.localStorage.setItem( "aardvark_gadget_menu_settings", JSON.stringify( this.settings ) );
	}

	private onSeedHighlight( gadgetUrl: string, highlight: GadgetSeedHighlight )
	{
		if( highlight == GadgetSeedHighlight.Idle )
		{
			this.highlights.delete( gadgetUrl );
		}
		else
		{
			this.highlights.set( gadgetUrl,
				{
					gadgetUrl,
					highlight,
				} );
		}

		let entry = this.highlights.entries().next();
		if( entry.done )
		{
			this.setState( { panel: null } );
		}
		else
		{
			this.setState( { panel: entry.value[1] } );
		}
	}


	private onWindowHighlight( window: WindowInfo, highlight: GadgetSeedHighlight )
	{
		if( highlight == GadgetSeedHighlight.Idle )
		{
			this.windowHighlights.delete( window.handle );
		}
		else
		{
			this.windowHighlights.set( window.handle,
				{
					window,
					highlight,
				} );
		}

		let entry = this.windowHighlights.entries().next();
		if( entry.done )
		{
			this.setState( { window: null } );
		}
		else
		{
			this.setState( { window: entry.value[1] } );
		}
	}

	componentDidUpdate( prevProps: {}, prevState: ControlPanelState )
	{
		if( this.state.tab == ControlPanelTab.DesktopWindows 
			&& prevState.tab != ControlPanelTab.DesktopWindows )
		{
			subscribeWindowList().then( ( windows: WindowInfo[] ) =>
			{
				this.setState( { windows } );
			} );	
		}
		else if( this.state.tab != ControlPanelTab.DesktopWindows 
			&& prevState.tab == ControlPanelTab.DesktopWindows )
		{
			Av().unsubscribeWindowList();
		}
	}


	private renderGadgetSeedList()
	{
		switch( this.state.tab )
		{
			case ControlPanelTab.Main:
				return this.renderMainTab();

			case ControlPanelTab.Builtin:
				return this.renderBuiltinTab();

			case ControlPanelTab.Favorites:
				return this.renderFavoritesTab();

			case ControlPanelTab.DesktopWindows:
				return this.renderDesktopWindowsTab();
		}
	}

	private renderMainTab()
	{
		let loadedEntries: string[] = [];
		for( let entry of this.registry?.gadgets ?? [] )
		{
			loadedEntries.push( entry.url );
		}

		return this.renderRegistryEntries( loadedEntries );
	}

	private renderBuiltinTab()
	{
		return this.renderRegistryEntries( k_alwaysInstalledGadgets );
	}

	private renderFavoritesTab()
	{
		return this.renderRegistryEntries( this.settings.favorites );
	}

	private renderFooter( canScrollUp?: boolean, canScrollDown?: boolean )
	{
		return <>
			{ this.renderTabButton( -0.105, g_builtinModelNetwork, ControlPanelTab.Main ) }
			{ this.renderTabButton(  -0.035, g_builtinModelHammerAndWrench, ControlPanelTab.Builtin ) }
			{ this.renderTabButton(  0.035, g_builtinModelStar, ControlPanelTab.Favorites ) }
			{ this.renderTabButton(  0.105, g_builtinModelStar, ControlPanelTab.DesktopWindows ) }
			
			<AvTransform translateY={ 0.05} rotateZ={ 90 }>
				<AvPrimitive type={ PrimitiveType.Cylinder } radius={ 0.003 } height={ 0.20 }/>
			</AvTransform>

			{ canScrollUp &&
				<AvTransform translateY={ 0.08 } translateX={ 0.16 } uniformScale={ 0.7 }>
					<AvGrabButton modelUri={ g_builtinModelArrowFlat } onClick={ this.onScrollUp }
						color="mediumblue"/>
				</AvTransform> }
			{ canScrollDown &&
				<AvTransform translateY={ 0.02 }  translateX={ 0.16 } rotateZ={ 180 } 
					uniformScale={ 0.7 }>
					<AvGrabButton modelUri={ g_builtinModelArrowFlat } onClick={ this.onScrollDown }
						color="mediumblue"/>
				</AvTransform> }
		</>;
	}

	@bind
	private onScrollUp()
	{
		this.setState( ( prevState: ControlPanelState ) => 
		{
			return { scrollPosition: Math.max( 0, prevState.scrollPosition - 1 ) };
		} );
	}

	@bind
	private onScrollDown()
	{
		this.setState( ( prevState: ControlPanelState ) => 
		{
			return { scrollPosition: prevState.scrollPosition + 1 };
		} );
	}
	
	private renderDesktopWindowsTab()
	{
		if( !this.state.windows || !this.state.windows.length )
		{
			return <>
				<ErrorPanel error="Collecting windows..."/>
				{ this.renderFooter( false, false ) }
			</>;
		}

		const k_maxVisibleRows = 3;
		const k_cellWidth = 0.10;
		const k_bottomPadding = 0.04;
		const k_thumbWidth = 0.9 * k_cellWidth;
		const k_columnCount = 3;
		const k_backgroundScale = 0.5;
		const k_backgroundShift = -0.03;

		let rowCount = Math.ceil( this.state.windows.length / k_columnCount );
		let top = k_maxVisibleRows * k_cellWidth;
		let seeds: JSX.Element[] = [];
		let topBackground: JSX.Element[] = [];
		let bottomBackground: JSX.Element[] = [];

		let canScrollDown = this.state.scrollPosition + k_maxVisibleRows < rowCount;
		let canScrollUp = this.state.scrollPosition > 0;

		let desktopWindowManifest = this.manifestsByUrl.get( k_desktopWindowGadget );
		if( desktopWindowManifest )
		{

			for( let windowIndex = 0; windowIndex < this.state.windows.length; windowIndex++ )
			{
				let window = this.state.windows[ windowIndex ];
				let col = windowIndex % k_columnCount;
				let row = Math.floor( windowIndex / k_columnCount );
	
				let background = false;
				if( row - this.state.scrollPosition >= k_maxVisibleRows 
					|| row < this.state.scrollPosition )
				{
					background = true;
				}

				if( window.texture.width <= 0 || window.texture.height <= 0 )
					continue;
	
				let cellSize = k_cellWidth;
				if( background )
					cellSize *= k_backgroundScale;

				const [ width, height ] = windowDimsToSize(window.texture.width, window.texture.height, 
					cellSize );

				let volume: AvVolume =
				{
					type: EVolumeType.AABB,
					aabb:
					{
						xMin: -width/2, xMax: width/2,
						yMin: -height/2, yMax: height/2,
						zMin: -0.01, zMax: 0.01,
					}
				};

				let displayRow = row - this.state.scrollPosition;

				if( background )
				{
					let targetList: JSX.Element[];
					let y:number;
					if( displayRow < 0 )
					{
						targetList = topBackground
						y = ( cellSize / 2 ) - displayRow * cellSize;
					}
					else
					{
						targetList = bottomBackground;
						y = -( cellSize / 2 ) -( displayRow - k_maxVisibleRows ) * cellSize;
					}

					let x:number = ( col - 1 ) * cellSize;
					targetList.push( 
						<AvTransform translateY = { y } translateX = { x } 
							key={ window.handle }>
							<AvTransform rotateX={ 90 } scaleX={ width } scaleZ={ height }>
								<AvModel uri={ g_builtinModelPanel } sharedTexure={ window.texture }
									color="#FFFFFF77"/>
							</AvTransform>
						</AvTransform> );
				}
				else
				{
					seeds.push( 
						<AvTransform translateY = { k_bottomPadding + top - displayRow * cellSize } 
							translateX = { ( col - 1 ) * cellSize } 
							key={ window.handle }>
	
							<AvGadgetSeed key="gadget" manifest={ desktopWindowManifest } 
								gadgetUrl={ k_desktopWindowGadget } 
								highlightCallback={ ( highlight: GadgetSeedHighlight ) =>
									{
										this.onWindowHighlight( window, highlight );
									} }
								interfaceLocks={
									[
										{
											iface: "aardvark-desktop-window@1",
											receiver: null,
											params: window,
										}
									]
								}
								customAppearance= 
								{
									<AvTransform rotateX={ 90 } scaleX={ width } scaleZ={ height }>
										<AvModel uri={ g_builtinModelPanel } sharedTexure={ window.texture }/>
									</AvTransform>
								} 
								customVolume={ volume }/>
	
							{ this.state.window?.window.handle == window.handle 
								&& !this.state.scannerGadget &&
								<WindowInfoPanel window={ window } 
									highlight={ this.state.window?.highlight } /> }
						</AvTransform>);
				}
			}
		}
		return <>
			{ topBackground && 
				<AvTransform rotateX={ -30 } translateZ={ k_backgroundShift } 
					translateY={ top + k_cellWidth}>
					{topBackground } </AvTransform > }
			{ bottomBackground && 
				<AvTransform rotateX={ 30 } translateZ={ k_backgroundShift } 
					translateY={ k_bottomPadding }>
					{ bottomBackground } </AvTransform > }
			{ seeds }
			{ this.renderFooter( canScrollUp, canScrollDown ) }
			</>;
	}

	private renderTabButton( translateX: number, modelUri: string, tab: ControlPanelTab )
	{
		let scale = this.state.tab == tab ? 2.2 : 1.5;
		return <AvTransform translateX={ translateX } uniformScale={ scale }>
				<AvGrabButton modelUri={ modelUri }
					onClick={ () => this.setState( { tab } ) }/>
			</AvTransform>;
	}

	private renderRegistryEntries( entryUrls: string[] )
	{
		let entries: { url: string, manifest: AardvarkManifest }[] = [];
		for( let url of entryUrls ?? [] )
		{
			if( this.manifestsByUrl.has( url ) )
			{
				entries.push( { url, manifest: this.manifestsByUrl.get( url ) } );
			}
		}

		let error: JSX.Element = null;
		if( !entries.length )
		{
			if( this.state.registryLoadFailed )
			{
				error = <ErrorPanel error="Error loading gadget registry" />;
			}
			else switch( this.state.tab )
			{
				case ControlPanelTab.Builtin:
				case ControlPanelTab.Main:
					error = <ErrorPanel error= "Loading gadget registry..." />;
					break;

				case ControlPanelTab.Favorites:
					error = <ErrorPanel error="Use the gadget scanner to add favorites." />;
					break;
			}
		}

		const k_cellWidth = 0.06;
		const k_bottomPadding = 0.04;
		let rowCount = Math.ceil( entries.length / 3 );
		let top = rowCount * k_cellWidth;
		let seeds: JSX.Element[] = [];
		for( let gadgetIndex = 0; gadgetIndex < entries.length; gadgetIndex++ )
		{
			let gadget = entries[ gadgetIndex ];
			let col = gadgetIndex % 3;
			let row = Math.floor( gadgetIndex / 3 );

			seeds.push( 
				<AvTransform translateY = { k_bottomPadding + top - row * k_cellWidth } 
					translateX = { ( col - 1 ) * k_cellWidth } 
					key={ gadget.url } >

					<AvTransform rotateX={ 90 }>
						<AvGadgetSeed key="gadget" manifest={ gadget.manifest } gadgetUrl={ gadget.url } 
							radius={ 0.025 }
							highlightCallback={ ( highlight: GadgetSeedHighlight ) =>
								{
									this.onSeedHighlight( gadget.url, highlight );
								} }/>
					</AvTransform>

					{ this.state.panel?.gadgetUrl == gadget.url 
						&& !this.state.scannerGadget &&
						<GadgetInfoPanel manifest={ gadget.manifest } 
							highlight={ this.state.panel.highlight } /> }
				</AvTransform>);
		}
		return <>
			{ seeds }
			{ error }

			{ this.renderFooter() }
			</>;
	}

	private show( stageFromHeadTransform: AvNodeTransform )
	{
		let stageFromHead = nodeTransformToMat4( stageFromHeadTransform );

		let menuPos = new vec3( stageFromHead.multiplyVec4( new vec4( [ 0, 0, -0.5, 1 ] ) ).xyz );
		let headPos = new vec3( stageFromHead.multiplyVec4( new vec4( [ 0, 0, 0, 1 ] ) ).xyz );

		let z = vec3.difference( headPos, menuPos );
		if( z.length() < 0.05 )
		{
			z = vec3.forward;
		}
		else
		{
			z.y = 0;
			z = z.normalize();	
		}

		let y = vec3.up;

		let x = vec3.cross( y, z );

		let mat = new mat4([
            x.x,
            x.y,
            x.z,
            0,

            y.x,
            y.y,
            y.z,
            0,

            z.x,
            z.y,
            z.z,
            0,

			menuPos.x, menuPos.y, menuPos.z, 1,
		] );
		
		let transform = nodeTransformFromMat4( mat );
		this.setState( { visible: true, transform } );
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
			//window.close();
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

	@bind
	private generateGadgetInfoHighlight()
	{
		return 	<AvHeadFacingTransform>
			<AvTransform rotateX={ 90 } uniformScale={ 0.5 } translateZ={ 0.02 }>
				<AvModel uri={ g_builtinModelDropAttract } color="lightgreen"/>
			</AvTransform>
		</AvHeadFacingTransform>;
	}

	@bind
	private onGadgetInfo( gadgetInfoInterface: ActiveInterface )
	{
		gadgetInfoInterface.onEvent( ( event: GadgetInfoEvent ) =>
		{
			switch( event.type )
			{
				case "gadget_info":
					this.setState( { scannerGadget:
						{
							gadgetUrl: event.gadgetUrl,
							gadgetManifest: event.gadgetManifest,
							gadgetEndpoint: gadgetInfoInterface.peer,
						} } );
					break;
			}
		} );

		gadgetInfoInterface.onEnded( () => 
		{
			this.setState( { scannerGadget: null } );
		} );
	}

	@bind
	private onTrashGadget()
	{
		if( !this.state.scannerGadget )
			return;

		let m: MsgDestroyGadget =
		{
			gadgetId: this.state.scannerGadget.gadgetEndpoint.endpointId
		};

		AvGadget.instance().sendMessage( MessageType.DestroyGadget, m );
	}

	@bind 
	private onWebFavorite( m: MsgInstallGadget )
	{
		this.addFavorite( m.gadgetUri );
	}


	@bind
	private onFavoriteGadget()
	{
		if( !this.state.scannerGadget?.gadgetUrl )
			return;

		this.addFavorite( this.state.scannerGadget.gadgetUrl,
			this.state.scannerGadget.gadgetManifest );
	}

	private addFavorite( gadgetUrl: string, manifest?: AardvarkManifest )
	{
		if( -1 == this.settings.favorites.indexOf( gadgetUrl ) )
		{
			console.log( `Adding to favorites: ${ gadgetUrl } ` );
			this.settings.favorites.push( gadgetUrl );
			this.updateSettings();

			if( !this.manifestsByUrl.has( gadgetUrl ) )
			{
				if( !manifest )
				{
					this.requestManifest( gadgetUrl );
				}
				else
				{
					this.manifestsByUrl.set( gadgetUrl, manifest );
				}
			}

			if( this.state.tab == ControlPanelTab.Favorites )
			{
				this.forceUpdate();
			}
		}
		else
		{
			console.log( `Favorites already contains: ${ gadgetUrl } ` );
		}
	}
	

	private renderGadgetScanner()
	{
		return (
			<AvStandardGrabbable modelUri={ g_builtinModelBarcodeScanner }
				canDropIntoContainers={ false } 
				grabberFromGrabbable={ {} }
				advertiseGadgetInfo={ false }
				showChildren={ ShowGrabbableChildren.OnlyWhenGrabbed }
				hiddenChildrenBehavior={ HiddenChildrenBehavior.Omit }
				>

				{
					!this.state.scannerGadget &&
					<AvTransform translateY={ 0.045 } translateZ={ -0.02 } rotateX={ -90 }>
						<AvPrimitive type={ PrimitiveType.Cylinder }
							radius={ 0.005 } height={ 2 } 
							originY={ PrimitiveYOrigin.Bottom }
							color="darkgreen"/>
					</AvTransform>
				}

				<AvHighlightTransmitters 
					highlightContentCallback={ this.generateGadgetInfoHighlight }
					interfaceName={ k_GadgetInfoInterface }/>
				<AvInterfaceEntity receives={
					[ { iface: k_GadgetInfoInterface, processor: this.onGadgetInfo } ]
					} volume={ this.rays } 
					priority={ 10 }/>
				<GadgetScannerPanel 
					manifest={ this.state.scannerGadget?.gadgetManifest } 
					gadgetUrl={ this.state.scannerGadget?.gadgetUrl }
					endpointAddr={ this.state.scannerGadget?.gadgetEndpoint }
				/>

				{ this.state.scannerGadget &&
					<>
						<AvTransform translateY={ 0.20 } rotateX={ 90 }>
							{ renderGadgetIcon( this.state.scannerGadget.gadgetUrl, 
								this.state.scannerGadget.gadgetManifest, 0.03 ) }
						</AvTransform> 
						<AvTransform translateY={ 0.045 } translateZ={ -0.02 } rotateX={ -90 }>
							<AvLine thickness={ 0.006 } endId={ this.state.scannerGadget.gadgetEndpoint }
								color="lightgreen"/>
						</AvTransform>
						<AvTransform translateY={ 0.10 } translateX={ -0.03 } translateZ={ 0.05 } 
							rotateX={ -90 }
							uniformScale={ 0.2 }>
							<AvGrabButton modelUri={ g_builtinModelTrashcan } 
								onClick={ this.onTrashGadget }/>
						</AvTransform>
						<AvTransform translateY={ 0.10 } translateX={ 0.03 } translateZ={ 0.05 }>
							<AvGrabButton modelUri={ g_builtinModelStar } 
								onClick={ this.onFavoriteGadget }/>
						</AvTransform>
					</> }

			</AvStandardGrabbable> );
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
				<AvTransform transform={ this.state.transform } visible={ this.state.visible }>
					{ this.renderGadgetSeedList() }
					<AvTransform translateX={ -0.30 } translateZ={ 0.15 } rotateY={ 30 }>
						{ this.renderGadgetScanner() }
					</AvTransform>
				</AvTransform>
			</AvOrigin> );
	}
}


ReactDOM.render( <ControlPanel/>, document.getElementById( "root" ) );
