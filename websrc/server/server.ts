import { AardvarkManifest, manifestUriFromGadgetUri, AardvarkPort, AvNode, AvNodeTransform, AvNodeType, EndpointAddr, endpointAddrsMatch, endpointAddrToString, EndpointType, ENodeFlags, Envelope, gadgetDetailsToId, MessageType, MsgDestroyGadget, MsgError, MsgGadgetStarted, MsgGeAardvarkManifestResponse, MsgGetAardvarkManifest, MsgGetInstalledGadgets, MsgGetInstalledGadgetsResponse, MsgInstallGadget, MsgInterfaceEnded, MsgInterfaceEvent, MsgInterfaceReceiveEvent, MsgInterfaceSendEvent, MsgInterfaceStarted, MsgInterfaceTransformUpdated, MsgLostEndpoint, MsgNewEndpoint, MsgNodeHaptic, MsgOverrideTransform, MsgResourceLoadFailed, MsgSaveSettings, MsgSetEndpointType, MsgSetEndpointTypeResponse, MsgUpdateActionState, MsgUpdateSceneGraph, parseEnvelope, Permission, WebSocketCloseCodes, MsgSetGadgetToAutoLaunch } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as express from 'express';
import * as http from 'http';
import isUrl from 'is-url';
import * as path from 'path';
import * as WebSocket from 'ws';
import { persistence } from './persistence';
import { getJSONFromUri, g_localInstallPath, g_localInstallPathUri } from './serverutils';
import * as Sentry from '@sentry/node';
import { k_AardvarkVersion } from 'common/version';

console.log( "Data directory is", g_localInstallPathUri );


interface PendingResponse
{
	resolve( resp: [ any, Envelope ] ): void;
	reject( reason: any ): void;
}


class CDispatcher
{
	private m_endpoints: { [connectionId: number ]: CEndpoint } = {};
	private m_monitors: CEndpoint[] = [];
	private m_renderers: CEndpoint[] = [];
	private m_gadgets: CEndpoint[] = [];
	private m_nextSequenceNumber = 1;
	private m_gadgetsWithWaiters: { [ persistenceUuid: string ]: (( gadg: CGadgetData) => void)[] } = {};
	private m_startGadgetPromises: {[nodeId:number]: 
		[ ( gadgetEndpointId: number ) => void, ( reason: any ) => void ] } = {};
	private m_successfulConnections = 0;

	constructor()
	{
	}

	public async init()
	{
	}

	public get nextSequenceNumber()
	{
		return this.m_nextSequenceNumber++;
	}

	public getListForType( ept: EndpointType )
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
							this.buildPackedEnvelope( gadgetData.buildUpdateSceneGraphMessage() ) );
					}
				}
			}
		}
	}

	public rememberSuccess()
	{
		this.m_successfulConnections++;
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
		delete this.m_endpoints[ ep.getId() ];

		let endpointsToStayAliveFor = this.getListForType( EndpointType.Gadget ).length
			+ this.getListForType( EndpointType.Renderer ).length;
		if( endpointsToStayAliveFor == 0 && this.m_successfulConnections > 0 )
		{
			// exit cleanly one second after the last endpoint we care about 
			// disconnects. Under nodemon this means we'll need to restart by hand. 
			// Under normal operation we'll start when avrenderer.exe starts.
			global.setTimeout( () => 
			{
				console.log( "Exiting gracefully after the last disconnect" )
				process.exit( 0 );
			}, 1000 );
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
							this.buildPackedEnvelope( gadgetData.buildUpdateSceneGraphMessage() ) );
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

	public forwardMessageAndWaitForResponse<T>( ept: EndpointType, type: MessageType, 
		msg: any, responseType: MessageType ):
		Promise< [ T, Envelope ] >
	{
		let list = this.getListForType( ept );
		if( list && list.length >= 1 )
		{
			return list[0].sendMessageAndWaitForResponse( type, msg, responseType );
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
				sequenceNumber: this.nextSequenceNumber,
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
			sequenceNumber: this.nextSequenceNumber,
			payloadUnpacked: newEpMsg,
		} );
	}

	private onMessage( nodeId: number, env: Envelope )
	{
		switch( env.type )
		{
			case MessageType.GadgetStarted:
				let mGadgetStarted = env.payloadUnpacked as MsgGadgetStarted;
				let promise = this.m_startGadgetPromises[ nodeId ];
				if( promise )
				{
					promise[0]( mGadgetStarted.startedGadgetEndpointId );
					delete this.m_startGadgetPromises[ nodeId ];
				}
				break;
		}
	}

	public forwardToEndpoint( epa: EndpointAddr, env: Envelope )
	{
		if( epa.type == EndpointType.Hub )
		{
			this.onMessage( epa.nodeId, env );
			return;
		}

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

	public getGadgetEndpoint( gadgetId: number ) : CEndpoint
	{
		if( gadgetId == undefined )
			return undefined;

		let ep = this.m_endpoints[ gadgetId ];
		if( ep && ep.getType() == EndpointType.Gadget )
		{
			return ep;
		}
		else
		{
			return null;
		}
	}

	public findGadgetById( gadgetId: number ): CGadgetData
	{
		for( let gadgetEp of this.m_gadgets )
		{
			if( gadgetEp.getId() == gadgetId )
				return gadgetEp.getGadgetData();
		}
		return null;
	}

	public sendMessageToAllEndpointsOfType( ept: EndpointType, type: MessageType, m: object )
	{
		this.sendToAllEndpointsOfType( ept,
		{
			sender: { type: EndpointType.Hub },
			type,
			sequenceNumber: this.nextSequenceNumber,
			payloadUnpacked: m,
		} );
	}

}


