import * as React from 'react';
import { AvApiInterface } from './api_interface';


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

export interface Prompt
{
	caption: string;
	options: MessageboxOption[];
}

/** Causes a line to appear from the transform of this node's parent to the 
 * specified end point. */
export class AvMessagebox extends React.Component< {}, {} >
{
	private api = React.createRef<AvApiInterface>();

	private activePrompt: Prompt = null;
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
				caption,
				options,
			};
			this.activePromptReject = reject;

			if( this.api.current && this.api.current.connected )
			{
				this.api.current.sendRequestAndWaitForResponse<string>( MessageboxEventType.ShowPrompt, true,
					this.activePrompt )
				.then( ( response: string ) =>
				{
					this.clearActivePrompt();
					resolve( response );
				} )
				.catch( (reason: any ) =>
				{
					// Just drop errors on the floor. We'll try again on reconnect
				} );
			}
		})
	}

	public cancelPrompt() 
	{
		if( !this.activePrompt )
		{
			throw new Error( "Attempt to cancel when there is no active prompt" );
		}

		this.activePromptReject( "Cancelled by caller" );

		this.clearActivePrompt();

		// if there's no active interface there's no other end to cancel
		if( this.api.current && this.api.current.connected )
		{
			this.api.current.sendRequestAndWaitForResponse<void>( MessageboxEventType.CancelPrompt, false );
		}
	}

	private clearActivePrompt()
	{
		this.activePrompt = null;
		this.activePromptReject = null;
	}

	public render()
	{
		return <AvApiInterface apiName={ k_MessageboxInterface } ref={ this.api }/>
	}
}

