import { ActiveInterface, AvComposedEntity, AvEntityChild, AvGadget, AvGrabButton, AvInterfaceEntity, AvModel, AvModelTransform, AvOrigin, AvPrimitive, AvTransform, GrabPose, GrabRequest, GrabRequestType, k_MenuInterface, MenuEvent, MenuEventType, PanelRequest, PanelRequestType, PrimitiveType, PrimitiveYOrigin, SimpleContainerComponent } from '@aardvarkxr/aardvark-react';
import { InputProcessor, AvNodeTransform, AvQuaternion, AvVolume, g_builtinAnims, EHand, emptyVolume, EndpointAddr, endpointAddrsMatch, endpointAddrToString, EVolumeContext, EVolumeType, g_builtinModelGear, handToDevice, InterfaceLockResult, multiplyTransforms, rayVolume, g_builtinModelSkinnedHandLeft, g_builtinModelSkinnedHandRight, Av, g_anim_Left_ThumbsUp } from '@aardvarkxr/aardvark-shared';
import { vec3 } from '@tlaukkan/tsm';
import bind from 'bind-decorator';
import { initSentryForBrowser } from 'common/sentry_utils';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { k_actionSets } from './default_hands_input';

initSentryForBrowser();

const k_gadgetRegistryUI = "aardvark-gadget-registry@1";

interface DefaultHandProps
{
	hand: EHand;
}

enum GrabberState
{
	Idle,
	Highlight,
	Grabbing,
	LostGrab,
	GrabReleased,
	WaitingForDropComplete,
	WaitingForRegrab,
	WaitingForRegrabDropComplete,
	WaitingForRegrabNewMoveable,
	GrabFailed,

	Menu,
}

interface DefaultHandState
{
	activeGrab: ActiveInterface;
	activePanel1: ActiveInterface;
	activePanel2: ActiveInterface;
	activeMenu: ActiveInterface;
	grabberFromGrabbableOverride?: AvNodeTransform | GrabPose;
	grabberFromGrabbableDirection?: vec3;
	grabberFromGrabbableRange?: number;
	grabberFromGrabbableRotation?: AvQuaternion;
	state: GrabberState;
	regrabTarget?: EndpointAddr;
	grabberFromRegrabTarget?: AvNodeTransform;
	showRay?: boolean;
	wasShowingRay?: boolean;
}

enum ButtonState
{
	Idle, // not pressed
	Pressed, // pressed and active
	Suppressed, // pressed, but we're ignoring this press for whatever reason
}

let inputProcessor = new InputProcessor( k_actionSets );

class DefaultHand extends React.Component< DefaultHandProps, DefaultHandState >
{
	private grabListenerHandle = 0;
	private menuListenerHandle = 0;
	private containerComponent = new SimpleContainerComponent();
	private grabPressed = ButtonState.Idle;
	private menuPressed = ButtonState.Idle;
	private grabRayHandler = 0;
	private grabMoveHandler = 0;
	private lastMoveTime = 0;

	constructor( props: any )
	{
		super( props );

		this.state = 
		{ 
			activeGrab: null,
			activePanel1: null,
			activePanel2: null,
			activeMenu: null,
			state: GrabberState.Idle,
		};

		this.grabListenerHandle = inputProcessor.registerBooleanCallbacks( "interact", "grab", 
			handToDevice( this.props.hand ), 
			this.onGrabPressed, this.onGrabReleased );
		this.menuListenerHandle = inputProcessor.registerBooleanCallbacks( "interact", "menu", 
			handToDevice( this.props.hand ), 
			this.onMenuPressed, this.onMenuReleased );
		this.grabRayHandler = inputProcessor.registerBooleanCallbacks( "default", "showRay", 
			handToDevice( this.props.hand ), 
			this.onGrabShowRay, this.onGrabHideRay );
		this.grabMoveHandler = inputProcessor.registerVector2Callback( "grabbed", "move",
			handToDevice( this.props.hand ), this.onGrabMove );
	
		this.containerComponent.onItemChanged( () => this.forceUpdate() );

		inputProcessor.activateActionSet( "default", handToDevice( this.props.hand ) );

		Av().registerSceneApplicationNotification( this.onSceneAppChanged );
	}

