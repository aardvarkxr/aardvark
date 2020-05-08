import { EndpointAddr } from './../../aardvark-shared/src/aardvark_protocol';
import { EntityComponent } from './aardvark_composed_entity';
import { InterfaceProp, ActiveInterface } from './aardvark_interface_entity';
import bind from 'bind-decorator';

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

	constructor( callback: () => void )
	{
		this.ownerCallback = callback;
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
		else if( this.activeContainer )
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
					await this.activeContainer?.lock();
					this.activeContainer?.sendEvent( { state: "Resting" } );

					this.grabber = null;
					this.updateListener();
					break;
			}
		} );

		this.activeGrab = activeGrab;
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
		return this.grabber ?? this.activeContainer?.peer;
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