class CGadgetData
{
	private m_gadgetUri: string;
	private m_ep: CEndpoint;
	private m_manifest: AardvarkManifest = null;
	private m_root: AvNode = null;
	private m_persistenceUuid: string = null;
	private m_dispatcher: CDispatcher = null;
	private m_transformOverrides: { [ nodeId: number ]: AvNodeTransform } = {}
	private m_nodes: { [ nodeId: number ]: AvNode } = {}
	private m_nodesByPersistentName: { [ persistentName: string ]: AvNode } = {}
	private m_gadgetBeingDestroyed = false;
	private m_updateTimer: NodeJS.Timeout = null;


	constructor( ep: CEndpoint, uri: string, dispatcher: CDispatcher )
	{
		this.m_ep = ep;
		this.m_gadgetUri = uri;
		this.m_dispatcher = dispatcher;
	}

	public async init()
	{
		try
		{
			let manifestJson = await getJSONFromUri( manifestUriFromGadgetUri( this.m_gadgetUri ) );
			this.m_manifest = manifestJson as AardvarkManifest;
			console.log( `Gadget ${ this.m_ep.getId() } is ${ this.getName() }` );

			this.m_dispatcher.rememberSuccess();
		}
		catch( e )
		{
			console.log( `failed to load manifest from ${ this.m_gadgetUri }`, e );
			this.m_ep.close();
		}
	}

	public onConnectionClosed()
	{
		this.m_ep = null;
	}

	public getEndpointId() { return this.m_ep.getId(); }
	public getUri() { return this.m_gadgetUri; }
	public getId() { return gadgetDetailsToId( this.getName(), this.getUri(), "" ); }
	public getClassId() { return gadgetDetailsToId( this.getName(), this.getUri() ); }
	public getName() { return this.m_manifest.name; }
	public getRoot() { return this.m_root; }
	public isBeingDestroyed() { return this.m_gadgetBeingDestroyed; }

	public get debugName()
	{
		if( this.m_persistenceUuid )
			return this.m_persistenceUuid;
		else
			return "Gadget with unspeakable name";
	}

	public sendMessage( type: MessageType, msg: any, target: EndpointAddr = undefined, sender:EndpointAddr = undefined  )
	{
		this.m_ep.sendMessage( type, msg, target, sender );
	}

	public findNode( nodeId: number )
	{
		return this.m_nodes[ nodeId ];
	}

	public hasPermission( permissionName: Permission ): boolean
	{
		return this.m_manifest?.aardvark?.permissions.includes( permissionName ) ?? false;
	}