	componentWillUnmount()
	{
		inputProcessor.unregisterCallback( this.grabListenerHandle );
		inputProcessor.unregisterCallback( this.menuListenerHandle );
		inputProcessor.unregisterCallback( this.grabRayHandler );
		inputProcessor.unregisterCallback( this.grabMoveHandler );
	}

	componentDidUpdate( prevProps: DefaultHandProps, prevState: DefaultHandState )
	{
		if( this.state.activeGrab || this.state.activePanel1 || this.state.activeMenu )
		{
			inputProcessor.activateActionSet( "interact", handToDevice( this.props.hand ) );
		}
		else
		{
			inputProcessor.deactivateActionSet( "interact", handToDevice( this.props.hand ) );
		}
	}

	@bind
	private onSceneAppChanged()
	{
		this.forceUpdate();
	}

	@bind
	private onGrabMove( newValue: [ number, number ] )
	{
		const k_moveSpeed = 2.0; // meters per second

		let now = performance.now();
		let elapsedSeconds = Math.max( 0, ( now - this.lastMoveTime ) / 1000 );
		this.lastMoveTime = now;

		this.setState( (prevState: DefaultHandState ) =>
		{
			return { grabberFromGrabbableRange: prevState.grabberFromGrabbableRange 
				+ elapsedSeconds * k_moveSpeed * newValue[ 1 ] };
		} );
	}

	private startGrabMove()
	{
		inputProcessor.activateActionSet( "grabbed", handToDevice( this.props.hand ) );
		this.lastMoveTime = performance.now();
	}

	private stopGrabMove()
	{
		inputProcessor.deactivateActionSet( "grabbed", handToDevice( this.props.hand ) );
	}

	@bind
	private onGrabShowRay()
	{
		// skip the ray when we already have something interesting going on.
		if( this.state.state != GrabberState.Idle 
			|| this.state.activePanel1 || this.state.activePanel2 )
			return;

		this.setState( 
			{ 
				showRay: true
			} );
	}

	@bind
	private onGrabHideRay()
	{
		this.setState( 
			{ 
				showRay: false
			} );
	}

	@bind
	private async onGrabPressed()
	{
		switch( this.grabPressed )
		{
			case ButtonState.Idle:
				if( this.menuPressed == ButtonState.Pressed )
				{
					console.log( "Menu pressed before grab. Ignoring the grab" );
					this.grabPressed = ButtonState.Suppressed;
				}
				else
				{
					this.grabPressed = ButtonState.Pressed;

					if( this.state.activeGrab )
					{
						this.setState( { state: GrabberState.Grabbing } );
						let res = await this.state.activeGrab.lock();
						if( res != InterfaceLockResult.Success )
						{
							console.log( `Fail to lock when grabbing ${ InterfaceLockResult[ res ] }` );
						}
			
						// check active interface again again because we might have lost it while awaiting
						if( this.state.activeGrab )
						{
							this.state.activeGrab.sendEvent( { type: GrabRequestType.SetGrabber } as GrabRequest );
							let grabberFromGrabbable = this.state.activeGrab.selfFromPeer;
							this.setGrabberFromGrabbable( grabberFromGrabbable );
							this.startGrabMove();
						}
					}
					else if( this.state.activePanel1 )
					{
						await this.state.activePanel1.lock();
						this.state.activePanel1?.sendEvent( { type: PanelRequestType.Down } as PanelRequest );
					}
				}
				break;

			case ButtonState.Pressed:
			case ButtonState.Suppressed:
				console.log( "DUPLICATE GRAB PRESSED!" );
				break;
		}
	
	}


