import { AvComposedEntity, AvGadget, AvGadgetSeed, AvOrigin, AvPrimitive, AvStandardGrabbable, AvTransform, MoveableComponent, MoveableComponentState, PrimitiveType, ShowGrabbableChildren, AvModel, AvPanel, AvHeadFacingTransform, ActiveInterface, AvInterfaceEntity, nodeTransformToMat4, QuaternionToEulerAngles, EulerAnglesToQuaternion, nodeTransformFromMat4, GadgetSeedHighlight, AvHighlightTransmitters, k_GadgetInfoInterface, GadgetInfoEvent } from '@aardvarkxr/aardvark-react';
import { EVolumeType, g_builtinModelGear, AvNodeTransform, emptyVolume, AardvarkManifest, g_builtinModelBarcodeScanner, g_builtinModelDropAttract, AvVolume, rayVolume, EndpointAddr } from '@aardvarkxr/aardvark-shared';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import Axios from 'axios';
import bind from 'bind-decorator';
import { vec3, vec4, mat4 } from '@tlaukkan/tsm';


const k_gadgetRegistryUI = "aardvark-gadget-registry@1";

interface InfoPanelProps
{
	children: JSX.Element[] | JSX.Element;
}

function InfoPanel( props: InfoPanelProps )
{
	return <div className="FullPageContentWrapperOuter"><div className="FullPageContentWrapperInner">
		<div className="GadgetInfoPanel">
			{ props.children }
		</div>
	</div>
		<AvTransform translateX={ 0.13 } translateZ={ 0.03 }>
			<AvPanel widthInMeters={ 0.2 } interactive={ false } />
		</AvTransform>
	</div>;
}


interface GadgetInfoPanelProps
{
	manifest: AardvarkManifest;
	highlight?: GadgetSeedHighlight;
}

function GadgetInfoPanel( props: GadgetInfoPanelProps )
{
	return <InfoPanel>
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


interface RegistryEntry
{
	url: string;
	manifest?: AardvarkManifest;
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

interface ScannerGadget
{
	gadgetUrl: string;
	gadgetManifest: AardvarkManifest;
	gadgetEndpoint: EndpointAddr;
}

interface ControlPanelState
{
	visible: boolean;
	registryLoadFailed?: boolean;
	transform?: AvNodeTransform;
	panel?: GadgetInfoPanel;
	scannerGadget?: ScannerGadget;
}

interface GadgetUIEvent
{
	type: "toggle_visibility";
}

class ControlPanel extends React.Component< {}, ControlPanelState >
{
	private highlights = new Map<string, GadgetInfoPanel>();
	private registry: Registry;

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
			this.registry = response.data as Registry;
			for( let entry of this.registry.gadgets )
			{
				AvGadget.instance().loadManifest( entry.url )
				.then( ( manifest: AardvarkManifest ) =>
				{
					// all we do here is stuff the manifest into the registry entry.
					// This will be populated into the UI itself next time the UI is 
					// rendered
					entry.manifest = manifest;
				} );
			}
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


	private renderGadgetSeedList()
	{
		let loadedEntries: RegistryEntry[] = [];
		for( let entry of this.registry?.gadgets ?? [] )
		{
			if( entry.manifest )
			{
				loadedEntries.push( entry );
			}
		}

		if( !loadedEntries.length )
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

		const k_cellWidth = 0.06;
		let rowCount = Math.ceil( loadedEntries.length / 3 );
		let top = rowCount * k_cellWidth;
		let seeds: JSX.Element[] = [];
		for( let gadgetIndex = 0; gadgetIndex < loadedEntries.length; gadgetIndex++ )
		{
			let gadget = loadedEntries[ gadgetIndex ];
			let col = gadgetIndex % 3;
			let row = Math.floor( gadgetIndex / 3 );

			seeds.push( 
				<AvTransform translateY = { top - row * k_cellWidth } 
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

	private renderGadgetScannerPanel()
	{
		if( !this.state.scannerGadget )
		{
			return <InfoPanel >
				<div>Point at a gadget to learn more about it.</div>
			</InfoPanel>;
		}
		else
		{
			return <GadgetInfoPanel manifest={ this.state.scannerGadget.gadgetManifest } />
		}
	}

	private renderGadgetScanner()
	{
		let ray = rayVolume( new vec3( [ 0, 0.02, -0.02 ] ), new vec3( [ 0, 0, -1 ] ) );

		return (
			<AvStandardGrabbable modelUri={ g_builtinModelBarcodeScanner }
				canDropIntoContainers={ false } 
				grabberFromGrabbable={ {} }
				advertiseGadgetInfo={ false }
				showChildren={ ShowGrabbableChildren.OnlyWhenGrabbed }
				>
				<AvHighlightTransmitters 
					highlightContentCallback={ this.generateGadgetInfoHighlight }
					interfaceName={ k_GadgetInfoInterface }/>
				<AvInterfaceEntity receives={
					[ { iface: k_GadgetInfoInterface, processor: this.onGadgetInfo } ]
					} volume={ ray } 
					priority={ 10 }/>
				{ this.renderGadgetScannerPanel() }
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
					<AvTransform translateX={ -0.5 }>
						{ this.renderGadgetScanner() }
					</AvTransform>
				</AvTransform>
			</AvOrigin> );
	}
}


ReactDOM.render( <ControlPanel/>, document.getElementById( "root" ) );
