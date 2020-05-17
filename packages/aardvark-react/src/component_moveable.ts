import { AvGadget } from './aardvark_gadget';
import { InitialInterfaceLock, EndpointAddr, endpointAddrsMatch, InterfaceLockResult, endpointAddrToString } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import { EntityComponent } from './aardvark_composed_entity';
import { ActiveInterface, InterfaceProp } from './aardvark_interface_entity';

export enum MoveableComponentState
{
	Idle,
	InContainer,
	GrabberNearby,
	Grabbed,
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
}

export enum GrabRequestType
{
	DropYourself = "drop_yourself",
	DropComplete = "drop_complete",
	SetGrabber = "set_grabber",
}

export interface GrabRequest
{
	type: GrabRequestType;
}

export class MoveableComponent implements EntityComponent
{
	public static get containerInterface() { return "aardvark-container@1"; }
	public static get grabInterface() { return "aardvark-grab@1"; }

	private entityCallback: () => void = null;
	private ownerCallback: () => void = null;

	private activeGrab: ActiveInterface = null;
	private activeContainer: ActiveInterface = null;
	private grabber: EndpointAddr = null;
	private wasEverDropped: boolean = false;
	private droppedIntoInitialParent: boolean = false;
	private initialInterface:InitialInterfaceLock = null;
	private waitingForRedrop:EndpointAddr = null;

	constructor( callback: () => void, useInitialParent?: boolean )
	{
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

	public get state(): MoveableComponentState
	{
		if( this.grabber )
		{
			return MoveableComponentState.Grabbed;
		}
		else if( this.activeGrab )
		{
			return MoveableComponentState.GrabberNearby;
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
			this.activeGrab = null;
			this.updateListener();
		} );

		activeGrab.onEvent( async ( event: GrabRequest ) =>
		{
			console.log( "Event received", event );
			switch( event.type )
			{
				case GrabRequestType.SetGrabber:
					this.grabber = this.activeGrab.peer;

					this.activeContainer?.sendEvent( { state: "Moving" } );
					this.activeContainer?.unlock();

					this.updateListener();
					break;

				case GrabRequestType.DropYourself:
					await this.dropIntoContainer( true );
					this.activeGrab.sendEvent( { type: GrabRequestType.DropComplete } as GrabRequest );
					break;
			}
		} );

		this.activeGrab = activeGrab;
		this.updateListener();
	}

	private async dropIntoContainer( requestLock: boolean, moveableToReplace?: EndpointAddr )
	{
		if( requestLock )
		{
			await this.activeContainer?.lock();
		}
		await this.activeContainer?.sendEvent( { state: "Resting", moveableToReplace } );

		this.wasEverDropped = true;
		this.grabber = null;
		this.updateListener();
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
			this.dropIntoContainer( false, this.waitingForRedrop );
			this.waitingForRedrop = null;
		}
	}

	public get transmits(): InterfaceProp[]
	{
		return [ { iface: MoveableComponent.containerInterface, processor: this.onContainerStart } ];
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
			return this.grabber;
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


	public onUpdate( callback: () => void ): void
	{
		this.entityCallback = callback;
	}

	public render(): JSX.Element
	{
		return null;
	}
}