	@bind
	private async onGrabReleased()
	{
		switch( this.grabPressed )
		{
			case ButtonState.Suppressed:
				this.grabPressed = ButtonState.Idle;
				break;

			case ButtonState.Idle:
				console.log( "DUPLICATE GRAB RELEASED!" );
				
				// FALL THROUGH (just in case we need to clean up)
			case ButtonState.Pressed:
				this.grabPressed = ButtonState.Idle;
				this.stopGrabMove();

				if( this.state.activeGrab )
				{
					switch( this.state.state )
					{
						case GrabberState.GrabFailed:
							if( this.state.activeGrab )
							{
								this.setState( { state: GrabberState.Highlight } );
							}
							else
							{
								this.setState( { state: GrabberState.Idle } );
							}
							break;
			
						case GrabberState.Grabbing:
							// we need to wait here to make sure the moveable on the other 
							// end has a good transform relative to its new container when 
							// we unlock below.
							await this.state.activeGrab.sendEvent( { type: GrabRequestType.DropYourself } as GrabRequest );
							this.setState( { state: GrabberState.WaitingForDropComplete } );
							break;
			
						case GrabberState.LostGrab:
							this.state.activeGrab.unlock();	
							this.setState( 
								{ 
									grabberFromGrabbableDirection: null, 
									grabberFromGrabbableRange: null, 
									grabberFromGrabbableRotation: null, 
									state: GrabberState.Idle } );
							break;
			
						case GrabberState.WaitingForRegrab:
							// The user let the grab go mid-regrab. We'll just drop when the new moveable comes in
							break;
			
						case GrabberState.GrabReleased:
							this.state.activeGrab.unlock();
							this.setState( { state: GrabberState.Highlight } );
							break;
			
						default:
							// other states shouldn't get here
							console.log( `Unexpected grabber state ${ GrabberState[ this.state.state ] } on grab release` );
					}
				}
				else if( this.state.activePanel1 )
				{
					this.state.activePanel1.sendEvent( { type: PanelRequestType.Up } as PanelRequest );
					this.state.activePanel1.unlock();	
				}
				break;
		}
	}

	
	@bind
	private async onMenuPressed()
	{
		switch( this.menuPressed )
		{
			case ButtonState.Pressed:
			case ButtonState.Suppressed:
				console.log( "DUPLICATE MENU PRESS" );
				break;

			case ButtonState.Idle:
				if( this.grabPressed == ButtonState.Pressed )
				{
					console.log( "Ignoring menu because grab was pressed" );
					this.menuPressed = ButtonState.Suppressed;
				}
				else
				{
					console.log( "Menu button pressed" );
					this.menuPressed = ButtonState.Pressed;
					if( this.state.activeGrab )
					{
						this.setState( { state: GrabberState.Menu } );
						let res = await this.state.activeGrab.lock();
						if( res != InterfaceLockResult.Success )
						{
							console.log( `Fail to lock when grabbing ${ InterfaceLockResult[ res ] }` );
						}
			
						// check active interface again again because we might have lost it while awaiting
						if( this.state.activeGrab )
						{
							let evt: GrabRequest = { type: GrabRequestType.ShowMenu };
							this.state.activeGrab.sendEvent( evt );
						}
					}
				}
				break;

		}
	}


	@bind
	private async onMenuReleased()
	{
		switch( this.menuPressed )
		{
			case ButtonState.Suppressed:
				this.menuPressed = ButtonState.Idle;
				break;

			case ButtonState.Idle:
				console.log( "DUPLICATE MENU RELEASE" );
				break;

			case ButtonState.Pressed:
				console.log( "Menu button released" );
				if( this.state.activeMenu )
				{
					let evt: MenuEvent = { type: MenuEventType.Activate };
					this.state.activeMenu.sendEvent( evt );
				}
				if( this.state.activeGrab )
				{
					let evt: GrabRequest = { type: GrabRequestType.HideMenu };
					this.state.activeGrab.sendEvent( evt );
					this.state.activeGrab.unlock();
					this.setState( { state: GrabberState.Highlight } );
				}
				else
				{
					this.setState( { state: GrabberState.Idle } );
				}

				this.menuPressed = ButtonState.Idle;
				break;
		}
	}


