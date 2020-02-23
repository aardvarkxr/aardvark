import { Model, View, CroquetSession, startSession } from '@croquet/croquet';

interface AckableEventArgs
{
	event: string;
	viewId: string;
	args: any;
	sequenceNumber: number;
}

export interface FnEventHandler
{
	( args: any ): any;
}

export interface AckableEventSubscription
{
	handler: string;
	deferrals: AckableEventArgs[];
}

export class ACModel extends Model
{
	private ackedEventSubscriptions: { [ eventId: string ]: AckableEventSubscription } = {};

	static createT<T extends typeof Model>(this: T, options: any): InstanceType<T>
	{
		return this.create( options ) as InstanceType< T >;
	}

	init( options: any )
	{
		super.init( options );
		this.subscribe( this.id, "ackableEvent", this.onAckableEvent );
	}

	public subscribeAckable( event: string, handler: FnEventHandler )
	{
		this.ackedEventSubscriptions[ event ] = 
		{
			handler: handler.name,
			deferrals: [],
		};
	}

	public unsubscribeAckable( event: string )
	{
		delete this.ackedEventSubscriptions[ event ];
	}

	public static get deferResult(): string
	{
		return "DEFERRED";
	}

	protected callNow() : number
	{
		return (this as any).now();
	}
	
	public onAckableEvent( req: AckableEventArgs )
	{
		let sub = this.ackedEventSubscriptions[ req.event ];
		if( sub )
		{
			let res: AckableEventArgs = 
			{ 
				...req,
				args: ( this as any )[ sub.handler ]( req.args )
			};

			if( res.args == ACModel.deferResult )
			{
				res.args = null;
				sub.deferrals.push( res );
			}
			else
			{
				this.publish( req.viewId, "ackableEventResult", res );
				for( let def of sub.deferrals )
				{
					this.publish( def.viewId, "ackableEventResult", def );
				}
				sub.deferrals = [];
			}
		}
	}
}

export class ACView extends View
{
	private pendingAcks: { [ eventId: string ]: { [ sequenceNumber: number ] :FnEventHandler } } = {};
	private nextAckSequenceNumber: number = 0;

	constructor( model: any )
	{
		super( model );
		this.subscribe( this.viewId, "ackableEventResult", this.onAckableEventResult );
	}

	public onAckableEventResult( res: AckableEventArgs )
	{
		let handler = this.pendingAcks[ res.event ]?.[ res.sequenceNumber ];
		if( !handler )
		{
			return;
		}

		delete this.pendingAcks[ res.event ][ res.sequenceNumber ];
		handler( res.args );
	}

	public publishAckable( scopeId: string, event: string, args: any ) : Promise< any >
	{
		return new Promise( ( resolve, reject ) =>
		{
			let req: AckableEventArgs =
			{
				event: event,
				viewId: this.viewId,
				args: args,
				sequenceNumber: this.nextAckSequenceNumber++,
			};

			if( !this.pendingAcks[ event ] )
			{
				this.pendingAcks[ event ] = {};
			}
			this.pendingAcks[event][req.sequenceNumber] = resolve;

			this.publish( scopeId, "ackableEvent", req );
		} );
	}
}