	public verifyPermission( permissionName: Permission )
	{
		if( !this.m_manifest )
		{
			throw new Error( `Verify permission ${ permissionName } on gadget with no manifest` );
		}

		if( !this.m_manifest?.aardvark?.permissions.includes( permissionName ) )
		{
			throw new Error( `Verify permission ${ permissionName } on gadget ${ this.m_gadgetUri } FAILED` );
		}
	}

	public updateSceneGraph( root: AvNode ) 
	{
		if( this.m_gadgetBeingDestroyed )
		{
			return;
		}

		let firstUpdate = this.m_root == null;
		this.m_root = root;
		this.m_nodesByPersistentName = {};
		this.m_nodes = {};
		this.updateNode( this.m_root );

		this.sendSceneGraphToRenderer();
	}

	private updateNode( node: AvNode )
	{
		if( !node )
			return;

		this.m_nodes[ node.id ] = node;
		if( node.persistentName )
		{
			this.m_nodesByPersistentName[ node.persistentName ] = node;
		}

		switch( node.type )
		{
			case AvNodeType.Transform:
				if( this.m_transformOverrides )
				{
					let override = this.m_transformOverrides[ node.id ];
					if( override )
					{
						node.propTransform = override;
					}
				}
				break;
		
			default:
				// many node types need no processing
		}

		if( node.children )
		{
			for( let child of node.children )
			{
				this.updateNode( child );
			}
		}
	}


	public overrideTransform( nodeId: EndpointAddr, transform: AvNodeTransform )
	{
		if( this.m_gadgetBeingDestroyed )
		{
			return;
		}

		if( transform )
		{
			this.m_transformOverrides[ nodeId.nodeId ] = transform;
		}
		else
		{
			delete this.m_transformOverrides[ nodeId.nodeId ];
		}
		this.sendSceneGraphToRenderer();
	}

	public destroyResources()
	{
		this.m_gadgetBeingDestroyed = true;
		persistence.destroyGadgetPersistence( this.m_gadgetUri, this.m_persistenceUuid );
	}

	public scheduleSceneGraphRefresh()
	{
		if( this.m_updateTimer )
		{
			return;
		}

		this.m_updateTimer = global.setTimeout( () =>
		{
			this.updateNode( this.m_root );
			this.sendSceneGraphToRenderer();
			this.m_updateTimer = null;
		}, 1 );
	}

	public sendSceneGraphToRenderer()
	{
		let env = this.buildUpdateSceneGraphMessage();
		this.m_dispatcher.sendToAllEndpointsOfType( EndpointType.Renderer, env );
		this.m_dispatcher.sendToAllEndpointsOfType( EndpointType.Monitor, env );
	}

	public buildUpdateSceneGraphMessage(): Envelope
	{
		let msg: MsgUpdateSceneGraph = 
		{
			root: this.getRoot(),
			gadgetUrl: this.getUri(),
			userAgent: this.m_ep.userAgent,
			origin: this.m_ep.origin,
		};

		return (
		{
			type: MessageType.UpdateSceneGraph,
			sequenceNumber: this.m_dispatcher.nextSequenceNumber,
			sender: { type: EndpointType.Gadget, endpointId: this.m_ep.getId() },
			payloadUnpacked: msg,
		} );
	}

}


interface EnvelopeHandler
{
	(env: Envelope, m: any): void;
}

interface ForwardHandler
{
	(m: any ): ( EndpointAddr | EndpointType ) [];
}

interface ForwardHandlerWithReply
{
	handler: ForwardHandler;
	replyType: MessageType;
}

class CEndpoint
{
	private m_ws: WebSocket = null;
	private m_id: number;
	private m_origin: string;
	private m_userAgent: string;
	private m_type = EndpointType.Unknown;
	private m_dispatcher: CDispatcher = null;
	private m_gadgetData: CGadgetData = null;
	private m_envelopeHandlers: { [ type:number]: EnvelopeHandler } = {};
	private m_forwardHandlers: { [type: number]: ForwardHandler } = {};
	private m_pendingResponses: 
	{ 
		[ responseType: number ]: 
		{ 
			[ sequenceNumber: number ]: 
			PendingResponse 
		}
		
	} = {};