	@bind
	private async onGrabStart( activeInterface: ActiveInterface )
	{
		if( this.state.state == GrabberState.WaitingForRegrabNewMoveable )
		{
			if( !endpointAddrsMatch( activeInterface.peer, this.state.regrabTarget ) )
			{
				console.log( `Regrab target mismatch. Expected: ${ endpointAddrToString( this.state.regrabTarget )} `
					+ `Received: ${ endpointAddrToString( activeInterface.peer ) }` );
			}

			let grabberFromGrabbable = this.state.grabberFromRegrabTarget ?? activeInterface.selfFromPeer;
			this.setGrabberFromGrabbable( grabberFromGrabbable );
			this.setState(
				{
					grabberFromRegrabTarget: null,
					regrabTarget: null,
				} );
	
			this.startGrabMove();

			let res = await activeInterface.lock();
			if( res != InterfaceLockResult.AlreadyLocked )
			{
				console.log( "How did we get here without having the new thing locked?" );
			}

			activeInterface.sendEvent( { type: GrabRequestType.SetGrabber } as GrabRequest );

			if( !this.grabPressed )
			{
				// the user released the grab while we were acquiring our new moveable. So we need to 
				// drop it immediately.
				await activeInterface.sendEvent( { type: GrabRequestType.DropYourself } as GrabRequest );
				this.setState( { state: GrabberState.WaitingForDropComplete } );
			}
		}
		else
		{
			AvGadget.instance().sendHapticEvent(activeInterface.self, 0.7, 1, 0 );
			this.setState( { state: GrabberState.Highlight } );
		}
		console.log( `setting activeInterface to ${ endpointAddrToString( activeInterface.peer ) }`)
		this.setState( { activeGrab: activeInterface, wasShowingRay: this.state.showRay } );


		activeInterface.onEvent( 
			async ( event: GrabRequest ) =>
			{
				switch( event.type )
				{
					case GrabRequestType.DropComplete:
					{
						switch( this.state.state )
						{
							case GrabberState.WaitingForDropComplete:
								activeInterface.unlock();	
								this.setState( { state: GrabberState.Highlight,
									grabberFromGrabbableOverride: null,
									grabberFromGrabbableDirection: null, 
									grabberFromGrabbableRange: null, 
									grabberFromGrabbableRotation: null } );		
								break;

							case GrabberState.WaitingForRegrabDropComplete:
								let resPromise = activeInterface.relock( this.state.regrabTarget );
								this.setState( { state: GrabberState.WaitingForRegrab,
									grabberFromGrabbableOverride: null,
									grabberFromGrabbableDirection: null, 
									grabberFromGrabbableRange: null, 
									grabberFromGrabbableRotation: null, } );
								let res = await resPromise;
								if( res != InterfaceLockResult.Success )
								{
									console.log( `Regrab failed with ${ InterfaceLockResult[ res ] }` );
									// @ts-ignore: Bogus always false error after await and setState
									if( this.state.state == GrabberState.WaitingForRegrab )
									{
										this.setState( { state: GrabberState.Grabbing } );
									}
								}
								break;

							default:
								// other states shouldn't get here
								console.log( `Unexpected grabber state ${ GrabberState[ this.state.state ] } on DropComplete event` );
								break;
						}
					}
					break;

					case GrabRequestType.RequestRegrab:
					{
						if( this.state.state == GrabberState.Grabbing )
						{

							// we need to wait here to make sure the old moveable on the other 
							// end has a good transform relative to its new container when 
							// we relock below.
							await activeInterface.sendEvent( { type: GrabRequestType.DropYourself } as GrabRequest );
							this.setState( 
								{ 
									state: GrabberState.WaitingForRegrabDropComplete, 
									regrabTarget: event.newMoveable,
									grabberFromRegrabTarget: multiplyTransforms( activeInterface.selfFromPeer, 
										event.oldMoveableFromNewMoveable ),
								} );
						}
					}
					break;

					case GrabRequestType.ReleaseMe:
					{
						if( this.state.state == GrabberState.Grabbing )
						{
							this.setState( { state: GrabberState.GrabReleased, 
								grabberFromGrabbableOverride: null,
								grabberFromGrabbableDirection: null, 
								grabberFromGrabbableRange: null, 
								grabberFromGrabbableRotation: null, } );
						}
					}
					break;

					case GrabRequestType.OverrideTransform:
					{
						this.setState( { grabberFromGrabbableOverride: event.grabberFromGrabbable } );
					}
					break;
				}
			} );

		activeInterface.onEnded( () =>
		{
			switch( this.state.state )
			{
				case GrabberState.GrabReleased:
				case GrabberState.Grabbing:
					this.setState( { state: GrabberState.LostGrab } );
					break;

				case GrabberState.Highlight:
					this.setState( { state: GrabberState.Idle } );
					AvGadget.instance().sendHapticEvent( activeInterface.self, 0.3, 1, 0 );
					break;

				case GrabberState.WaitingForRegrab:
					// This is the old endpoint leaving. We should get a new interface for the new 
					// target soon.
					this.setState( { state: GrabberState.WaitingForRegrabNewMoveable })
					break;

				default:
					// other states shouldn't get here
					console.log( `Unexpected grabber state ${ GrabberState[ this.state.state ] } on interface end` );
			}

			console.log( `unsetting activeInterface from ${ endpointAddrToString( this.state.activeGrab?.peer ) }`)

			this.setState( { activeGrab: null, wasShowingRay: false } );	
		} );

		activeInterface.onTransformUpdated( ( entityFromPeer: AvNodeTransform ) =>
		{
			if( !this.state.grabberFromGrabbableOverride && this.state.state == GrabberState.Grabbing )
			{
				console.log( "Transform updated" );
				this.setGrabberFromGrabbable( entityFromPeer );
			}
		} );
	}

