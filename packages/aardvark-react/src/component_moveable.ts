import { AvGadget } from './aardvark_gadget';
import { InitialInterfaceLock, EndpointAddr, endpointAddrsMatch, InterfaceLockResult, endpointAddrToString, AvNodeTransform } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import { EntityComponent } from './aardvark_composed_entity';
import { ActiveInterface, InterfaceProp } from './aardvark_interface_entity';

export enum MoveableComponentState
{
	Idle,
	InContainer,
	GrabberNearby,
	Grabbed,
	Menu,
}

export enum ContainerRequestType
{
	Redrop = "redrop",
	RedropComplete = "redrop_complete",
}

export interface ContainerRequest
{
	type: ContainerRequestType;
	newContainer?: EndpointAddr;
	moveableToReplace?: EndpointAddr;
	oldMoveableFromNewMoveable?: AvNodeTransform;
}

export enum GrabRequestType
{
	DropYourself = "drop_yourself",
	DropComplete = "drop_complete",
	SetGrabber = "set_grabber",
	ReleaseMe = "release_me",
	RequestRegrab = "request_regrab",
	OverrideTransform = "override_transform",
	ShowMenu = "show_menu",
	HideMenu = "hide_menu",
}

export interface GrabRequest
{
	type: GrabRequestType;
	newMoveable?: EndpointAddr;
	oldMoveableFromNewMoveable?: AvNodeTransform;
	grabberFromGrabbable?: AvNodeTransform;
}

export class MoveableComponent implements EntityComponent
{
	public static get containerInterface() { return "aardvark-container@1"; }
	public static get grabInterface() { return "aardvark-grab@1"; }

	private entityCallback: () => void = null;
	private ownerCallback: () => void = null;

	private activeGrabs = new Set<ActiveInterface>();
	private activeContainer: ActiveInterface = null;
	private grabber: ActiveInterface = null;
	private wasEverDropped: boolean = false;
	private droppedIntoInitialParent: boolean = false;
	private initialInterface:InitialInterfaceLock = null;
	private waitingForRedrop:EndpointAddr = null;
	private waitingForRedropTransform: AvNodeTransform = null;
	private canDropIntoContainers = true;
	private forcedGrabberFromGrabbable: AvNodeTransform = null;
	private shouldShowMenu = false;

	constructor( callback: () => void, useInitialParent?: boolean, canDropIntoContainers?: boolean,
		forcedGrabberFromGrabbable?: AvNodeTransform )
	{
		this.canDropIntoContainers = canDropIntoContainers ?? true;
		this.forcedGrabberFromGrabbable = forcedGrabberFromGrabbable;
		this.ownerCallback = callback;
		if( useInitialParent )
		{
			this.initialInterface = AvGadget.instance().initialInterfaces.find( ( ii: InitialInterfaceLock ) =>
			{
				return ii.iface == MoveableComponent.containerInterface;
			} );
		}
	}

	private updateListener()
	{
		this.ownerCallback?.();
		this.entityCallback?.();
	}

	private get menuGrabberInterface(): ActiveInterface | null
	{
		if( this.state != MoveableComponentState.Menu )
			return null;

		// TODO: track menu per grabber
		if( this.activeGrabs.size == 0 )
			return null;
			
		let menu: ActiveInterface = this.activeGrabs.values().next().value;
		return menu;
	}

	public get menuGrabber(): EndpointAddr | null
	{
		return this.menuGrabberInterface?.peer;
	}

	public get menuSelfFromGrabber(): AvNodeTransform | null
	{
		return this.menuGrabberInterface?.selfFromPeer;
	}

	public get state(): MoveableComponentState
	{
		if( this.grabber )
		{
			return MoveableComponentState.Grabbed;
		}
		else if( this.activeGrabs.size > 0 )
		{
			if( this.shouldShowMenu )
			{
				return MoveableComponentState.Menu;
			}
			else
			{
				return MoveableComponentState.GrabberNearby;
			}
		}
		else if( this.activeContainer && this.wasEverDropped )
		{
			return MoveableComponentState.InContainer;
		}
		else
		{
			return MoveableComponentState.Idle;
		}
	}