	constructor( ws: WebSocket, origin: string | string[], userAgent: string, id: number, dispatcher: CDispatcher )
	{
		console.log( "new connection from ", origin );
		this.m_ws = ws;
		this.m_userAgent = userAgent;
		this.m_id = id;
		this.m_dispatcher = dispatcher;

		if( typeof origin === "string" )
		{
			this.m_origin = origin;
		}
		else
		{
			this.m_origin = origin[0];
		}

		ws.on( 'message', this.onMessage );
		ws.on( 'close', this.onClose );

		this.registerEnvelopeHandler( MessageType.SetEndpointType, this.onSetEndpointType );
		this.registerEnvelopeHandler( MessageType.GetAardvarkManifest, this.onGetGadgetManifest );
		this.registerEnvelopeHandler( MessageType.UpdateSceneGraph, this.onUpdateSceneGraph );
		this.registerEnvelopeHandler( MessageType.GadgetStarted, this.onGadgetStarted );
		this.registerForwardHandler( MessageType.NodeHaptic, ( m: MsgNodeHaptic ) =>
		{
			return [ EndpointType.Monitor, EndpointType.Renderer ];
		} );
		this.registerEnvelopeHandler( MessageType.SaveSettings, this.onSaveSettings );
		this.registerForwardHandler( MessageType.UpdateActionState, (m:MsgUpdateActionState) =>
		{
			return [ { type: EndpointType.Gadget, endpointId: m.gadgetId } ];
		});
		this.registerForwardHandler( MessageType.ResourceLoadFailed, ( m: MsgResourceLoadFailed ) =>
		{
			return [ EndpointType.Monitor, m.nodeId ];
		});

		this.registerEnvelopeHandler( MessageType.OverrideTransform, this.onOverrideTransform );
		this.registerForwardHandler( MessageType.InterfaceEvent, ( m: MsgInterfaceEvent ) =>
		{
			return [ m.destination ];
		} );

		this.registerForwardHandler( MessageType.InterfaceStarted, ( m: MsgInterfaceStarted ) =>
		{
			return [ m.transmitter, m.receiver, EndpointType.Monitor ];
		} );
		this.registerForwardHandler( MessageType.InterfaceEnded, ( m: MsgInterfaceEnded ) =>
		{
			return [ m.transmitter, m.receiver, EndpointType.Monitor ];
		} );
		this.registerForwardHandler( MessageType.InterfaceTransformUpdated, ( m: MsgInterfaceTransformUpdated ) =>
		{
			return [ m.destination ];
		} );
		this.registerForwardHandler( MessageType.InterfaceReceiveEvent, ( m: MsgInterfaceReceiveEvent ) =>
		{
			return [ m.destination, EndpointType.Monitor ];
		} );
		this.registerForwardHandlerWithReply( MessageType.InterfaceLock, 
			MessageType.InterfaceLockResponse,
			EndpointType.Renderer );
		this.registerForwardHandlerWithReply( MessageType.InterfaceUnlock, 
			MessageType.InterfaceUnlockResponse,
			EndpointType.Renderer );
		this.registerForwardHandlerWithReply( MessageType.InterfaceRelock, 
			MessageType.InterfaceRelockResponse,
			EndpointType.Renderer );
		this.registerForwardHandlerWithReply( MessageType.InterfaceSendEvent, 
			MessageType.InterfaceSendEventResponse,
			EndpointType.Renderer );

		this.registerEnvelopeHandler( MessageType.GetInstalledGadgets, this.onGetInstalledGadgets );
		this.registerEnvelopeHandler( MessageType.DestroyGadget, this.onDestroyGadget );
		this.registerEnvelopeHandler( MessageType.InstallGadget, this.onInstallGadget );
		this.registerEnvelopeHandler( MessageType.SetGadgetToAutoLaunch, this.onSetGadgetToAutoLaunch );
	}

	public getId() { return this.m_id; }
	public getType() { return this.m_type; }
	public getGadgetData() { return this.m_gadgetData; }

	public get userAgent(): string
	{
		return this.m_userAgent;
	}

	public get origin() : string 
	{
		return this.m_origin;
	}