	private setGrabberFromGrabbable( grabberFromGrabbable: AvNodeTransform )
	{
		let grabberFromGrabbableDirection = new vec3( [
			grabberFromGrabbable.position?.x ?? 0,
			grabberFromGrabbable.position?.y ?? 0,
			grabberFromGrabbable.position?.z ?? 0
		] );
		let grabberFromGrabbableRange = grabberFromGrabbableDirection.length();
		grabberFromGrabbableDirection.normalize();

		this.setState(
			{
				state: GrabberState.Grabbing,
				grabberFromGrabbableOverride: null,
				grabberFromGrabbableDirection,
				grabberFromGrabbableRange,
				grabberFromGrabbableRotation: grabberFromGrabbable.rotation,
			} );
	}

	@bind
	private onPanel1Start( activeInterface: ActiveInterface )
	{
		AvGadget.instance().sendHapticEvent( activeInterface.self, 0.7, 1, 0 );
		
		activeInterface.onEnded( () =>
		{
			if( this.grabPressed )
			{
				activeInterface.unlock();
			}

			this.setState( { activePanel1: null } );	
			AvGadget.instance().sendHapticEvent(activeInterface.self, 0.3, 1, 0 );
		} );

		this.setState( { activePanel1: activeInterface } );
	}

	@bind
	private onPanel2Start( activeInterface: ActiveInterface )
	{
		activeInterface.onEnded( () =>
		{
			this.setState( { activePanel2: null } );	
		} );

		this.setState( { activePanel2: activeInterface } );
	}

	@bind
	private onMenuStart( activeInterface: ActiveInterface )
	{
		AvGadget.instance().sendHapticEvent( activeInterface.self, 0.7, 1, 0 );
		
		activeInterface.onEnded( () =>
		{
			this.setState( { activeMenu: null } );	
			AvGadget.instance().sendHapticEvent(activeInterface.self, 0.3, 1, 0 );
		} );

		this.setState( { activeMenu: activeInterface } );
	}

	public renderDebug()
	{
		return <div>
			<div>{ GrabberState[ this.state.state ] }</div>
			<div>ActiveInterface: { this.state.activeGrab ? endpointAddrToString( this.state.activeGrab.peer ): "none" }</div>
			{/* <div>Transform: { this.state.grabberFromGrabbable ? JSON.stringify( this.state.grabberFromGrabbable ): "none" }</div> */}
		</div>
	}

