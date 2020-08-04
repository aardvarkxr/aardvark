import * as React from 'react';
import { AvInterfaceEntity, ActiveInterface } from './aardvark_interface_entity';
import { InterfaceEntity } from 'aardvark_renderer/src/interface_processor';
import bind from 'bind-decorator';
import { infiniteVolume } from '@aardvarkxr/aardvark-shared';


export const k_MessageboxInterface = "messagebox@1";

export enum MessageboxEventType
{
	ShowPrompt = "show_prompt",
	UserResponse = "user_response",
	CancelPrompt = "cancel_prompt",
}


export interface MessageboxOption
{
	name: string; // used internally. Not localized
	text: string; // Localized and displayed to user
}

export interface MessageboxEvent
{
	type: MessageboxEventType;
	caption?: string;
	options?: MessageboxOption[];
	responseName?: string;
}

/** Causes a line to appear from the transform of this node's parent to the 
 * specified end point. */
export class AvMessagebox extends React.Component< {}, {} >
{
	private activeInterface: ActiveInterface = null;
	private activePrompt: MessageboxEvent = null;
	private activePromptResolve: (result: string)=>void = null;
	private activePromptReject: (reason: any)=>void = null;

	public showPrompt( caption: string, options: MessageboxOption[] ) 
	{
		if( this.activePrompt )
		{
			throw new Error( "Only one prompt allowed at a time per AvMessagebox" );
		}

		return new Promise<string>( ( resolve, reject ) =>
		{

			this.activePrompt = 
			{
				type: MessageboxEventType.ShowPrompt,
				caption,
				options,
			};
			this.activePromptResolve = resolve;
			this.activePromptReject = reject;

			if( this.activeInterface )
			{
				this.activeInterface.sendEvent( this.activePrompt );
			}
		})
	}

	public cancelPrompt( caption: string, options: MessageboxOption[] ) 
	{
		if( !this.activePrompt )
		{
			throw new Error( "Attempt to cancel when there is no active prompt" );
		}

		this.activePromptReject( "Cancelled by caller" );

		this.clearActivePrompt();

		if( this.activeInterface )
		{
			this.activeInterface.sendEvent( { type: MessageboxEventType.CancelPrompt } );
		}

		// if there's no active interface there's no other end to cancel
	}

	private clearActivePrompt()
	{
		this.activePrompt = null;
		this.activePromptResolve = null;
		this.activePromptReject = null;
	}

	@bind
	private onMessagebox( activeInterface: ActiveInterface )
	{
		this.activeInterface = activeInterface;

		// send any initial prompt that's sitting around
		if( this.activePrompt )
		{
			this.activeInterface.sendEvent( this.activePrompt );
		}

		activeInterface.onEnded( () =>
		{
			this.activeInterface = null;

			// Don't null out the active prompt here so we'll send it again
			// when the other end comes back
		} );

		activeInterface.onEvent( ( event: MessageboxEvent )=>
		{
			if( event.type == MessageboxEventType.UserResponse )
			{
				let resolve = this.activePromptResolve;
				this.clearActivePrompt();
				resolve( event.responseName );
			}
		} );
	}

	public render()
	{
		return <AvInterfaceEntity transmits={
			[
				{
					iface: k_MessageboxInterface,
					processor: this.onMessagebox,
				}
			] }
			volume={ infiniteVolume() }
			/>;
	}
}

