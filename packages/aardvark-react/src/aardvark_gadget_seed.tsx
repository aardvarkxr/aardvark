import { AardvarkManifest, AvNodeTransform, AvVolume, EndpointAddr, endpointAddrToString, EVolumeType, g_builtinModelError, InitialInterfaceLock, quatFromAxisAngleDegrees } from '@aardvarkxr/aardvark-shared';
import { vec3 } from '@tlaukkan/tsm';
import bind from 'bind-decorator';
import isUrl from 'is-url';
import * as React from 'react';
import { AvBaseNodeProps } from './aardvark_base_node';
import { AvComposedEntity, EntityComponent } from './aardvark_composed_entity';
import { AvEntityChild } from './aardvark_entity_child';
import { AvGadget } from './aardvark_gadget';
import { ActiveInterface, InterfaceProp } from './aardvark_interface_entity';
import { AvModel } from './aardvark_model';
import { AvTransform } from './aardvark_transform';
import { ContainerRequest, ContainerRequestType, MoveableComponent, MoveableComponentState } from './component_moveable';

export enum GadgetSeedHighlight
{
	Idle,
	GrabberNearby,
	GadgetStarting,
}


interface AvGadgetSeedProps extends AvBaseNodeProps
{
	/** The manifest object for this gadget. These can be loaded from
	 * gadget URLs with AvGadget.instance().loadManifest(...).
	*/
	manifest: AardvarkManifest;

	/** The gadget URL that the manifest was loaded form. The gadget
	 * seed needs to this so it can load the gadget's icon, and also
	 * to start the gadget.
	 */
	gadgetUrl: string;

	/** Size in meters of the gadget seed. This will control both
	 * the active area and the scale of the gadget's model, at least
	 * for gadget models that are centered around the origin.
	 * 
	 * @default 0.1
	 */
	radius?: number;

	/** Called when the seed is highlighted or unhighlighted. */
	highlightCallback?: ( highlight: GadgetSeedHighlight ) => void;
}


enum GadgetSeedPhase
{
	Idle,
	GrabberNearby,
	WaitingForGadgetStart,
	WaitingForRegrab,
	WaitingForRedropToFinish,
}

interface AvGadgetSeedState
{
	phase: GadgetSeedPhase;
}


const k_seedFromGadgetQuat = quatFromAxisAngleDegrees( vec3.right, -90 );
const k_seedFromGadget: AvNodeTransform = { rotation: { x: k_seedFromGadgetQuat.x, y: k_seedFromGadgetQuat.y, z: k_seedFromGadgetQuat.z, w: k_seedFromGadgetQuat.w } };

export class GadgetSeedContainerComponent implements EntityComponent
{
	private contentsEpa: EndpointAddr;
	private contentsRested = false;
	private entityCallback: () => void = null;
	private activeContainer: ActiveInterface = null;
	private childAddedCallback: () => void;
	private childRemovedCallback: () => void;

	constructor( childAddedCallback: () => void, childRemovedCallback: () => void )
	{
		this.childAddedCallback = childAddedCallback;
		this.childRemovedCallback = childRemovedCallback;
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
				this.activeContainer = null;
				this.updateListener();
				this.childRemovedCallback?.();
			} );

		this.activeContainer = activeContainer;
		this.childAddedCallback?.();
	}

	public get transmits(): InterfaceProp[]
	{
		return [];
	}

	public get receives(): InterfaceProp[]
	{
		return [ { iface: MoveableComponent.containerInterface, processor: this.onContainerStart } ];
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

	public redrop( newContainer: EndpointAddr, moveableToReplace: EndpointAddr )
	{
		if( this.activeContainer )
		{
			let req: ContainerRequest =
			{ 
				type: ContainerRequestType.Redrop, 
				newContainer, 
				moveableToReplace,
				oldMoveableFromNewMoveable: k_seedFromGadget,
			};
	
			this.activeContainer.sendEvent( req );
		}
	}

	public onUpdate( callback: () => void ): void
	{
		this.entityCallback = callback;
	}


	public get child(): EndpointAddr
	{
		return this.activeContainer?.peer;
	}

	public render(): JSX.Element
	{
		if( this.contentsEpa && this.contentsRested )
		{
			return <AvTransform rotateX={ -90 } key="seed">
			 		<AvEntityChild child={ this.contentsEpa } key={ endpointAddrToString( this.contentsEpa ) }/>
				</AvTransform>
		}
		else
		{
			return null;
		}
	}
}

function findIconOfType( manifest: AardvarkManifest, mimeType: string )
{
	if( !manifest.icons )
		return null;

	for( let icon of manifest.icons )
	{
		if( icon.type.toLowerCase() == mimeType.toLowerCase() )
		{
			return icon;
		}
	}

	return null;
}


export function renderGadgetIcon( gadgetUrl: string, manifest: AardvarkManifest, radius: number )
{
	let model = findIconOfType( manifest, "model/gltf-binary" );
	if( model )
	{
		let modelUrl = isUrl( model.src ) ? model.src : gadgetUrl + 
			"/" + model.src;

		return <AvModel uri= { modelUrl } scaleToFit={ { x: radius, y: radius, z: radius } }/>;
	}

	return <AvModel uri= { g_builtinModelError } scaleToFit={ { x: radius, y: radius, z: radius } }/>;
}


