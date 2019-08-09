import { MessageType, EndpointType, MsgSetEndpointType, Envelope, MsgNewEndpoint, MsgLostEndpoint, parseEnvelope } from './../common/aardvark-react/aardvark_protocol';
import * as express from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';
import bind from 'bind-decorator';
import { json } from 'body-parser';


class CDispatcher
{
	private m_endpoints: { [connectionId: number ]: CEndpoint } = {};
	private m_monitors: CEndpoint[] = [];
	private m_renderers: CEndpoint[] = [];
	private m_gadgets: CEndpoint[] = [];

	constructor()
	{

	}

	private getListForType( ept: EndpointType )
	{
		switch( ept )
		{
			case EndpointType.Gadget:
				return this.m_gadgets;

			case EndpointType.Monitor:
				return this.m_monitors;

			case EndpointType.Renderer:
				return this.m_renderers;
		}

		return null;
	}

	public addPendingEndpoint( ep: CEndpoint )
	{
		this.m_endpoints[ ep.getId() ] = ep;
	}

	public addEndpoint( ep: CEndpoint )
	{
		let list = this.getListForType( ep.getType() );
		if( list )
		{
			list.push( ep );
		}
	}

	public removeEndpoint( ep: CEndpoint )
	{
		let list = this.getListForType( ep.getType() );
		if( list )
		{
			let i = list.indexOf( ep );
			if( i != -1 )
			{
				list.splice( i, 1 );
			}
		}
	}

	public buildPackedEnvelope( env: Envelope )
	{
		if( !env.payloadUnpacked )
		{
			return JSON.stringify( env );
		}
		else 
		{
			let packedEnv: Envelope =
			{
				type: env.type,
				sender: env.sender,
				targets: env.targets,
			}

			if( env.payloadUnpacked )
			{
				packedEnv.payload = JSON.stringify( env.payloadUnpacked );
			}
			return JSON.stringify( packedEnv );
		}
	}


	public sendToAllEndpointsOfType( ept: EndpointType, env: Envelope )
	{
		let list = this.getListForType( ept );
		if( list )
		{
			let msgString = this.buildPackedEnvelope( env );

			for( let ep of list )
			{
				ep.sendMessageString( msgString );
			}
		}
	}
}


class CEndpoint
{
	private m_ws: WebSocket = null;
	private m_id: number;
	private m_type = EndpointType.Unknown;
	private m_dispatcher: CDispatcher = null;

	constructor( ws: WebSocket, id: number, dispatcher: CDispatcher )
	{
		console.log( "new connection");
		this.m_ws = ws;
		this.m_id = id;
		this.m_dispatcher = dispatcher;

		ws.on( 'message', this.onMessage );
		ws.on( 'close', this.onClose );
	}

	public getId() { return this.m_id; }
	public getType() { return this.m_type; }

	@bind onMessage( message: string )
	{
		let env:Envelope = parseEnvelope( message );
		if( !env )
		{
			return;
		}

		if( this.m_type == EndpointType.Unknown )
		{
			if( env.type == MessageType.SetEndpointType )
			{
				let m = env.payloadUnpacked as MsgSetEndpointType;
				switch( m.newEndpointType )
				{
					case EndpointType.Gadget:
					case EndpointType.Monitor:
					case EndpointType.Renderer:
						break;

					default:
						console.log( "New endpoint type must be Gadget, Monitor, or Renderer" );
						return;

				}

				console.log( `Setting endpoint ${ this.m_id } to ${ EndpointType[ m.newEndpointType ]}` );
				this.m_type = m.newEndpointType;
				this.m_dispatcher.addEndpoint( this );

				let newEpMsg: MsgNewEndpoint =
				{
					newEndpointType: m.newEndpointType,
					endpointId: this.m_id,
				}

				this.m_dispatcher.sendToAllEndpointsOfType( EndpointType.Monitor,
					{
						sender: { type: EndpointType.Hub },
						type: MessageType.NewEndpoint,
						payloadUnpacked: newEpMsg,
					} );
			}
			else
			{
				console.log( `endpoint ${ this.m_id } sent invalid message type ${ MessageType[ env.type ]}` );
			}
		}
		else if( env.type == MessageType.SetEndpointType )
		{
			console.log( `endpoint ${ this.m_id } sent invalid message type ${ MessageType[ env.type ]}` );
		}
		else
		{
			switch( env.type )
			{
				default:
					// forward the message
			}
		}
	}

	public sendMessage( msgType: MessageType, msg: any )
	{
		let env: Envelope =
		{
			type: msgType,
			sender: { type: EndpointType.Hub, endpointId: 0 },
			targets: [ { type: this.m_type, endpointId: this.m_id } ],
			payload: JSON.stringify( msg ),
		}
		this.sendMessageString( JSON.stringify( env ) )
	}

	public sendMessageString( msgString: string )
	{
		this.m_ws.send( msgString );
	}

	@bind onClose( code: number, reason: string )
	{
		console.log( `connection closed ${ reason }(${ code })` );
		this.m_dispatcher.removeEndpoint( this );

		let lostEpMsg: MsgLostEndpoint =
		{
			endpointId: this.m_id,
		}

		this.m_dispatcher.sendToAllEndpointsOfType( EndpointType.Monitor,
			{
				sender: { type: EndpointType.Hub },
				type: MessageType.LostEndpoint,
				payloadUnpacked: lostEpMsg,
			} );
	}
}


class CServer
{
	private m_server = http.createServer( express() );
	private m_wss:WebSocket.Server = null;
	private m_nextEndpointId = 27;
	private m_dispatcher = new CDispatcher;

	constructor( port: number )
	{
		this.m_wss = new WebSocket.Server( { server: this.m_server } );
		this.m_server.listen( port, () => 
		{
			console.log(`Server started on port ${ port } :)`);

			this.m_wss.on('connection', this.onConnection );
		} );
	}

	@bind onConnection( ws: WebSocket )
	{
		this.m_dispatcher.addPendingEndpoint( 
			new CEndpoint( ws, this.m_nextEndpointId++, this.m_dispatcher ) );
	}
}


let server = new CServer( Number( process.env.PORT ) || 8999 );
