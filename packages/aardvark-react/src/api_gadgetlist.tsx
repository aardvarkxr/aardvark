import * as React from 'react';
import { AvInterfaceEntity, ActiveInterface } from './aardvark_interface_entity';
import bind from 'bind-decorator';
import { infiniteVolume } from '@aardvarkxr/aardvark-shared';


export const k_GadgetListInterface = "api-gadgetlist@1";

export enum GadgetListEventType
{
	AddFavorite = "add_favorite",
	AddFavoriteResponse = "add_favorite_response",
}


export interface GadgetListEvent
{
	type: GadgetListEventType;
	requestId: number;
	gadgetUrl?: string;
	result?: boolean;
}

interface PromiseFunctions
{
	resolve: ( result: boolean ) => void;
	reject: ( reason: any ) => void;
}

/** Causes a line to appear from the transform of this node's parent to the 
 * specified end point. */
export class AvGadgetList extends React.Component< {}, {} >
{
	private activeInterface: ActiveInterface = null;
	private nextRequestId = 1;
	private requestPromises = new Map<number, PromiseFunctions>();

	public addFavorite( gadgetUrl: string )
	{
		return new Promise<boolean>( ( resolve, reject ) =>
		{
			if( !this.activeInterface )
			{
				reject( "No connection" );
				return;
			}

			let event: GadgetListEvent =
			{
				type: GadgetListEventType.AddFavorite,
				requestId: this.nextRequestId++,
				gadgetUrl,
			};

			this.requestPromises.set( event.requestId, { resolve, reject } );

			this.activeInterface.sendEvent( event );
		} );
	}

	@bind
	private onInterface( activeInterface: ActiveInterface )
	{
		this.activeInterface = activeInterface;

		activeInterface.onEnded( () =>
		{
			this.activeInterface = null;

			// reject all the outstanding requests
			for( let v of this.requestPromises.entries() )
			{
				v[1].reject( "Lost connection" );
			}

			this.requestPromises.clear();
		} );

		activeInterface.onEvent( ( event: GadgetListEvent )=>
		{
			if( event.type == GadgetListEventType.AddFavoriteResponse )
			{
				let p = this.requestPromises.get( event.requestId );
				if( !p )
				{
					console.log( `Handling response for unknown request ${ event.requestId }` );
					return;
				}

				p.resolve( event.result );
				this.requestPromises.delete( event.requestId );
			}
		} );
	}

	public render()
	{
		return <AvInterfaceEntity transmits={
			[
				{
					iface: k_GadgetListInterface,
					processor: this.onInterface,
				}
			] }
			volume={ infiniteVolume() }
			/>;
	}
}

