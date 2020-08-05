import * as React from 'react';
import { AvInterfaceEntity, ActiveInterface } from './aardvark_interface_entity';
import bind from 'bind-decorator';
import { infiniteVolume, EndpointAddr } from '@aardvarkxr/aardvark-shared';


interface ApiEvent
{
	type: string;
	requestId?: number;
	parameters?: any[];
}

interface PromiseFunctions
{
	resolve: ( result: ApiEvent ) => void;
	reject: ( reason: any ) => void;
}

export interface ApiInterfaceSender
{
	readonly endpointAddr: EndpointAddr;
}

export interface ApiInterfaceHandler
{
	( sender: ApiInterfaceSender, parameters: any[] ): Promise< any[] | null >;
}

export interface ApiInterfaceProps
{
	/** Name of the API implemented by this object. This 
	 * must be in the form <apiname>@<versionnumber>.
	 */
	apiName: string;

	/** If this is true, this object is the singleton implementation
	 * of the interface.
	 * 
	 * @default false
	 */
	implementation?: boolean;

	/** Message type handlers for incoming messages. If an incoming
	 * message is received of a type that is not present in this list,
	 * it will be discarded.
	 * 
	 * The handler for each message type must return the parameters that
	 * it wants to reply to the sender with. If 
	 */
	handlers?: { [ msgType:string ] : ApiInterfaceHandler };

	/** Called when the API interface connects. */
	onConnect?: ( peer: EndpointAddr ) => void;

	/** Called when the API interface disconnects. */
	onDisconnect?: ( peer: EndpointAddr ) => void;
}


export class AvApiInterface extends React.Component< ApiInterfaceProps, {} >
{
	private activeInterface: ActiveInterface = null;
	private nextRequestId = 1;
	private requestPromises = new Map<number, PromiseFunctions>();

	public get connected(): boolean
	{
		return this.activeInterface != null;
	}

	sendRequestAndWaitForResponse<TResp>( msgType: string, expectResponse: boolean, ...args: any[] ) : Promise<TResp>
	{
		return new Promise<TResp>( ( resolve, reject ) =>
		{
			if( !this.activeInterface )
			{
				reject( "No connection" );
				return;
			}

			let event: ApiEvent =
			{
				type: msgType,
			};

			if( expectResponse )
			{
				event.requestId = this.nextRequestId++;
				this.requestPromises.set( event.requestId, 
					{ 
						resolve: ( resp: ApiEvent ) =>
						{
							resolve( resp.parameters?.[0] as TResp );
						}, 
						reject 
					} );
			}

			if( args && args.length )
			{
				event.parameters = args;
			}

			this.activeInterface.sendEvent( event );
		} );
	}

	@bind
	private onInterface( activeInterface: ActiveInterface )
	{
		this.activeInterface = activeInterface;
		this.props.onConnect?.( activeInterface.peer );

		activeInterface.onEnded( () =>
		{
			this.activeInterface = null;

			// reject all the outstanding requests
			for( let v of this.requestPromises.entries() )
			{
				v[1].reject( "Lost connection" );
			}

			this.requestPromises.clear();

			this.props.onDisconnect?.( activeInterface.peer );
		} );

		activeInterface.onEvent( ( event: ApiEvent )=>
		{
			let p = this.requestPromises.get( event.requestId );
			if( p )
			{
				p.resolve( event );
				this.requestPromises.delete( event.requestId );
				return;
			}

			let h = this.props.handlers[ event.type ];
			if( h )
			{
				h( { endpointAddr: activeInterface.peer }, event.parameters ?? [] )
				.then( ( result: any[] | null ) =>
				{
					if( result )
					{
						if( event.requestId )
						{
							let respEvent: ApiEvent =
							{
								type: event.type,
								requestId: event.requestId,
								parameters: result as any[],
							}
							activeInterface.sendEvent( respEvent );
						}
						else
						{
							console.log( `return value provided for ${ event.type } event, which did not expect one` );
						}
					}
				} )
				.catch( (reason: any)=>
				{
					console.log( `Message handler ${ event.type } failed with ${ reason }` );
					if( event.requestId )
					{
						let respEvent: ApiEvent =
						{
							type: event.type,
							requestId: event.requestId,
						}
						activeInterface.sendEvent( respEvent );
					}
				} );
				return;
			}

			console.log( `no handler for API event type=${ event.type } reqId=${ event.requestId }` );
		} );
	}

	public render()
	{
		if( this.props.implementation )
			return <AvInterfaceEntity receives={
				[
					{
						iface: this.props.apiName,
						processor: this.onInterface,
					}
				] }
				volume={ infiniteVolume() }
				/>;
		else
			return <AvInterfaceEntity transmits={
				[
					{
						iface: this.props.apiName,
						processor: this.onInterface,
					}
				] }
				volume={ infiniteVolume() }
				/>;

	}
}


