import { MsgGetGadgetManifest, MsgGetGadgetManifestResponse, MsgUpdateSceneGraph, EndpointAddr, endpointAddrToString, MsgGrabEvent, endpointAddrsMatch, MsgGrabberState, MsgGadgetStarted, MsgSetEndpointTypeResponse, MsgPokerProximity, MsgMouseEvent, MsgNodeHaptic } from './../common/aardvark-react/aardvark_protocol';
import { MessageType, EndpointType, MsgSetEndpointType, Envelope, MsgNewEndpoint, MsgLostEndpoint, parseEnvelope, MsgError } from 'common/aardvark-react/aardvark_protocol';
import { AvGadgetManifest, AvNode } from 'common/aardvark';
import * as express from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';
import bind from 'bind-decorator';
import axios, { AxiosResponse } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { URL, pathToFileURL } from 'url';
import * as fileUrl from 'file-url';
import { ENFILE } from 'constants';
import { threadId } from 'worker_threads';

let g_localInstallPathUri = fileUrl( path.resolve( process.cwd() ));
console.log( "Data directory is", g_localInstallPathUri );

function fixupUriForLocalInstall( originalUri: string ):URL
{
	let lowerUri = originalUri.toLowerCase();

	let httpPrefix = "http://aardvark.install";
	let httpsPrefix = "https://aardvark.install";

	if ( lowerUri.indexOf( httpPrefix ) == 0 )
	{
		return new URL( g_localInstallPathUri + originalUri.slice( httpPrefix.length ) );
	}
	else
	{
		if ( lowerUri.indexOf( httpsPrefix ) == 0 )
		{
			return new URL( g_localInstallPathUri + originalUri.slice( httpsPrefix.length ) );
		}
	}

	return new URL( originalUri );
}