	private registerEnvelopeHandler( type: MessageType, handler: EnvelopeHandler )
	{
		this.m_envelopeHandlers[ type as number ] = handler;
	}

	private callEnvelopeHandler( env: Envelope ): boolean
	{
		let handler = this.m_envelopeHandlers[ env.type as number ];
		if( handler )
		{
			try
			{
				handler( env, env.payloadUnpacked );
			}
			catch( e )
			{
				console.log( `Error processing message of type ${ MessageType[ env.type ] } `
					+ `from ${ endpointAddrToString( env.sender ) }: ${ e }`)
			}
			return true;
		}
		else if( this.m_pendingResponses[ env.type ] )
		{
			let pendingResponse = this.m_pendingResponses[ env.type ][ env.replyTo ];
			if( !pendingResponse )
			{
				console.log( `Received message of type ${ MessageType[ env.type ] } that didn't `
					+ `have a matching sequence number ${ env.replyTo }` );
			}
			else
			{
				pendingResponse.resolve( [ env.payloadUnpacked, env ] );
				delete this.m_pendingResponses[ env.type ][ env.replyTo ];
			}
			return true;
		}
		else
		{
			return false;
		}
	}

	public sendMessageAndWaitForResponse<T>( type: MessageType, msg: any, responseType: MessageType ):
		Promise< [ T, Envelope ] >
	{
		return new Promise( ( resolve, reject ) =>
		{
			let seqNumber = this.sendMessage( type, msg );

			if( !this.m_pendingResponses[ responseType ] )
			{
				this.m_pendingResponses[ responseType ] = {};
			}

			this.m_pendingResponses[ responseType ][ seqNumber ] = { resolve, reject };
		} );
	}

	private registerForwardHandler( type: MessageType, handler: ForwardHandler )
	{
		this.m_forwardHandlers[ type ] = handler;
		this.registerEnvelopeHandler( type, this.onForwardedMessage );
	}

	@bind private onForwardedMessage( env: Envelope, m: any )
	{
		let handler = this.m_forwardHandlers[ env.type ];
		if( handler )
		{
			let eps = handler( m );
			if( eps )
			{
				for( let ep of eps )
				{
					if( typeof ep === "object" )
					{
						this.m_dispatcher.forwardToEndpoint( ep as EndpointAddr, env );
					}
					else if( typeof ep === "number" )
					{
						this.m_dispatcher.sendToAllEndpointsOfType( ep as EndpointType, env );
					}
				}
			}
		}
	}

