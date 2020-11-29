import { ApiInterfaceHandler, ApiInterfaceSender, AvApiInterface, AvOrigin, AvPanel, AvTransform, k_MessageboxInterface, MessageboxEventType, Prompt } from '@aardvarkxr/aardvark-react';
import { EndpointAddr, endpointAddrsMatch } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { initSentryForBrowser } from 'common/sentry_utils';

initSentryForBrowser();

interface QueuedPrompt
{
	sender: EndpointAddr;
	prompt: Prompt;
	resolve: ( response: [ string ] ) => void;
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

	private clearEventsFromSender( sender: EndpointAddr )
	{
		for( let i = 0; i < this.queue.length; i++ )
		{
			if( endpointAddrsMatch( this.queue[i].sender, sender) )
			{
				this.queue.splice( i, 1 );
				break;
			}
		}

		if( endpointAddrsMatch( this.state.activePrompt?.sender, sender ) )
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
	private async onMessagebox_ShowPrompt( sender: ApiInterfaceSender, args: any[] ) : Promise< [ string ] >
	{
		return new Promise< [string] >( ( resolve, reject ) =>
		{
			let [ prompt ] = args as [ Prompt ];
			this.clearEventsFromSender( sender.endpointAddr );
			this.queue.push( { sender: sender.endpointAddr, prompt, resolve });
			if( !this.state.activePrompt )
			{
				this.setState( { activePrompt: this.queue.shift() } );	
			}
		} );
	}

	@bind
	private async onMessagebox_CancelPrompt( sender: ApiInterfaceSender, args: any[] ) : Promise< null >
	{
		this.clearEventsFromSender( sender.endpointAddr );
		return null;
	}

	private selectOption( optionName: string )
	{
		if( !this.state.activePrompt )
			return;

		this.state.activePrompt.resolve( [ optionName ] );
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

		let classes = "Caption";
		if( this.state.activePrompt.prompt.caption.length > 100 )
		{
			classes += " Long";
		}

		return <>
			<div className="Messagebox" >
				<div className={ classes }>{this.state.activePrompt.prompt.caption}</div>
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
		let messageboxHandlers:  { [ msgType:string ] : ApiInterfaceHandler } = {};
		messageboxHandlers[ MessageboxEventType.ShowPrompt ] = this.onMessagebox_ShowPrompt;
		messageboxHandlers[ MessageboxEventType.CancelPrompt ] = this.onMessagebox_CancelPrompt;

		return <AvOrigin path="/user/head">
			<AvApiInterface apiName={ k_MessageboxInterface } implementation={ true }
				handlers={ messageboxHandlers } 
				onDisconnect={ ( sender: EndpointAddr ) => this.clearEventsFromSender( sender ) }/>
			{ this.renderMessagebox() }
		</AvOrigin>;
	}

}

ReactDOM.render( <Messagebox/>, document.getElementById( "root" ) );