	public render()
	{
		let originPath: string;
		let animationSource: string;
		let modelUrl: string;
		let volumeSkeleton: string;
		switch( this.props.hand )
		{
		case EHand.Left:
			originPath = "/user/hand/left/raw";
			volumeSkeleton = "/user/hand/left";
			animationSource = "source:/user/hand/left";
			modelUrl = g_builtinModelSkinnedHandLeft;
			break;
		case EHand.Right:
			originPath = "/user/hand/right/raw";
			volumeSkeleton = "/user/hand/right";
			animationSource = "source:/user/hand/right";
			modelUrl = g_builtinModelSkinnedHandRight;
			break;
		}

		let overlayOnly = true;
		if( !Av().getCurrentSceneApplication() )
		{
			overlayOnly = false;
		}

		const k_containerOuterVolume: AvVolume =
		{
			type: EVolumeType.AABB,
			context: EVolumeContext.ContinueOnly,
			aabb:
			{
				xMin: -0.15, xMax: 0.15,
				yMin: -0.15, yMax: 0.25,
				zMin: -0.15, zMax: 0.15,
			}
		};
		const k_containerInnerVolume: AvVolume =
		{
			type: EVolumeType.Sphere,
			radius: 0.03,
		};

		const k_grabberVolume: AvVolume =
		{ 
			type: EVolumeType.Skeleton,
			skeletonPath: volumeSkeleton, 
			//visualize: true,
		};

		const k_pokerVolume: AvVolume =
		{ 
			type: EVolumeType.Skeleton,
			skeletonPath: volumeSkeleton + "/index/tip", 
			//visualize: true,
		};

		let grabberVolumes = [ k_grabberVolume ];
		let poker2Volumes = ( this.state.activePanel1 || this.state.activeGrab ) ? [] : [ k_pokerVolume ];
		
		let ray: JSX.Element = null;
		if( this.state.showRay &&
			( this.state.state == GrabberState.Idle || this.state.wasShowingRay ) )
		{
			grabberVolumes.push( rayVolume( new vec3( [ 0, 0, 0 ] ), new vec3( [ 0, 0, -1 ] ) ) );
			if( this.state.state == GrabberState.Idle ||
				this.state.state == GrabberState.Highlight )
			{
				ray = <AvTransform rotateX={ -90 }>
				<AvPrimitive radius={ 0.005 } height={ 4 } type={ PrimitiveType.Cylinder }
					color="lightgrey" originY={ PrimitiveYOrigin.Bottom } />
				</AvTransform>;
			}
		}


		let child: JSX.Element;
		if( this.state.activeGrab && this.state.state != GrabberState.GrabReleased )
		{
			let childEpa = this.state.activeGrab.peer;

			let childEntity = <AvEntityChild child={ childEpa }/>;
			if( typeof this.state.grabberFromGrabbableOverride == "string" &&
				this.state.grabberFromGrabbableOverride != GrabPose.None )
			{
				let hand = EHand[ this.props.hand ].toLowerCase();

				originPath = `/user/hand/${ hand }/root_bone`;
				animationSource = g_builtinAnims + hand + "_" 
					+ this.state.grabberFromGrabbableOverride + ".glb";
				child = <AvModelTransform modelUri={ animationSource } 
					modelNodeId={ this.state.grabberFromGrabbableOverride } >
					{ childEntity }
				</AvModelTransform>;

				overlayOnly = false;
			}
			else if( typeof this.state.grabberFromGrabbableOverride == "object"
				&& this.state.grabberFromGrabbableOverride )
			{
				child = <AvTransform transform={ this.state.grabberFromGrabbableOverride }>
					{ childEntity }
				</AvTransform>;
			}
			else if( this.state.grabberFromGrabbableDirection )
			{
				child = <AvTransform transform={ 
					{
						position: 
						{
							x: this.state.grabberFromGrabbableDirection.x * this.state.grabberFromGrabbableRange,
							y: this.state.grabberFromGrabbableDirection.y * this.state.grabberFromGrabbableRange,
							z: this.state.grabberFromGrabbableDirection.z * this.state.grabberFromGrabbableRange,
						},
						rotation: this.state.grabberFromGrabbableRotation,
					} }>
					{ childEntity }
				</AvTransform>;
			}
		}

		let debugName = EHand[ this.props.hand ] + " hand grabber";
		return (
			<>
			<AvOrigin path={ originPath }>
				{ modelUrl && <AvModel 
					uri={ modelUrl } overlayOnly={ overlayOnly } animationSource={ animationSource }/> }
				{
					!modelUrl && <AvPrimitive type={ PrimitiveType.Sphere } radius={ 0.02 } />
				}
				{ ray }
				<AvComposedEntity components={ [ this.containerComponent ]} 
					volume={ [ k_containerInnerVolume, k_containerOuterVolume ] }
					priority={ 100 } debugName={ debugName + "/container" }/>
				<AvInterfaceEntity transmits={
					[ 
						{ iface: "aardvark-panel@1", processor: this.onPanel1Start },
						{ iface: "aardvark-grab@1", processor: this.onGrabStart },
					] }
					volume={ grabberVolumes } debugName={ debugName }>
						{ child }
				</AvInterfaceEntity>
				<AvInterfaceEntity transmits={
					[ 
						{ iface: k_MenuInterface, processor: this.onMenuStart },
					] }
					volume={ grabberVolumes } debugName={ debugName + "/menu" }>
				</AvInterfaceEntity>
				<AvInterfaceEntity transmits={
					[ 
						{ iface: "aardvark-panel@2", processor: this.onPanel2Start },
					] }
					volume={ poker2Volumes } debugName={ debugName + "/poker" }>
				</AvInterfaceEntity>
			</AvOrigin>
			{ this.renderDebug() }
			</>
		);
	}
}