	@bind
	private onGrabStart( activeGrab: ActiveInterface )
	{
		activeGrab.onEnded(() =>
		{
			this.activeGrabs.delete( activeGrab );
			this.updateListener();
		} );

		activeGrab.onEvent( async ( event: GrabRequest ) =>
		{
			console.log( "Event received", event );
			switch( event.type )
			{
				case GrabRequestType.SetGrabber:
					if( this.grabber == activeGrab )
					{
						console.log( `SetGrabber from ${endpointAddrToString( activeGrab.peer ) }, which was already our grabber` );
					}
					else
					{
						let release: GrabRequest = { type: GrabRequestType.ReleaseMe };
						this.grabber?.sendEvent( release );
	
						this.grabber = activeGrab;
	
						if( this.forcedGrabberFromGrabbable )
						{
							let overrideTransform: GrabRequest =
							{
								type: GrabRequestType.OverrideTransform,
								grabberFromGrabbable: this.forcedGrabberFromGrabbable,
							}
							this.grabber.sendEvent( overrideTransform );
						}

						this.activeContainer?.sendEvent( { state: "Moving" } );
						this.activeContainer?.unlock();
	
						this.updateListener();
					}
					break;

				case GrabRequestType.DropYourself:
					await this.dropIntoContainer( true );
					activeGrab.sendEvent( { type: GrabRequestType.DropComplete } as GrabRequest );
					break;

				case GrabRequestType.ShowMenu:
					this.shouldShowMenu = true;
					this.updateListener();
					break;

				case GrabRequestType.HideMenu:
					this.shouldShowMenu = false;
					this.updateListener();
					break;
			}
		} );

		this.activeGrabs.add( activeGrab );
		this.updateListener();
	}

	public async dropIntoCurrentContainer()
	{
		await this.dropIntoContainer( true );
	}

	private async dropIntoContainer( requestLock: boolean, moveableToReplace?: EndpointAddr, 
		oldMoveableFromNewMoveable?: AvNodeTransform )
	{
		if( requestLock )
		{
			await this.activeContainer?.lock();
		}
		await this.activeContainer?.sendEvent( { state: "Resting", moveableToReplace, oldMoveableFromNewMoveable } );

		this.wasEverDropped = true;
		this.grabber = null;
		this.updateListener();
	}

	public triggerRegrab( replacementMoveable: EndpointAddr, oldMoveableFromNewMoveable: AvNodeTransform )
	{
		let e: GrabRequest =
		{
			type: GrabRequestType.RequestRegrab,
			newMoveable: replacementMoveable,
			oldMoveableFromNewMoveable,
		}
		this.grabber?.sendEvent( e );
	}

	@bind
	private onContainerStart( activeContainer: ActiveInterface )
	{
		activeContainer.onEnded(() =>
		{
			this.activeContainer = null;
			this.updateListener();
		} );

		activeContainer.onEvent( ( event: ContainerRequest ) =>
		{
			switch( event.type )
			{
				case ContainerRequestType.Redrop:
				{
					console.log( `Redrop request to replace ${ endpointAddrToString( event.moveableToReplace )}` );
					this.waitingForRedrop = event.moveableToReplace;
					this.waitingForRedropTransform = event.oldMoveableFromNewMoveable;
					activeContainer.relock( event.newContainer );
				}
				break;

				case ContainerRequestType.RedropComplete:
				{
					activeContainer.unlock();
					this.wasEverDropped = false;
					this.updateListener();
				}
				break;
			}
		} );

		this.activeContainer = activeContainer;
		this.updateListener();

		if( this.initialInterface && !this.droppedIntoInitialParent 
			&& endpointAddrsMatch( this.initialInterface.receiver, activeContainer.peer ) )
		{
			// don't need to lock because the initial lock took care of that for us
			this.dropIntoContainer( false ); 
			this.droppedIntoInitialParent = true;
		}

		if( this.waitingForRedrop )
		{
			console.log( `got new container ${ endpointAddrToString( activeContainer.peer ) } while waiting for redrop` );
			this.dropIntoContainer( false, this.waitingForRedrop, this.waitingForRedropTransform );
			this.waitingForRedrop = null;
		}
	}

	public get transmits(): InterfaceProp[]
	{
		if( this.canDropIntoContainers )
		{
			return [ 
				{ iface: MoveableComponent.containerInterface, processor: this.onContainerStart } 
			];
		}
		else
		{
			return [];
		}
	}

	public get receives(): InterfaceProp[]
	{
		return [ { iface: "aardvark-grab@1", processor: this.onGrabStart } ];
	}

	public get parent(): EndpointAddr
	{
		if( this.grabber )
		{
			// if we're currently grabbed, that's our parent
			return this.grabber.peer;
		}
		else if( this.wasEverDropped )
		{
			// if we've ever been dropped into a container,
			// that can be our parent
			return this.activeContainer?.peer;
		}
		else
		{
			// otherwise, we have no parent and should obey whatever
			// the scene graph provides as our transform
			return null;
		}
	}

	public get interfaceLocks(): InitialInterfaceLock[]
	{
		if( this.initialInterface )
		{
			return ( 
				[ 
					this.initialInterface
				] );
		}
	}
	
	public get wantsTransforms()
	{
		return false;
	}


	public reset()
	{
		this.activeContainer?.unlock();
		this.activeContainer?.sendEvent( { state: "Moving" } );
		this.wasEverDropped = false;
		this.grabber = null;
		this.updateListener();
	}

	public onUpdate( callback: () => void ): void
	{
		this.entityCallback = callback;
	}

	public render(): JSX.Element
	{
		return null;
	}
}