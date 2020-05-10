import { InitialInterfaceLock, EndpointAddr, endpointAddrsMatch } from '@aardvarkxr/aardvark-shared';
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

export class MoveableComponent implements EntityComponent
{
	private entityCallback: () => void = null;
	private ownerCallback: () => void = null;

	private activeGrab: ActiveInterface = null;
	private activeContainer: ActiveInterface = null;
	private grabber: EndpointAddr = null;
	private wasEverDropped: boolean = false;
	private initialParent: EndpointAddr;
	private droppedIntoInitialParent = false;

	constructor( callback: () => void, initialParent?: EndpointAddr )
	{
		this.ownerCallback = callback;
		this.initialParent = initialParent;
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

		activeGrab.onEvent( async ( event: any ) =>
		{
			console.log( "Event received", event );
			switch( event.type )
			{
				case "SetGrabber":
					this.grabber = this.activeGrab.peer;

					this.activeContainer?.sendEvent( { state: "Moving" } );
					this.activeContainer?.unlock();

					this.updateListener();
					break;

				case "DropYourself":
					this.dropIntoContainer( true );
					break;
			}
		} );

		this.activeGrab = activeGrab;
		this.updateListener();
	}

	private async dropIntoContainer( requestLock: boolean )
	{
		if( requestLock )
		{
			await this.activeContainer?.lock();
		}
		this.activeContainer?.sendEvent( { state: "Resting" } );

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

		this.activeContainer = activeContainer;
		this.updateListener();

		if( this.initialParent && !this.droppedIntoInitialParent 
			&& endpointAddrsMatch( this.initialParent, activeContainer.peer ) )
		{
			// don't need to lock because the initial lock took care of that for us
			this.dropIntoContainer( false ); 
			this.droppedIntoInitialParent = true;
		}
	}

	public get transmits(): InterfaceProp[]
	{
		return [ { iface: "aardvark-container@1", processor: this.onContainerStart } ];
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
		if( this.initialParent )
		{
			return ( 
				[ 
					{ 
						iface: "aardvark-container@1",
						receiver: this.initialParent,
						transmitterFromReceiver: {},
					}
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