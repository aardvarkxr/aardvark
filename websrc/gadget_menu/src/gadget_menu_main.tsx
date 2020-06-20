import { AvComposedEntity, AvGadget, AvGadgetSeed, AvOrigin, AvPrimitive, AvStandardGrabbable, AvTransform, MoveableComponent, MoveableComponentState, PrimitiveType, ShowGrabbableChildren, AvModel, AvPanel, AvHeadFacingTransform, ActiveInterface, AvInterfaceEntity, nodeTransformToMat4, QuaternionToEulerAngles, EulerAnglesToQuaternion, nodeTransformFromMat4, GadgetSeedHighlight, AvHighlightTransmitters, k_GadgetInfoInterface, GadgetInfoEvent, renderGadgetIcon, PrimitiveYOrigin, AvLine, AvGrabButton } from '@aardvarkxr/aardvark-react';
import { EVolumeType, g_builtinModelGear, AvNodeTransform, emptyVolume, AardvarkManifest, g_builtinModelBarcodeScanner, g_builtinModelDropAttract, AvVolume, rayVolume, EndpointAddr, AvVector, EVolumeContext, g_builtinModelTrashcan, g_builtinModelStar, MsgDestroyGadget, MessageType } from '@aardvarkxr/aardvark-shared';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import Axios from 'axios';
import bind from 'bind-decorator';
import { vec3, vec4, mat4 } from '@tlaukkan/tsm';


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
					<div className="GadgetDescription">Delete control</div>
					<div className="GadgetDescription">Share control</div>
				</> }
			{ !props.manifest &&
				<div className="GadgetDescription">Aim the scanner at a gadget to learn more about it.</div>
			}
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

function makeRayFan( start: vec3, dir: vec3, angleDegrees: number, rayCount: number,
	context: EVolumeContext )
{
	let dirFakeUp = dir.equals( vec3.up, 0.01 ) ? vec3.forward : vec3.up;
	let dirFakeBack = dir.equals( vec3.up, 0.01 ) ? vec3.right : vec3.forward;

	let dirRight = vec3.cross( dir, dirFakeUp, new vec3() );
	let dirUp = vec3.cross( dirFakeBack, dirRight, new vec3() );

	let radius = Math.sin( angleDegrees * Math.PI / 180 );
	let dirs = [ dir ];
	for( let i = 0; i < rayCount; i++ )
	{
		let angle = i * 2 * Math.PI / rayCount;
		let nudgeRight = new vec3( dirRight.xyz ).scale( radius * Math.sin( angle ) );
		let nudgeUp = new vec3( dirUp.xyz ).scale( radius * Math.cos( angle ) );
		dirs.push( vec3.sum( dir, vec3.sum( nudgeRight, nudgeUp ), new vec3() ).normalize() );
	}

	let rays: AvVolume[] = [ rayVolume( start, dir ) ];
	for( let dir of dirs )
	{
		rays.push( { ...rayVolume( start, dir ), context } );
	}
	return rays;
}

const k_rayStart = new vec3( [  0.000, 0.045, -0.02 ] );
const k_rayDir = new vec3( [ 0, 0, -1 ] );

class ControlPanel extends React.Component< {}, ControlPanelState >
{
	private highlights = new Map<string, GadgetInfoPanel>();
	private registry: Registry;
	readonly rays = [ rayVolume( k_rayStart, k_rayDir ) ]
	// makeRayFan( k_rayStart, k_rayDir, 2.5, 8, EVolumeContext.Always )
	// 	.concat( makeRayFan(k_rayStart, k_rayDir, 5, 12, EVolumeContext.Always) )
	// 	.concat( makeRayFan(k_rayStart, k_rayDir, 7, 16, EVolumeContext.ContinueOnly ) )
	// 	.concat( makeRayFan(k_rayStart, k_rayDir, 9, 24, EVolumeContext.ContinueOnly ) );

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
	private onFavoriteGadget()
	{
		console.log( "Adding to favorites", this.state.scannerGadget?.gadgetUrl );
	}
	

	private renderGadgetScanner()
	{
		return (
			<AvStandardGrabbable modelUri={ g_builtinModelBarcodeScanner }
				canDropIntoContainers={ false } 
				grabberFromGrabbable={ {} }
				advertiseGadgetInfo={ false }
				showChildren={ ShowGrabbableChildren.OnlyWhenGrabbed }
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
					<AvTransform translateX={ -0.5 }>
						{ this.renderGadgetScanner() }
					</AvTransform>
				</AvTransform>
			</AvOrigin> );
	}
}


ReactDOM.render( <ControlPanel/>, document.getElementById( "root" ) );