function getJSONFromUri( uri: string ): Promise< any >
{
	return new Promise<any>( ( resolve, reject ) =>
	{
		try
		{
			let url = fixupUriForLocalInstall( uri );
			if( url.protocol == "file:" )
			{
				fs.readFile( url, "utf8", (err: NodeJS.ErrnoException, data: string ) =>
				{
					if( err )
					{
						reject( err );
					}
					else
					{
						resolve( JSON.parse( data ) );
					}
				});
			}
			else
			{
				let promRequest = axios.get( url.toString() )
				.then( (value: AxiosResponse ) =>
				{
					resolve( value.data );
				} )
				.catch( (reason: any ) =>
				{
					reject( reason );
				});
			}
		}
		catch( e )
		{
			reject( e );
		}
} );
}


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

	public setEndpointType( ep: CEndpoint )
	{
		let list = this.getListForType( ep.getType() );
		if( list )
		{
			list.push( ep );
		}

		if( ep.getType() == EndpointType.Monitor )
		{
			this.sendStateToMonitor( ep );
		}
		else if( ep.getType() == EndpointType.Renderer )
		{
			// tell the renderer about everybody's scene graphs
			for( let epid in this.m_endpoints )
			{
				let existingEp = this.m_endpoints[ epid ];
				if( existingEp.getType() == EndpointType.Gadget )
				{
					let gadgetData = existingEp.getGadgetData();
					if( gadgetData )
					{
						ep.sendMessageString(
							this.buildPackedEnvelope( 
								this.buildUpdateSceneGraphMessage( existingEp.getId(), gadgetData.getRoot(), gadgetData.getHook() ) ) );
					}
				}
			}
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

	private sendStateToMonitor( targetEp: CEndpoint )
	{
		for( let epid in this.m_endpoints )
		{
			let ep = this.m_endpoints[ epid ];
			switch( ep.getType() )
			{
				case EndpointType.Gadget:
					targetEp.sendMessageString( 
						this.buildPackedEnvelope( 
							this.buildNewEndpointMessage( ep ) ) );

					let gadgetData = ep.getGadgetData();
					if( gadgetData )
					{
						targetEp.sendMessageString(
							this.buildPackedEnvelope( 
								this.buildUpdateSceneGraphMessage( ep.getId(), gadgetData.getRoot(), gadgetData.getHook() ) ) );
					}
					break;

				case EndpointType.Renderer:
					targetEp.sendMessageString( 
						this.buildPackedEnvelope( 
							this.buildNewEndpointMessage( ep ) ) );
					break;
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
				target: env.target,
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

	public updateGadgetSceneGraph( gadgetId: number, root: AvNode, hook: string )
	{
		let env = this.buildUpdateSceneGraphMessage( gadgetId, root, hook );
		this.sendToAllEndpointsOfType( EndpointType.Monitor, env );
		this.sendToAllEndpointsOfType( EndpointType.Renderer, env );
	}

	private buildUpdateSceneGraphMessage( gadgetId: number, root: AvNode, hook: string ): Envelope
	{
		let msg: MsgUpdateSceneGraph = 
		{
			root,
			hook,
		};
		return (
		{
			type: MessageType.UpdateSceneGraph,
			sender: { type: EndpointType.Gadget, endpointId: gadgetId },
			payloadUnpacked: msg,
		} );
	}


	public buildNewEndpointMessage( ep: CEndpoint ): Envelope
	{
		let newEpMsg: MsgNewEndpoint =
		{
			newEndpointType: ep.getType(),
			endpointId: ep.getId(),
		}

		if( ep.getGadgetData() )
		{
			newEpMsg.gadgetUri = ep.getGadgetData().getUri();
		}

		return (
		{
			sender: { type: EndpointType.Hub },
			type: MessageType.NewEndpoint,
			payloadUnpacked: newEpMsg,
		} );
	}

	public forwardToEndpoint( epa: EndpointAddr, env: Envelope )
	{
		if( endpointAddrsMatch( epa, env.sender ) )
		{
			// don't forward messages back to whomever just sent them
			return;
		}

		let ep = this.m_endpoints[ epa.endpointId ];
		if( !ep )
		{
			console.log( "Sending message to unknown endpoint " + endpointAddrToString( epa ) );
			return;
		}

		ep.sendMessage( env.type, env.payloadUnpacked, epa, env.sender );
	}

}

class CGadgetData
{
	private m_gadgetUri: string;
	private m_ep: CEndpoint;
	private m_manifest: AvGadgetManifest = null;
	private m_root: AvNode = null;
	private m_hook: string = null;
	private m_dispatcher: CDispatcher = null;

	constructor( ep: CEndpoint, uri: string, initialHook: string, dispatcher: CDispatcher )
	{
		this.m_ep = ep;
		this.m_gadgetUri = uri;
		this.m_hook = initialHook;
		this.m_dispatcher = dispatcher;

		getJSONFromUri( this.m_gadgetUri + "/gadget_manifest.json")
		.then( ( response: any ) => 
		{
			this.m_manifest = response as AvGadgetManifest;
			console.log( `Gadget ${ this.m_ep.getId() } is ${ this.getName() }` );
		})
		.catch( (reason: any ) =>
		{
			console.log( `failed to load manifest from ${ this.m_gadgetUri }`, reason );
			this.m_ep.close();
		})
	}

	public getUri() { return this.m_gadgetUri; }
	public getName() { return this.m_manifest.name; }
	public getRoot() { return this.m_root; }
	public getHook() { return this.m_hook; }

	public updateSceneGraph( root: AvNode ) 
	{
		this.m_root = root;
		this.m_dispatcher.updateGadgetSceneGraph( this.m_ep.getId(), this.m_root, this.m_hook );
	}
}


interface EnvelopeHandler
{
	(env: Envelope, m: any): void;
}

class CEndpoint
{
	private m_ws: WebSocket = null;
	private m_id: number;
	private m_type = EndpointType.Unknown;
	private m_dispatcher: CDispatcher = null;
	private m_gadgetData: CGadgetData = null;
	private m_envelopeHandlers: { [ type:number]: EnvelopeHandler } = {}

	constructor( ws: WebSocket, id: number, dispatcher: CDispatcher )
	{
		console.log( "new connection");
		this.m_ws = ws;
		this.m_id = id;
		this.m_dispatcher = dispatcher;

		ws.on( 'message', this.onMessage );
		ws.on( 'close', this.onClose );

		this.registerEnvelopeHandler( MessageType.SetEndpointType, this.onSetEndpointType );
		this.registerEnvelopeHandler( MessageType.GetGadgetManifest, this.onGetGadgetManifest );
		this.registerEnvelopeHandler( MessageType.UpdateSceneGraph, this.onUpdateSceneGraph );
		this.registerEnvelopeHandler( MessageType.GrabberState, this.onGrabberState );
		this.registerEnvelopeHandler( MessageType.GrabEvent, this.onGrabEvent );
		this.registerEnvelopeHandler( MessageType.GadgetStarted, this.onGadgetStarted );
		this.registerEnvelopeHandler( MessageType.PokerProximity, this.onPokerProximity );
		this.registerEnvelopeHandler( MessageType.MouseEvent, this.onMouseEvent );
		this.registerEnvelopeHandler( MessageType.NodeHaptic, this.onNodeHaptic );
	}

	public getId() { return this.m_id; }
	public getType() { return this.m_type; }
	public getGadgetData() { return this.m_gadgetData; }

	private registerEnvelopeHandler( type: MessageType, handler: EnvelopeHandler )
	{
		this.m_envelopeHandlers[ type as number ] = handler;
	}

	private callEnvelopeHandler( env: Envelope ): boolean
	{
		let handler = this.m_envelopeHandlers[ env.type as number ];
		if( handler )
		{
			handler( env, env.payloadUnpacked );
			return true;
		}
		else
		{
			return false;
		}
	}

	@bind onMessage( message: string )
	{
		let env:Envelope = parseEnvelope( message );
		if( !env )
		{
			return;
		}

		env.sender = { type: this.m_type, endpointId: this.m_id };

		if( this.m_type == EndpointType.Unknown )
		{
			if( env.type != MessageType.SetEndpointType )
			{
				this.sendError( "SetEndpointType must be the first message from an endpoint" );
				return;
			}
		}
		else if( env.type == MessageType.SetEndpointType )
		{
			this.sendError( "SetEndpointType may only be sent once", MessageType.SetEndpointType );
			return;
		}

		if( !this.callEnvelopeHandler( env ) )
		{
			this.sendError( "Unsupported message", env.type );
		}

	}

	@bind private onGetGadgetManifest( env: Envelope, m: MsgGetGadgetManifest )
	{
		getJSONFromUri( m.gadgetUri + "/gadget_manifest.json" )
		.then( ( jsonManifest: any ) =>
		{
			let response: MsgGetGadgetManifestResponse =
			{
				manifest: jsonManifest as AvGadgetManifest,
			}
			this.sendMessage( MessageType.GetGadgetManifestResponse, response );
		})
		.catch( (reason:any ) =>
		{
			let response: MsgGetGadgetManifestResponse =
			{
				error: "Unable to load manifest " + reason,
			}
			this.sendMessage( MessageType.GetGadgetManifestResponse, response );
		})

	}

	@bind private onUpdateSceneGraph( env: Envelope, m: MsgUpdateSceneGraph )
	{
		if( !this.m_gadgetData )
		{
			this.sendError( "Only valid from gadgets", MessageType.UpdateSceneGraph );
			return;
		}

		this.m_gadgetData.updateSceneGraph( m.root );
	}


	@bind private onSetEndpointType( env: Envelope, m: MsgSetEndpointType )
	{
		switch( m.newEndpointType )
		{
			case EndpointType.Gadget:
				if( !m.gadgetUri )
				{
					this.sendError( "SetEndpointType to gadget must provide URI",
						MessageType.SetEndpointType );
						return;
				}
				break;

			case EndpointType.Monitor:
			case EndpointType.Renderer:
				break;

			default:
				this.sendError( "New endpoint type must be Gadget, Monitor, or Renderer", 
					MessageType.SetEndpointType );
				return;

		}

		console.log( `Setting endpoint ${ this.m_id } to ${ EndpointType[ m.newEndpointType ]}` );
		this.m_type = m.newEndpointType;

		if( this.getType() == EndpointType.Gadget )
		{
			console.log( " initial hook is " + m.initialHook );
			this.m_gadgetData = new CGadgetData( this, m.gadgetUri, m.initialHook, this.m_dispatcher );
		}

		let msgResponse: MsgSetEndpointTypeResponse =
		{
			endpointId: this.m_id
		}
		this.sendMessage( MessageType.SetEndpointTypeResponse, msgResponse );
		
		this.m_dispatcher.setEndpointType( this );

		this.m_dispatcher.sendToAllEndpointsOfType( EndpointType.Monitor,
			this.m_dispatcher.buildNewEndpointMessage( this ) );
	}

	@bind private onGrabberState( env: Envelope, m: MsgGrabberState )
	{
		this.m_dispatcher.forwardToEndpoint( m.grabberId, env );
		this.m_dispatcher.sendToAllEndpointsOfType( EndpointType.Monitor, env );
	}

	@bind private onPokerProximity( env: Envelope, m: MsgPokerProximity )
	{
		this.m_dispatcher.forwardToEndpoint( m.pokerId, env );
		this.m_dispatcher.sendToAllEndpointsOfType( EndpointType.Monitor, env );
	}

	@bind private onMouseEvent( env: Envelope, m: MsgMouseEvent )
	{
		this.m_dispatcher.forwardToEndpoint( m.event.panelId, env );
		this.m_dispatcher.sendToAllEndpointsOfType( EndpointType.Monitor, env );
	}

	@bind private onNodeHaptic( env: Envelope, m: MsgNodeHaptic )
	{
		this.m_dispatcher.sendToAllEndpointsOfType( EndpointType.Monitor, env );
		this.m_dispatcher.sendToAllEndpointsOfType( EndpointType.Renderer, env );
	}

	@bind private onGrabEvent( env: Envelope, m: MsgGrabEvent )
	{
		if( m.event.grabberId )
		{
			this.m_dispatcher.forwardToEndpoint( m.event.grabberId, env );
		}
		if( m.event.grabbableId )
		{
			this.m_dispatcher.forwardToEndpoint( m.event.grabbableId, env );
		}
		if( m.event.hookId )
		{
			this.m_dispatcher.forwardToEndpoint( m.event.hookId, env );
		}
		if( env.sender.type != EndpointType.Renderer )
		{
			this.m_dispatcher.sendToAllEndpointsOfType( EndpointType.Renderer, env );
		}
		this.m_dispatcher.sendToAllEndpointsOfType( EndpointType.Monitor, env );
	}

	@bind private onGadgetStarted( env:Envelope, m: MsgGadgetStarted )
	{
		m.mainGrabbableGlobalId = 
		{ 
			type: EndpointType.Node, 
			endpointId: this.m_id,
			nodeId: m.mainGrabbable,
		};

		this.m_dispatcher.forwardToEndpoint( m.epToNotify, env );
	}

	public sendMessage( type: MessageType, msg: any, target: EndpointAddr = undefined, sender:EndpointAddr = undefined  )
	{
		let env: Envelope =
		{
			type,
			sender: sender ? sender : { type: EndpointType.Hub, endpointId: 0 },
			target,
			payload: JSON.stringify( msg ),
		}
		this.sendMessageString( JSON.stringify( env ) )
	}

	public sendMessageString( msgString: string )
	{
		this.m_ws.send( msgString );
	}

	public getName()
	{
		return `#${ this.m_id } (${ EndpointType[ this.m_type ] })`;
	}
	public sendError( error: string, messageType?: MessageType )
	{
		let msg: MsgError =
		{
			error,
			messageType,
		};
		this.sendMessage( MessageType.Error, msg );

		console.log( `sending error to endpoint ${ this.getName() }: ${ error }` );
	}

	public close()
	{
		this.m_ws.close();
	}

	@bind onClose( code: number, reason: string )
	{
		console.log( `connection closed ${ reason }(${ code })` );
		this.m_dispatcher.removeEndpoint( this );

		let lostEpMsg: MsgLostEndpoint =
		{
			endpointId: this.m_id,
		}

		if( this.m_type == EndpointType.Gadget && this.m_gadgetData && this.m_gadgetData.getRoot() )
		{
			// Let renderers know that this gadget is no more.
			this.m_dispatcher.updateGadgetSceneGraph( this.m_id, null, null );
		}

		this.m_dispatcher.sendToAllEndpointsOfType( EndpointType.Monitor,
			{
				sender: { type: EndpointType.Hub },
				type: MessageType.LostEndpoint,
				payloadUnpacked: lostEpMsg,
			} );
		
		this.m_gadgetData = null;
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
