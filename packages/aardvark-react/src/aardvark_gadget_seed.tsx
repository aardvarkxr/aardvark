import * as React from 'react';
import { AvBaseNodeProps } from './aardvark_base_node';
import bind from 'bind-decorator';
import { HighlightType, GrabResponse, AvGrabbable } from './aardvark_grabbable';
import { AvTransform } from './aardvark_transform';
import { AvSphereHandle } from './aardvark_handles';
import { AvModel } from './aardvark_model';
import { EndpointAddr, AvGrabEvent, AardvarkManifest, endpointAddrIsEmpty, AvVector, g_builtinModelError, endpointAddrToString, EVolumeType, Av, InitialInterfaceLock } from '@aardvarkxr/aardvark-shared';
import { AvGadget } from './aardvark_gadget';
import isUrl from 'is-url';
import { MoveableComponentState, MoveableComponent } from './component_moveable';
import { SimpleContainerComponent } from './component_simple_container';
import { AvComposedEntity, EntityComponent } from './aardvark_composed_entity';
import { ActiveInterface, InterfaceProp } from './aardvark_interface_entity';
import { AvEntityChild } from './aardvark_entity_child';


interface AvGadgetSeedProps extends AvBaseNodeProps
{
	/** The URI of the gadget for which this node is a seed. 
	 * Gadget URIs are everything up to but not including the 
	 * "/manifest.webmanifest" part of the path.
	*/
	uri: string;

	/** Size in meters of the gadget seed. This will control both
	 * the active area and the scale of the gadget's model, at least
	 * for gadget models that are centered around the origin.
	 * 
	 * @default 0.1
	 */
	radius?: number;
}

enum GadgetSeedPhase
{
	Idle,
	GrabberNearby,
	WaitingForGadgetStart,
	WaitingForDrop,
}

interface AvGadgetSeedState
{
	phase: GadgetSeedPhase;
	manifest?: AardvarkManifest;
}


export class GadgetSeedContainerComponent implements EntityComponent
{
	private contentsEpa: EndpointAddr;
	private contentsRested = false;
	private entityCallback: () => void = null;
	private activeContainer: ActiveInterface = null;

	constructor()
	{
	}

	private updateListener()
	{
		this.entityCallback?.();
	}

	@bind
	private onContainerStart( activeContainer: ActiveInterface )
	{
		this.contentsEpa = activeContainer.peer;

		activeContainer.onEvent( 
			( event: any ) =>
			{
				this.contentsRested = event.state == "Resting";
				this.updateListener();
			}
		)

		activeContainer.onEnded( 
			() =>
			{
				this.contentsRested = false;
				this.contentsEpa = null;
				this.updateListener();
			} );
	}

	public get transmits(): InterfaceProp[]
	{
		return [];
	}

	public get receives(): InterfaceProp[]
	{
		return [ { iface: "aardvark-container@1", processor: this.onContainerStart } ];
	}

	public get parent(): EndpointAddr
	{
		return null;
	}
	
	public get wantsTransforms()
	{
		return false;
	}


	public get interfaceLocks(): InitialInterfaceLock[] { return []; }
	
	public onUpdate( callback: () => void ): void
	{
		this.entityCallback = callback;
	}


	public render(): JSX.Element
	{
		if( this.contentsEpa && this.contentsRested )
		{
			return <AvEntityChild child={ this.contentsEpa }/>
		}
		else
		{
			return null;
		}
	}
}

/** A grabbable control that causes the grabber to grab a new
 * instance of a gadget instead of the control itself. 
 */
export class AvGadgetSeed extends React.Component< AvGadgetSeedProps, AvGadgetSeedState >
{
	private moveableComponent = new MoveableComponent( this.onMoveableUpdate );
	private containerComponent = new GadgetSeedContainerComponent();
	private refContainer = React.createRef<AvComposedEntity>();

	constructor( props:any )
	{
		super( props );

		this.state = { phase: GadgetSeedPhase.Idle };

		AvGadget.instance().loadManifest( this.props.uri )
		.then( ( manifest: AardvarkManifest ) =>
		{
			this.setState( { manifest } );
		})
	}

	@bind
	private async onMoveableUpdate()
	{
		switch( this.state.phase )
		{
			case GadgetSeedPhase.Idle:
				if( this.moveableComponent.state == MoveableComponentState.GrabberNearby)
				{
					this.setState( { phase: GadgetSeedPhase.GrabberNearby } );
				}
				break;

			case GadgetSeedPhase.GrabberNearby:
				switch( this.moveableComponent.state )
				{
					case MoveableComponentState.InContainer: 
						// This means we missed the grab and were already dropped?
					case MoveableComponentState.Grabbed:
						this.setState( { phase: GadgetSeedPhase.WaitingForGadgetStart } );
						this.startGadget();
						break;

					case MoveableComponentState.Idle:
						this.setState( { phase: GadgetSeedPhase.Idle } );
						break;

					case MoveableComponentState.GrabberNearby:
						// do nothing. We're already in the right state
						break;
				}
				break;

			case GadgetSeedPhase.WaitingForGadgetStart:
				// in this state we're mostly going to ignore moveable state changes.
				// Our next internal state change will be driven by the gadget starting
				break;

			case GadgetSeedPhase.WaitingForDrop:
				if( this.moveableComponent.state == MoveableComponentState.InContainer )
				{
					this.dropGadgetOnParent();
				}
				break;
		}
	}

	private async startGadget()
	{
		let res = await AvGadget.instance().startGadget( this.props.uri, 
			endpointAddrToString( this.refContainer.current.globalId ) );

		if( !res.success )
		{
			throw new Error( "startGadget failed" );
		}

		// we should have a gadget in our container by now? Maybe?
		this.setState( { phase: GadgetSeedPhase.WaitingForDrop } );
	}

	private dropGadgetOnParent()
	{

	}

	@bind public onGadgetStarted( success: boolean, mainGrabbableId: string ) 
	{
		console.log( "main grabbable id was "+ mainGrabbableId );
	}
	
	private findIconOfType( mimeType: string )
	{
		if( !this.state.manifest.icons )
			return null;

		for( let icon of this.state.manifest.icons )
		{
			if( icon.type.toLowerCase() == mimeType.toLowerCase() )
			{
				return icon;
			}
		}

		return null;
	}


	private renderGadgetIcon( radius: number )
	{
		let model = this.findIconOfType( "model/gltf-binary" );
		if( model )
		{
			let modelUrl = isUrl( model.src ) ? model.src : this.props.uri + "/" + model.src;

			return <AvModel uri= { modelUrl } scaleToFit={ { x: radius, y: radius, z: radius } }/>;
		}

		return <AvModel uri= { g_builtinModelError } scaleToFit={ { x: radius, y: radius, z: radius } }/>;
	}

	public render()
	{
		if( !this.state.manifest )
			return null;

		let radius = this.props.radius ? this.props.radius : 0.1;

		let scale:number;
		switch( this.state.phase )
		{
			case GadgetSeedPhase.Idle:
				scale = 1.0;
				break;

			default:
				scale = 1.25;
				break;
		}

		return (
			<AvComposedEntity components={ [ this.moveableComponent ] } 
				volume={ { type: EVolumeType.Sphere, radius: radius } } >
				{ this.state.phase != GadgetSeedPhase.WaitingForDrop &&
					<AvTransform uniformScale={ scale }>
						{ this.renderGadgetIcon( radius ) }
					</AvTransform>
				}
				<AvComposedEntity components={ [ this.containerComponent ] }
					ref={ this.refContainer } volume={ { type: EVolumeType.Empty } } />
			</AvComposedEntity> );
	}


}