	private registerForwardHandlerWithReply( msgType: MessageType, replyType: MessageType, 
		handlerEpt: EndpointType, sendToMonitor?: boolean )
	{
		let reallySendToMonitor = sendToMonitor ?? true;
		this.registerEnvelopeHandler( msgType, 
			async ( env: Envelope, m: any ) =>
			{
				if( reallySendToMonitor )
				{
					this.m_dispatcher.sendToAllEndpointsOfType( EndpointType.Monitor, env );
				}

				let [ replyMsg, replyEnv ] = await this.m_dispatcher.forwardMessageAndWaitForResponse(
					handlerEpt, msgType, m, 
					replyType );

				if( reallySendToMonitor )
				{
					this.m_dispatcher.sendToAllEndpointsOfType( EndpointType.Monitor, replyEnv );
				}
				
				this.sendReply( replyType, replyMsg, env );
			} );
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

	@bind private onGetGadgetManifest( env: Envelope, m: MsgGetAardvarkManifest )
	{
		getJSONFromUri( manifestUriFromGadgetUri( m.gadgetUri ) )
		.then( ( jsonManifest: any ) =>
		{
			let response: MsgGeAardvarkManifestResponse =
			{
				manifest: jsonManifest as AardvarkManifest,
				gadgetUri: m.gadgetUri,
			}

			this.sendReply( MessageType.GetAardvarkManifestResponse, response, env );
		})
		.catch( (reason:any ) =>
		{
			let response: MsgGeAardvarkManifestResponse =
			{
				error: "Unable to load manifest " + reason,
				gadgetUri: m.gadgetUri,
			}
			this.sendReply( MessageType.GetAardvarkManifestResponse, response, env );
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

	@bind private async onSetEndpointType( env: Envelope, m: MsgSetEndpointType )
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
			case EndpointType.Utility:
				break;

			default:
				this.sendError( "New endpoint type must be Gadget, Monitor, or Renderer", 
					MessageType.SetEndpointType );
				return;

		}

		console.log( `Setting endpoint ${ this.m_id } to ${ EndpointType[ m.newEndpointType ]}` );
		this.m_type = m.newEndpointType;

		let msgResponse: MsgSetEndpointTypeResponse =
		{
			endpointId: this.m_id,
		}

		if( this.getType() == EndpointType.Gadget )
		{
			this.m_gadgetData = new CGadgetData( this, m.gadgetUri, this.m_dispatcher );

			// Don't reply to the SetEndpointType until we've inited the gadget.
			// This loads the manifest for the gadget and has the chance to verify
			// some stuff.
			await this.m_gadgetData.init(); 
		} 
		else if (this.getType() == EndpointType.Renderer) 
		{
			msgResponse.settings = persistence.getRendererSettings();
		}

		this.sendMessage( MessageType.SetEndpointTypeResponse, msgResponse );

		this.m_dispatcher.setEndpointType( this );

		this.m_dispatcher.sendToAllEndpointsOfType( EndpointType.Monitor,
			this.m_dispatcher.buildNewEndpointMessage( this ) );
	}


	@bind private onGadgetStarted( env:Envelope, m: MsgGadgetStarted )
	{
		m.startedGadgetEndpointId = this.m_id;

		this.m_dispatcher.forwardToEndpoint( m.epToNotify, env );
	}

	@bind private onSaveSettings( env: Envelope, m: MsgSaveSettings )
	{
	}

	@bind private onOverrideTransform( env: Envelope, m: MsgOverrideTransform )
	{
		let ep = this.m_dispatcher.getGadgetEndpoint( m.nodeId.endpointId );
		let gadgetData = ep.getGadgetData();
		gadgetData.overrideTransform( m.nodeId, m.transform );
	}

	@bind private onGetInstalledGadgets( env: Envelope, m: MsgGetInstalledGadgets )
	{
		let resp: MsgGetInstalledGadgetsResponse =
		{
			installedGadgets: persistence.getInstalledGadgets()
		}
		this.sendReply( MessageType.GetInstalledGadgetsResponse, resp, env );
	}

	@bind private onInstallGadget( env: Envelope, m: MsgInstallGadget )
	{
		console.log( `Favoriting gadget from web ${ m.gadgetUri }` );
		for( let gadget of this.m_dispatcher.getListForType( EndpointType.Gadget ) )
		{
			if( gadget.hasPermission( Permission.Favorites ) )
			{
				gadget.sendMessage( MessageType.InstallGadget, m );
			}
		}
	}

	@bind private onSetGadgetToAutoLaunch( env: Envelope, m: MsgSetGadgetToAutoLaunch )
	{
		console.log( `Setting gadget to Auto Launch from web ${ m.gadgetUri }` );
		for( let gadget of this.m_dispatcher.getListForType( EndpointType.Gadget ) )
		{
			if( gadget.hasPermission( Permission.Favorites ) )
			{
				gadget.sendMessage( MessageType.SetGadgetToAutoLaunch, m );
			}
		}
	}

	public hasPermission( permissionName: Permission ): boolean
	{
		return this.getGadgetData() && this.getGadgetData().hasPermission( permissionName );
	}

	public verifyPermission( permissionName: Permission )
	{
		if( !this.getGadgetData() )
		{
			throw new Error( "No gadget data on check for permission " + permissionName );
		}

		this.getGadgetData().verifyPermission( permissionName );
	}


	@bind private onDestroyGadget( env: Envelope, m: MsgDestroyGadget )
	{
		let ep = this.m_dispatcher.getGadgetEndpoint( m.gadgetId );
		if( !ep )
		{
			console.log( `Request to destroy gadget ${ m.gadgetId }, which does not exist` );
			return;
		}

		ep.startDestroyGadget();
	}

	public startDestroyGadget()
	{
		if( this.m_gadgetData )
		{
			this.m_gadgetData.destroyResources();
		}
		this.m_ws.close( WebSocketCloseCodes.UserDestroyedGadget );
	}

	public sendMessage( type: MessageType, msg: any, target: EndpointAddr = undefined, sender:EndpointAddr = undefined  )
	{
		let env: Envelope =
		{
			type,
			sequenceNumber: this.m_dispatcher.nextSequenceNumber,
			sender: sender ? sender : { type: EndpointType.Hub, endpointId: 0 },
			target,
			payload: JSON.stringify( msg ),
		}
		this.sendMessageString( JSON.stringify( env ) )
		return env.sequenceNumber;
	}

	public sendReply( type: MessageType, msg: any, replyTo: Envelope, sender:EndpointAddr = undefined  )
	{
		let env: Envelope =
		{
			type,
			sequenceNumber: this.m_dispatcher.nextSequenceNumber,
			sender: sender ? sender : { type: EndpointType.Hub, endpointId: 0 },
			target: replyTo.sender,
			replyTo: replyTo.sequenceNumber,
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

		let lostEndpointEnv: Envelope =
		{
			sender: { type: EndpointType.Hub },
			type: MessageType.LostEndpoint,
			sequenceNumber: this.m_dispatcher.nextSequenceNumber,
			payloadUnpacked: lostEpMsg,
		};

		this.m_dispatcher.sendToAllEndpointsOfType( EndpointType.Renderer, lostEndpointEnv );
		this.m_dispatcher.sendToAllEndpointsOfType( EndpointType.Monitor, lostEndpointEnv );
		
		this.m_gadgetData?.onConnectionClosed()
		this.m_gadgetData = null;
	}
}


class CServer
{
	private m_app = express();
	private m_server = http.createServer( this.m_app );
	private m_wss:WebSocket.Server = null;
	private m_nextEndpointId = 27;
	private m_dispatcher = new CDispatcher;

	constructor( port: number )
	{
		this.m_wss = new WebSocket.Server( { server: this.m_server } );

		this.m_server.on( 'error', ( e:NodeJS.ErrnoException ) =>
		{
			if( e.code === 'EADDRINUSE' )
			{
				console.log( `Can't listen on port ${port}. Exiting` );
				process.exit( -100 );
			}
		} );

		this.m_server.listen( port, '127.0.0.1', () => 
		{
			console.log(`Server started on port ${ port } :)`);

			this.m_wss.on('connection', this.onConnection );
		} );

		this.m_app.use( "/gadgets", express.static( path.resolve( g_localInstallPath, "gadgets" ),
		{
			setHeaders: ( res: express.Response, path: string ) =>
			{
				if( path.endsWith( ".webmanifest" ) || path.endsWith( ".glb" ) )
				{
					res.setHeader( "Access-Control-Allow-Origin", "*" );
				}
			}
		}) );
		this.m_app.use( "/models", express.static( path.resolve( g_localInstallPath, "models" ),
		{
			setHeaders: ( res: express.Response, path: string ) =>
			{
				if( path.endsWith( ".glb" ) )
				{
					res.setHeader( "Access-Control-Allow-Origin", "*" );
				}
			}
		} ) );
	}

	async init()
	{
		await persistence.init();
		this.m_dispatcher.init();
	}

	@bind onConnection( ws: WebSocket, request: http.IncomingMessage )
	{
		this.m_dispatcher.addPendingEndpoint( 
			new CEndpoint( ws, request.headers.origin, request.headers["user-agent"], 
			this.m_nextEndpointId++, this.m_dispatcher ) );
	}
}

// the VS Code debugger and the source maps get confused if the CWD is not the workspace dir.
// Instead, just chdir to the data directory if we start in the workspace dir.
let p = process.cwd();
if( path.basename( p ) == "websrc" )
{
	process.chdir( "../data" );
}

let server:CServer;

async function startup()
{
	server = new CServer( Number( process.env.PORT ) || AardvarkPort );
	server.init();
}

Sentry.init( 
	{ 
		dsn: 'https://36b174a5c5634e989d1786a04fbab535@o433321.ingest.sentry.io/5392342',
		release: 'aardvark-server@' + k_AardvarkVersion,
	});

startup();

