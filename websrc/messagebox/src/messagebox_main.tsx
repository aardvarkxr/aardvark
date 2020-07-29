import { ActiveInterface, AvInterfaceEntity, AvOrigin, AvPanel, AvTransform, k_MessageboxInterface, MessageboxEvent, MessageboxEventType } from '@aardvarkxr/aardvark-react';
import { endpointAddrToString, infiniteVolume } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

interface QueuedPrompt
{
	activeInterface: ActiveInterface;
	prompt: MessageboxEvent;
}

interface MessageboxState
{
	activePrompt?: QueuedPrompt;
}


class Messagebox extends React.Component< {}, MessageboxState >
{
	private queue: QueuedPrompt[] = [];

	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
		};
	}

	private clearEventsFromInterface( activeInterface: ActiveInterface )
	{
		for( let i = 0; i < this.queue.length; i++ )
		{
			if( this.queue[i].activeInterface == activeInterface )
			{
				this.queue.splice( i, 1 );
				break;
			}
		}

		if( this.state.activePrompt?.activeInterface == activeInterface )
		{
			this.popActivePrompt();
		}
	}

	private popActivePrompt()
	{
		if( this.queue.length > 0 )
		{
			this.setState( { activePrompt: this.queue.shift() } );
		}
		else
		{
			this.setState( { activePrompt: null } );
		}
	}

	@bind
	private onMessagebox( activeInterface: ActiveInterface )
	{
		console.log( `messagebox connection from ${ endpointAddrToString( activeInterface.peer ) } ` );
		activeInterface.onEnded( () =>
		{
			console.log( `lost messagebox connection from ${ endpointAddrToString( activeInterface.peer ) } ` );
			this.clearEventsFromInterface( activeInterface );
		});

		activeInterface.onEvent( ( prompt: MessageboxEvent ) => 
		{
			switch( prompt.type )
			{
				case MessageboxEventType.CancelPrompt:
					this.clearEventsFromInterface( activeInterface );
					break;

				case MessageboxEventType.ShowPrompt:
					this.clearEventsFromInterface( activeInterface );
					this.queue.push( { activeInterface, prompt });
					this.setState( { activePrompt: this.queue.shift() } );
					break;
			}
		} );
	}

	private selectOption( optionName: string )
	{
		if( !this.state.activePrompt )
			return;

		let m: MessageboxEvent =
		{
			type: MessageboxEventType.UserResponse,
			responseName: optionName,
		};
		this.state.activePrompt.activeInterface.sendEvent( m );
		this.popActivePrompt();
	}

	private renderMessagebox()
	{
		if( !this.state.activePrompt )
			return null;

		let buttons: JSX.Element[] = [];
		for( let option of this.state.activePrompt.prompt.options )
		{
			buttons.push( 
				<div className="Button" key={ option.name }
					onClick={ () => { this.selectOption( option.name ) } }>
					{ option.text }
				</div>
			)
		}

		return <>
			<div className="Messagebox" >
				<div className="Caption">{this.state.activePrompt.prompt.caption}</div>
				<div className="ButtonList">{ buttons }</div>
			</div>
			<AvOrigin path="/user/head">
				<AvTransform translateZ={ -0.3 } translateY={-0.08}>
					<AvPanel interactive={true} widthInMeters={ 0.15 }/>
				</AvTransform>
			</AvOrigin>
		</>;
	}


	public render()
	{
		return <AvOrigin path="/user/head">
			<AvInterfaceEntity key="mbox" receives={
			[
				{
					iface: k_MessageboxInterface,
					processor: this.onMessagebox,
				}
			] }
			volume={ infiniteVolume() }	/>
			{ this.renderMessagebox() }
		</AvOrigin>;
	}

}

ReactDOM.render( <Messagebox/>, document.getElementById( "root" ) );