/** A grabbable control that causes the grabber to grab a new
 * instance of a gadget instead of the control itself. 
 */
export class AvGadgetSeed extends React.Component< AvGadgetSeedProps, AvGadgetSeedState >
{
	private moveableComponent = new MoveableComponent( this.onMoveableUpdate );
	private containerComponent = new GadgetSeedContainerComponent( this.onNewChild, this.onLostChild );
	private refContainer = React.createRef<AvComposedEntity>();
	private refSeed = React.createRef<AvComposedEntity>();

	constructor( props:any )
	{
		super( props );

		this.state = { phase: GadgetSeedPhase.Idle };
	}

	private seedPhaseToHighlight( phase: GadgetSeedPhase )
	{
		switch( phase )
		{
			default:
			case GadgetSeedPhase.Idle:
				return GadgetSeedHighlight.Idle;

			case GadgetSeedPhase.GrabberNearby:
				return GadgetSeedHighlight.GrabberNearby;

			case GadgetSeedPhase.WaitingForGadgetStart:
			case GadgetSeedPhase.WaitingForRedropToFinish:
			case GadgetSeedPhase.WaitingForRegrab:
				return GadgetSeedHighlight.GadgetStarting;
		}
	}


	componentDidUpdate( prevProps: AvGadgetSeedProps, prevState: AvGadgetSeedState )
	{
		let oldHighlight = this.seedPhaseToHighlight( prevState.phase );
		let newHighlight = this.seedPhaseToHighlight( this.state.phase );
		if( oldHighlight != newHighlight )
		{
			console.log( `Changing from ${ GadgetSeedHighlight[ oldHighlight ] } to ${ GadgetSeedHighlight[ newHighlight ] }` );
			this.props.highlightCallback?.( newHighlight );
		}
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

					case MoveableComponentState.InContainer: 
						// This means we missed the grab and were already dropped?
						break;
				}
				break;

			case GadgetSeedPhase.WaitingForGadgetStart:
				// in this state we're mostly going to ignore moveable state changes.
				// Our next internal state change will be driven by the gadget starting
				break;

		}
	}

	@bind
	private onNewChild()
	{
		console.log( "onNewChild" );
		switch ( this.moveableComponent.state )
		{
			case MoveableComponentState.Grabbed:
				console.log( `regrabbing new gadget moveable ${ endpointAddrToString( this.containerComponent.child ) }` );
				this.triggerRegrab();
				break;
			case MoveableComponentState.GrabberNearby:
			case MoveableComponentState.InContainer:
				console.log( `redropping new gadget moveable ${ endpointAddrToString( this.containerComponent.child ) }` );
				this.containerComponent.redrop( this.moveableComponent.parent, this.refSeed.current.globalId );
				this.setState( { phase: GadgetSeedPhase.WaitingForRedropToFinish } );
				break;
			case MoveableComponentState.Idle:
				console.log( "How did we get all the way back to idle?" );
				break;
		}
	}

	@bind
	private onLostChild()
	{
		console.log( "lost child in container" );
		switch( this.state.phase )
		{
			case GadgetSeedPhase.WaitingForRedropToFinish:
			case GadgetSeedPhase.WaitingForRegrab:
				// we've been dropped
				this.setState( { phase: GadgetSeedPhase.Idle } );
				this.moveableComponent.reset();
				break;
		}
	}

	private async startGadget()
	{
		let res = await AvGadget.instance().startGadget( this.props.gadgetUrl, 
			[
				{ 
					iface: MoveableComponent.containerInterface,
					receiver: this.refContainer.current.globalId,
				}
			] );

		if( !res.success )
		{
			this.setState( { phase: GadgetSeedPhase.Idle } );
			throw new Error( "startGadget failed" );
		}
	}

	private triggerRegrab()
	{
		this.moveableComponent.triggerRegrab( this.containerComponent.child, k_seedFromGadget );
		this.setState( { phase: GadgetSeedPhase.WaitingForRegrab } );
	}

	@bind public onGadgetStarted( success: boolean, mainGrabbableId: string ) 
	{
		console.log( "main grabbable id was "+ mainGrabbableId );
	}
	

	public render()
	{
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

		let volume: AvVolume;
		if( this.state.phase == GadgetSeedPhase.WaitingForRedropToFinish )
		{
			// we want to not match against the container we're telling our child to redrop into
			volume = { type: EVolumeType.Empty };
		}
		else
		{
			volume = { type: EVolumeType.Sphere, radius: radius };
		}

		let drawIcon = this.state.phase != GadgetSeedPhase.WaitingForRegrab 
			&& this.state.phase != GadgetSeedPhase.WaitingForRedropToFinish;
		return (
			<AvComposedEntity components={ [ this.moveableComponent ] } ref={ this.refSeed }
				volume={ volume } >
				{ drawIcon &&
					<AvTransform uniformScale={ scale }>
						{ renderGadgetIcon( this.props.gadgetUrl, this.props.manifest, radius ) }
					</AvTransform>
				}
				<AvComposedEntity components={ [ this.containerComponent ] }
					ref={ this.refContainer } volume={ { type: EVolumeType.Empty } } />
			</AvComposedEntity> );
	}


}
