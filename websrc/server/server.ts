import * as express from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';
import bind from 'bind-decorator';


class CConnection
{
	private m_ws: WebSocket = null;

	constructor( ws: WebSocket )
	{
		console.log( "new connection");
		this.m_ws = ws;
		ws.on( 'message', this.onMessage );
		ws.send( "Hi there, I am a websocket server" );
	}

	@bind onMessage( message: string )
	{
		console.log( "received: ", message );
		this.m_ws.send( `Hello, you sent -> ${ message }` );
	}

	@bind onClose( code: number, reason: string )
	{
		console.log( `connection closed ${ reason }(${ code })` );
	}
}

class CServer
{
	private m_server = http.createServer( express() );
	private m_anonymousConnections: CConnection[] = [];
	private m_wss:WebSocket.Server = null;

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
		let conn = new CConnection( ws );
		ws.on( 'close', ( code: number, reason: string ) => { this.onClose( conn, code, reason ) } );
		this.m_anonymousConnections.push( new CConnection( ws ) );	
	}

	private onClose( conn: CConnection, code: number, reason: string )
	{
		console.log( `connection closed ${ reason }(${ code })` );
		let i = this.m_anonymousConnections.indexOf( conn );
		if( i != -1 )
		{
			delete this.m_anonymousConnections[i];
		}
	}
}


let server = new CServer( Number( process.env.PORT ) || 8999 );