class DefaultHands extends React.Component< {}, {} >
{
	private containerComponent = new SimpleContainerComponent();
	private leftRef = React.createRef<DefaultHand>();
	private rightRef = React.createRef<DefaultHand>();
	private gadgetRegistry: ActiveInterface = null;
	private gadgetRegistryRef = React.createRef<AvInterfaceEntity>();

	@bind
	private onGadgetRegistryUI( gadgetRegistry: ActiveInterface )
	{
		this.gadgetRegistry = gadgetRegistry;

		gadgetRegistry.onEnded( () =>
		{
			this.gadgetRegistry = null;
		} )
	}

	@bind
	private toggleGadgetMenu()
	{
		this.gadgetRegistry?.sendEvent( { type: "toggle_visibility" } );
	}

	componentDidMount()
	{
		if( !AvGadget.instance().getEndpointId() || !this.gadgetRegistryRef.current )
		{
			// this is terrible. Figure out a way to call back into the gadget when it
			// actually has an endpoint ID
			window.setTimeout( () =>
			{
				this.startGadgetMenu();
			}, 100 );
		}
		else
		{
			this.startGadgetMenu();
		}
	}

	private startGadgetMenu()
	{
		if( !AvGadget.instance().getEndpointId() || !this.gadgetRegistryRef.current )
		{
			// this is terrible. Figure out a way to call back into the gadget when it
			// actually has an endpoint ID
			window.setTimeout( () =>
			{
				this.startGadgetMenu();
			}, 100 );
			return;
		}

		// Start the gadget menu once we have an ID
		AvGadget.instance().startGadget( 
			"http://localhost:23842/gadgets/gadget_menu", 
			[ { iface: k_gadgetRegistryUI, receiver: this.gadgetRegistryRef.current.globalId } ] );
	}

	public render()
	{
		const k_containerInnerVolume: AvVolume =
		{
			type: EVolumeType.AABB,
			aabb:
			{
				xMin: -0.05, xMax: 0.05,
				yMin: -0.06, yMax: 0.02,
				zMin: -0.05, zMax: 0.05,
			}
		};

		const k_containerOuterVolume: AvVolume =
		{
			type: EVolumeType.AABB,
			context: EVolumeContext.ContinueOnly,
			aabb:
			{
				xMin: -0.3, xMax: 0.3,
				yMin: -0.6, yMax: 0.2,
				zMin: -0.3, zMax: 0.3,
			}
		};

		return (
			<>
				<DefaultHand hand={ EHand.Left } ref={ this.leftRef }/>
				<DefaultHand hand={ EHand.Right } ref={ this.rightRef } />
				<AvOrigin path={ "/user/head" } >
					<AvInterfaceEntity receives={
						[
							{ 
								iface: k_gadgetRegistryUI,
								processor: this.onGadgetRegistryUI,
							}
						]
					} volume={ emptyVolume() } ref={ this.gadgetRegistryRef } />
				</AvOrigin>
				<AvOrigin path="/user/hand/left">
					<AvTransform translateZ={ 0.04 } translateY={ 0.02 }>
						<AvGrabButton onClick={ this.toggleGadgetMenu } 
							modelUri={ g_builtinModelGear }/>
					</AvTransform>
				</AvOrigin>
				{/* <AvOrigin path="/user/head">
					<AvComposedEntity components={ [ this.containerComponent ]} 
						volume={ [ k_containerInnerVolume, k_containerOuterVolume ] }
						priority={ 90 }/>
				</AvOrigin> */}
				<AvOrigin path="/space/stage">
					<AvComposedEntity components={ [this.containerComponent ] }
						volume={ { type: EVolumeType.Infinite } }
						debugName="stage container">
					</AvComposedEntity>
				</AvOrigin>
				{/* <AvOrigin path="/user/head">
					<AvTransform translateZ={-2}>
						<AvPanel widthInMeters={1.0}>
						</AvPanel>
					</AvTransform>
				</AvOrigin> */}
			</>
		);
	}
}


ReactDOM.render( <DefaultHands/>, document.getElementById( "root" ) );



