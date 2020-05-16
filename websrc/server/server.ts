import { AardvarkManifest, AardvarkPort, AuthedRequest, AvGrabEvent, AvGrabEventType, AvNode, AvNodeTransform, AvNodeType, EndpointAddr, endpointAddrsMatch, endpointAddrToString, EndpointType, ENodeFlags, Envelope, EVolumeType, GadgetAuthedRequest, gadgetDetailsToId, MessageType, MsgAttachGadgetToHook, MsgDestroyGadget, MsgDetachGadgetFromHook, MsgError, MsgGadgetStarted, MsgGeAardvarkManifestResponse, MsgGetAardvarkManifest, MsgGetInstalledGadgets, MsgGetInstalledGadgetsResponse, MsgGrabberState, MsgGrabEvent, MsgInstallGadget, MsgInterfaceEnded, MsgInterfaceEvent, MsgInterfaceReceiveEvent, MsgInterfaceSendEvent, MsgInterfaceStarted, MsgInterfaceTransformUpdated, MsgLostEndpoint, MsgMasterStartGadget, MsgNewEndpoint, MsgNodeHaptic, MsgOverrideTransform, MsgResourceLoadFailed, MsgSaveSettings, MsgSetEndpointType, MsgSetEndpointTypeResponse, MsgSignRequest, MsgSignRequestResponse, MsgUpdateActionState, MsgUpdateSceneGraph, MsgUserInfo, parseEndpointFieldUri, parseEnvelope, Permission, WebSocketCloseCodes } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import { buildPersistentHookPath, buildPersistentHookPathFromParts, HookPathParts, HookType, parsePersistentHookPath } from 'common/hook_utils';
import * as express from 'express';
import * as http from 'http';
import isUrl from 'is-url';
import * as path from 'path';
import * as WebSocket from 'ws';
import { persistence } from './persistence';
import { getJSONFromUri, g_localInstallPath, g_localInstallPathUri } from './serverutils';

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
	private m_gadgetsByUuid: { [ uuid: string ] : CEndpoint } = {};
	private m_nextSequenceNumber = 1;
	private m_gadgetsWithWaiters: { [ persistenceUuid: string ]: (( gadg: CGadgetData) => void)[] } = {};
	private m_startGadgetPromises: {[nodeId:number]: 
		[ ( gadgetEndpointId: number ) => void, ( reason: any ) => void ] } = {};
	private m_notifyNodeId = 1;

	constructor()
	{
	}

	public async init()
	{
	}

	public startAllGadgets()
	{
		// Either start the gadget or schedule a start of the gadget when the hook it depends on arrives.
		let gadgetsToStart = persistence.getActiveGadgets();
		for( let gadget of gadgetsToStart )
		{
			let gadgetHookPath = persistence.getGadgetHookPath( gadget.uuid );
			let hookParts = parsePersistentHookPath( gadgetHookPath )
			this.findGadget( hookParts?.gadgetUuid ?? "master" )
			.then( () =>
			{
				this.startOrRehookGadget( gadget.uri, gadgetHookPath, gadget.uuid );
			} );
		}		
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

		if( ep.getGadgetData() )
		{
			this.m_gadgetsByUuid[ ep.getGadgetData().getPersistenceUuid() ] = ep;
		}
	}

	public sendToMaster( type: MessageType, m: object )
	{
		let ep = this.m_gadgetsByUuid[ "master" ];
		if( ep )
		{
			ep.sendMessage( type, m );
		}
		else
		{
			console.log( "Tried to send message to master, but there is no master gadget endpoint" );
		}
	}

	public sendToMasterSigned( type: MessageType, m: AuthedRequest )
	{
		this.sendToMaster( type, persistence.signRequest( m ) );
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

		if( ep.getGadgetData() )
		{
			delete this.m_gadgetsByUuid[ ep.getGadgetData().getPersistenceUuid() ];
		}

		let endpointsToStayAliveFor = this.getListForType( EndpointType.Gadget ).length
			+ this.getListForType( EndpointType.Renderer ).length;
		if( endpointsToStayAliveFor == 0 )
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

	public forwardToHookNodes( env: Envelope )
	{
		for( let gadget of this.m_gadgets )
		{
			let hookNodes = gadget.getGadgetData().getHookNodes();
			if( !hookNodes )
				continue;
			
			for( let hookData of hookNodes )
			{
				this.forwardToEndpoint( hookData.epa, env );
			}
		}
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

	public async startOrRehookGadget( uri: string, initialHookPath: string, persistenceUuid: string )
	{
		// see if this gadget already exists
		let gadget = this.m_gadgetsByUuid[ persistenceUuid ];
		if( !gadget )
		{
			this.tellMasterToStartGadget( uri, initialHookPath, persistenceUuid );
			return;
		}

		// tell the gadget to move to the newly available hook
		let gadgetData = gadget.getGadgetData();
		await gadgetData.attachToHook( initialHookPath );
		gadgetData.sendSceneGraphToRenderer();
	}

	public tellMasterToStartGadget( uri: string, initialHook: string, persistenceUuid: string,
		remoteUserId?: string, remotePersistenceUuid?: string ): Promise<number>
	{
		let existingGadget = this.m_gadgetsByUuid[ persistenceUuid ] ;
		if( existingGadget )
		{
			return Promise.resolve( existingGadget.getId() );
		}

		return new Promise( ( resolve, reject ) =>
		{
			let notifyNodeId = this.m_notifyNodeId++;
			this.m_startGadgetPromises[ notifyNodeId ] = [ resolve, reject ];

			let epToNotify: EndpointAddr = 
			{
				type: EndpointType.Hub,
				nodeId: notifyNodeId,
			}

			// we don't have one of these gadgets yet, so tell master to start one
			let msg: MsgMasterStartGadget =
			{
				uri,
				initialHook,
				persistenceUuid,
				remoteUserId,
				epToNotify,
				remotePersistenceUuid,
			} 

			this.sendToMaster( MessageType.MasterStartGadget, msg );
		} );
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

	public findGadget( gadgetPersistenceUuid: string ): Promise<CGadgetData>
	{
		return new Promise( ( resolve, reject ) =>
		{
			let gadgetEp = this.m_gadgetsByUuid[ gadgetPersistenceUuid ];
			if( gadgetEp )
			{
				resolve( gadgetEp.getGadgetData() );
			}
			else
			{
				if( !this.m_gadgetsWithWaiters[ gadgetPersistenceUuid ] )
				{
					this.m_gadgetsWithWaiters[ gadgetPersistenceUuid ] = [];
				}
				this.m_gadgetsWithWaiters[ gadgetPersistenceUuid ].push( resolve );
			}
		} );
	}

	public notifyGadgetWaiters( persistenceUuid: string )
	{
		let gadgetData = this.m_gadgetsByUuid[ persistenceUuid ]?.getGadgetData();
		if( this.m_gadgetsWithWaiters[ persistenceUuid ] && gadgetData )
		{
			console.log( `Notifying anyone waiting on ${ persistenceUuid }` );
			for( let waiter of this.m_gadgetsWithWaiters[ persistenceUuid ] )
			{
				waiter( gadgetData );
			}
			delete this.m_gadgetsWithWaiters[ persistenceUuid ];
		}
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

interface HookNodeData
{
	epa: EndpointAddr;
	persistentName: string;
}

interface GadgetHookAddr extends HookPathParts
{
	holderAddr: EndpointAddr;
}


function printableHook( hook : string | GadgetHookAddr ): string
{
	if( !hook )
	{
		return "<none>";
	}

	if( typeof hook == "string" )
	{ 
		return hook;
	}
	else
	{
		return `parts: ${ endpointAddrToString( hook.holderAddr ) } ${ hook.holderPersistentName }`;
	}
}

class CGadgetData
{
	private m_gadgetUri: string;
	private m_ep: CEndpoint;
	private m_manifest: AardvarkManifest = null;
	private m_root: AvNode = null;
	private m_hook: string | GadgetHookAddr = null;
	private m_grabHook: string | GadgetHookAddr = null;
	private m_mainGrabbable: EndpointAddr = null;
	private m_mainHandle: EndpointAddr = null;
	private m_persistenceUuid: string = null;
	private m_remoteUniversePath: string = null;
	private m_dispatcher: CDispatcher = null;
	private m_hookNodes:HookNodeData[] = [];
	private m_transformOverrides: { [ nodeId: number ]: AvNodeTransform } = {}
	private m_nodes: { [ nodeId: number ]: AvNode } = {}
	private m_nodesByPersistentName: { [ persistentName: string ]: AvNode } = {}
	private m_gadgetBeingDestroyed = false;
	private m_updateTimer: NodeJS.Timeout = null;


	constructor( ep: CEndpoint, uri: string, initialHook: string, persistenceUuid:string,
		remoteUniversePath: string, dispatcher: CDispatcher )
	{
		if( persistenceUuid )
		{
			if( !initialHook && !remoteUniversePath )
			{
				initialHook = persistence.getGadgetHookPath( persistenceUuid );
			}

			this.m_persistenceUuid = persistenceUuid;
		}
		else
		{
			this.m_persistenceUuid = persistence.createGadgetPersistence( uri );
			if( initialHook )
			{
				persistence.setGadgetHook( this.m_persistenceUuid, initialHook, null );
			}
		}

		this.m_ep = ep;
		this.m_gadgetUri = uri;
		this.m_remoteUniversePath = remoteUniversePath;
		this.m_dispatcher = dispatcher;

		this.attachToHook( initialHook );
	}

	public async init()
	{
		try
		{
			let manifestJson = await getJSONFromUri( this.m_gadgetUri + "/manifest.webmanifest" );
			this.m_manifest = manifestJson as AardvarkManifest;
			console.log( `Gadget ${ this.m_ep.getId() } is ${ this.getName() }` );
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
	public getId() { return gadgetDetailsToId( this.getName(), this.getUri(), this.getPersistenceUuid() ); }
	public getClassId() { return gadgetDetailsToId( this.getName(), this.getUri() ); }
	public getName() { return this.m_manifest.name; }
	public getRoot() { return this.m_root; }
	public getHook() { return this.m_hook; }
	public getHookNodes() { return this.m_hookNodes; }
	public getPersistenceUuid() { return this.m_persistenceUuid; }
	public getRemoteUniversePath() { return this.m_remoteUniversePath; }
	public isMaster() { return this.m_persistenceUuid == "master"; }
	public isBeingDestroyed() { return this.m_gadgetBeingDestroyed; }

	public get debugName()
	{
		if( this.m_persistenceUuid )
			return this.m_persistenceUuid;
		else if( this.m_remoteUniversePath )
			return "REMOTE";
		else
			return "Gadget with unspeakable name";
	}

	public verifyMaster()
	{
		if( !this.isMaster() )
		{
			throw "Gadget is not master";
		}
	}

	public sendMessage( type: MessageType, msg: any, target: EndpointAddr = undefined, sender:EndpointAddr = undefined  )
	{
		this.m_ep.sendMessage( type, msg, target, sender );
	}

	public clearGrabHook()
	{
		this.m_grabHook = null;
	}

	public async attachToHook( hookPath: string )
	{
		// console.log( `Attaching ${ this.debugName } (${ this.m_gadgetUri }) to ${ hookPath }` );

		let hookParts = parsePersistentHookPath( hookPath );
		if( hookParts )
		{
			let holderGadgetData = await this.m_dispatcher.findGadget( hookParts.gadgetUuid );
			if( !holderGadgetData )
			{
				console.log( `Expected to find hook ${ hookPath } for ${ this.m_ep.getId() }. Attach failed` );
				return;
			}

			let holderNode = holderGadgetData.findNodeByPersistentName( hookParts.holderPersistentName );
			if( !holderNode )
			{
				console.log( `Could not find node ${ hookParts.holderPersistentName } from hook ${ hookPath } for ${ this.m_ep.getId() }. Attach failed` );
				return;
			}

			let holderAddr: EndpointAddr = 
			{ 
				type: EndpointType.Node, 
				endpointId: holderGadgetData.getEndpointId(),
				nodeId: holderNode.id,
			}
		
			this.setHook( { ...hookParts, holderAddr }, hookParts.type );
		}
		else
		{
			this.setHook( hookPath, HookType.Hook );
		}

		if( this.m_root )
		{
			// if we've already send a scene graph, send it again with the new hook
			this.sendSceneGraphToRenderer();
		}
	}

	private setHook( hook: string | GadgetHookAddr, type: HookType )
	{
		switch( type )
		{
			case HookType.Grab:
				this.m_grabHook = hook;
				break;

			case HookType.Hook:
				console.log( `Setting hook for ${ this.getEndpointId() } to ${ printableHook( hook ) }` );
				this.m_hook = hook;
				break;
		}
	}

	public getHookPathToShare(): string
	{
		let hookToStringify = this.m_grabHook ?? this.m_hook;
		if( typeof hookToStringify == "string" )
		{
			return hookToStringify;
		}
		else if( hookToStringify )
		{
			let hookParts = hookToStringify as HookPathParts;
			return buildPersistentHookPathFromParts( hookParts );
		}
		else
		{
			return undefined;
		}
	}

	public findNode( nodeId: number )
	{
		return this.m_nodes[ nodeId ];
	}

	public findNodeByPersistentName( persistentName: string )
	{
		return this.m_nodesByPersistentName[ persistentName ];
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

		if( permissionName != "scenegraph" && this.getRemoteUniversePath() )
		{
			throw new Error( `Verify permission ${ permissionName } on remote gadget ${ this.m_gadgetUri } FAILED.`
				+ ` remote gadgets only have at most the scenegraph permission` );
		}
	}

	public getHookNodeByPersistentName( hookPersistentName: string )
	{
		for( let hook of this.m_hookNodes )
		{
			if( hook.persistentName == hookPersistentName )
			{
				return hook.epa;
			}
		}

		return null;
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
		this.m_mainGrabbable = null;
		this.m_mainHandle = null;
		this.m_nodes = {};
		this.updateNode( this.m_root );

		this.sendSceneGraphToRenderer();

		if( firstUpdate )
		{
			// make sure the hook knows this thing is on it and that this thing knows it's
			// on the hook
			if( this.m_hook && typeof this.m_hook !== "string" )
			{
				if( this.m_mainGrabbable == null )
				{
					console.log( `Gadget ${ this.m_ep.getId() } is on a hook but`
						+ ` doesn't have a main grabbable` );
					this.m_hook = null;
				}
				else
				{
					let event: AvGrabEvent =
					{
						type: AvGrabEventType.EndGrab,
						hookId: this.m_hook.holderAddr,
						grabbableId: this.m_mainGrabbable,
						handleId: this.m_mainHandle,
						hookFromGrabbable: this.m_hook.hookFromGadget,
					};

					let msg: MsgGrabEvent =
					{
						event,
					}

					let env: Envelope =
					{
						type: MessageType.GrabEvent,
						sequenceNumber: this.m_dispatcher.nextSequenceNumber,
						payloadUnpacked: msg,
					}

					this.m_dispatcher.forwardToEndpoint( this.m_hook.holderAddr, env );
					this.m_dispatcher.forwardToEndpoint( this.m_mainGrabbable, env );
					this.m_dispatcher.sendToAllEndpointsOfType( EndpointType.Monitor, env );
				}
			}

			this.m_dispatcher.notifyGadgetWaiters( this.getPersistenceUuid() );
		}
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

		// mark all the remote nodes
		if( this.getRemoteUniversePath() )
		{
			node.flags |= ENodeFlags.Remote;
		}

		switch( node.type )
		{
			case AvNodeType.Grabbable:
				if( !this.m_mainGrabbable )
				{
					this.m_mainGrabbable = 
					{
						endpointId: this.m_ep.getId(),
						type: EndpointType.Node,
						nodeId: node.id,
					};
				}
				break;

			case AvNodeType.Handle:
				if( !this.m_mainHandle )
				{
					this.m_mainHandle = 
					{
						endpointId: this.m_ep.getId(),
						type: EndpointType.Node,
						nodeId: node.id,
					};
				}

				switch( node.propVolume.type )
				{
					case EVolumeType.ModelBox:
						if( !isUrl( node.propVolume.uri ) && !parseEndpointFieldUri( node.propVolume.uri ) )
						{
							node.propVolume.uri = this.m_gadgetUri + "/" + node.propVolume.uri;
						}
						break;
				}
				break;

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
		
			case AvNodeType.Model:
				if( !isUrl( node.propModelUri ) && !parseEndpointFieldUri( node.propModelUri ) )
				{
					node.propModelUri = this.m_gadgetUri + "/" + node.propModelUri;
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

		if( !this.m_remoteUniversePath )
		{
			persistence.destroyGadgetPersistence( this.m_gadgetUri, this.m_persistenceUuid );
		}
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
			remoteUniversePath: this.getRemoteUniversePath(),
		};

		let hookToSend: string | GadgetHookAddr;
		if( this.getRemoteUniversePath() )
		{
			if( this.m_grabHook )
			{
				console.log( "Overriding hook with grabHook" );
			}
			hookToSend = this.m_grabHook ?? this.m_hook;
			// console.log( "REMOTE scene graph update for " + this.getEndpointId() );
		}
		else
		{
			// never send the grab hook for local gadgets
			hookToSend = this.m_hook;
			if( !this.isMaster() )
			{
				// console.log( "LOCAL scene graph update for " + this.getEndpointId() );
			}
		}

		if( hookToSend )
		{
			if( typeof hookToSend === "string" )
			{
				msg.hook = hookToSend;
				// console.log( `Sending ${ hookToSend } for gadget ${ this.getEndpointId() }` );
			}
			else
			{
				msg.hook = hookToSend.holderAddr;
				msg.hookFromGadget = hookToSend.hookFromGadget;
				// console.log( `Sending ${ endpointAddrToString( hookToSend.holderAddr )	}+xform for gadget ${ this.getEndpointId() }` );
			}	
		}

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
	private m_origin: string| string[];
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

	constructor( ws: WebSocket, origin: string | string[], id: number, dispatcher: CDispatcher )
	{
		console.log( "new connection from ", origin );
		this.m_ws = ws;
		this.m_origin = origin;
		this.m_id = id;
		this.m_dispatcher = dispatcher;

		ws.on( 'message', this.onMessage );
		ws.on( 'close', this.onClose );

		this.registerEnvelopeHandler( MessageType.SetEndpointType, this.onSetEndpointType );
		this.registerEnvelopeHandler( MessageType.GetAardvarkManifest, this.onGetGadgetManifest );
		this.registerEnvelopeHandler( MessageType.UpdateSceneGraph, this.onUpdateSceneGraph );
		this.registerForwardHandler( MessageType.GrabberState, ( m: MsgGrabberState ) =>
		{
			return [m.grabberId, EndpointType.Monitor ];
		} );
		this.registerEnvelopeHandler( MessageType.GrabEvent, this.onGrabEvent );
		this.registerEnvelopeHandler( MessageType.GadgetStarted, this.onGadgetStarted );
		this.registerForwardHandler( MessageType.NodeHaptic, ( m: MsgNodeHaptic ) =>
		{
			return [ EndpointType.Monitor, EndpointType.Renderer ];
		} );
		this.registerEnvelopeHandler( MessageType.AttachGadgetToHook, this.onAttachGadgetToHook );
		this.registerEnvelopeHandler( MessageType.DetachGadgetFromHook, this.onDetachGadgetFromHook );
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
			return [ m.transmitter, m.receiver ];
		} );
		this.registerForwardHandler( MessageType.InterfaceEnded, ( m: MsgInterfaceEnded ) =>
		{
			return [ m.transmitter, m.receiver ];
		} );
		this.registerForwardHandler( MessageType.InterfaceTransformUpdated, ( m: MsgInterfaceTransformUpdated ) =>
		{
			return [ m.destination ];
		} );
		this.registerForwardHandler( MessageType.InterfaceReceiveEvent, ( m: MsgInterfaceReceiveEvent ) =>
		{
			return [ m.destination ];
		} );
		this.registerForwardHandler( MessageType.InterfaceSendEvent, ( m: MsgInterfaceSendEvent ) =>
		{
			return [ EndpointType.Monitor, EndpointType.Renderer ];
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
		this.registerEnvelopeHandler( MessageType.SignRequest, this.onSignRequest );
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
		handlerEpt: EndpointType )
	{
		this.registerEnvelopeHandler( msgType, 
			async ( env: Envelope, m: any ) =>
			{
				let replyMsg = await this.m_dispatcher.forwardMessageAndWaitForResponse(
					handlerEpt, msgType, m, 
					replyType );

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
		getJSONFromUri( m.gadgetUri + "/manifest.webmanifest" )
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

	private isGadgetUriAllowed( gadgetUri: string ):boolean
	{
		return ( this.m_origin == "http://localhost:23842" ||  gadgetUri.startsWith( this.m_origin as string ) )
			&& persistence.isGadgetUriInstalled( gadgetUri );
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

				if( !this.isGadgetUriAllowed( m.gadgetUri ) )
				{
					this.sendError( `Gadget URI is not allowed: ${ m.gadgetUri }`,
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
			console.log( `  initial hook:  ${ m.initialHook }` );
			console.log(  `  remote universe: ${ m.remoteUniversePath }`);
			
			this.m_gadgetData = new CGadgetData( this, m.gadgetUri, m.initialHook, m.persistenceUuid,
				m.remoteUniversePath, this.m_dispatcher );

			// Don't reply to the SetEndpointType until we've inited the gadget.
			// This loads the manifest for the gadget and has the chance to verify
			// some stuff.
			await this.m_gadgetData.init(); 

			if( !m.remoteUniversePath )
			{
				let settings = persistence.getGadgetSettings( this.m_gadgetData.getPersistenceUuid() );
				if( settings )
				{
					msgResponse.settings = settings;
				}	
			}

			msgResponse.persistenceUuid = this.m_gadgetData.getPersistenceUuid();

			if( this.m_gadgetData.isMaster() )
			{
				this.m_dispatcher.startAllGadgets();
			}

		} 
		else if (this.getType() == EndpointType.Renderer) 
		{
			msgResponse.settings = persistence.getRendererSettings();
		}

		this.sendMessage( MessageType.SetEndpointTypeResponse, msgResponse );

		let msgUserInfo: MsgUserInfo =
		{
			info: persistence.localUserInfo,
		}
		this.sendMessage( MessageType.UserInfo, msgUserInfo );
		
		this.m_dispatcher.setEndpointType( this );

		this.m_dispatcher.sendToAllEndpointsOfType( EndpointType.Monitor,
			this.m_dispatcher.buildNewEndpointMessage( this ) );
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
		if( m.event.handleId )
		{
			this.m_dispatcher.forwardToEndpoint( m.event.handleId, env );
		}
		if( m.event.hookId )
		{
			this.m_dispatcher.forwardToEndpoint( m.event.hookId, env );
		}

		let grabbableEp = this.m_dispatcher.getGadgetEndpoint( m.event.grabbableId?.endpointId );
		switch( m.event.type )
		{
			case AvGrabEventType.StartGrab:
				// start and end grab events also go to all hooks so they can highlight
				this.m_dispatcher.forwardToHookNodes( env );

				if( grabbableEp )
				{
					grabbableEp.setGrabHook( m.event.grabberId, m.event.grabberFromGrabbable );
				}
				break;

			case AvGrabEventType.EndGrab:
				// start and end grab events also go to all hooks so they can highlight
				this.m_dispatcher.forwardToHookNodes( env );

				if( grabbableEp )
				{
					grabbableEp.clearGrabHook();
				}
				break;

		}

		if( env.sender.type != EndpointType.Renderer )
		{
			this.m_dispatcher.sendToAllEndpointsOfType( EndpointType.Renderer, env );
		}
		this.m_dispatcher.sendToAllEndpointsOfType( EndpointType.Monitor, env );
	}

	@bind private onGadgetStarted( env:Envelope, m: MsgGadgetStarted )
	{
		if( m.mainGrabbable )
		{
			m.mainGrabbableGlobalId = 
			{ 
				type: EndpointType.Node, 
				endpointId: this.m_id,
				nodeId: m.mainGrabbable,
			};
		}
		if( m.mainHandle )
		{
			m.mainHandleGlobalId = 
			{ 
				type: EndpointType.Node, 
				endpointId: this.m_id,
				nodeId: m.mainHandle,
			};
		}
		m.startedGadgetEndpointId = this.m_id;

		this.m_dispatcher.forwardToEndpoint( m.epToNotify, env );
	}

	@bind private onAttachGadgetToHook( env: Envelope, m: MsgAttachGadgetToHook )
	{
		let gadget = this.m_dispatcher.getGadgetEndpoint( m.grabbableNodeId.endpointId );
		gadget.attachToHook( m.hookNodeId, m.hookFromGrabbable );
	}

	@bind private onDetachGadgetFromHook( env: Envelope, m: MsgDetachGadgetFromHook )
	{
		let gadget = this.m_dispatcher.getGadgetEndpoint( m.grabbableNodeId.endpointId );
		gadget.detachFromHook( m.hookNodeId );
	}

	private async setGrabHook( grabberId: EndpointAddr, grabberFromGrabbable: AvNodeTransform )
	{
		let grabberGadget = this.m_dispatcher.findGadgetById( grabberId.endpointId );
		let grabberNode = grabberGadget?.findNode( grabberId.nodeId );
		if( !grabberNode )
		{
			return;
		}
		
		let hookPath = buildPersistentHookPath( grabberGadget.getPersistenceUuid(), 
			grabberNode.persistentName, grabberFromGrabbable, HookType.Grab );
		this.getGadgetData().attachToHook( hookPath );
	}

	private async clearGrabHook()
	{
		this.getGadgetData().clearGrabHook();
	}

	private async attachToHook( hookId: EndpointAddr, hookFromGrabbable: AvNodeTransform )
	{
		if( !hookId )
		{
			// we're just clearing the hook
			return this.getGadgetData().attachToHook( null );
		}

		let holderGadget = this.m_dispatcher.findGadgetById( hookId.endpointId );
		let hookNode = holderGadget?.findNode( hookId.nodeId );
		if( !hookNode || hookNode.type != AvNodeType.Hook )
		{
			console.log( `can't attach ${ this.m_id } to `
				+`${ endpointAddrToString( hookId ) } because it doesn't have a path` );
			return;
		}

		let hookPath = buildPersistentHookPath( holderGadget.getPersistenceUuid(), hookNode.persistentName, 
			hookFromGrabbable, HookType.Hook );

		await this.getGadgetData().attachToHook( hookPath );

		console.log( `UPDATING ${this.getGadgetData().getPersistenceUuid()} hook to ${ hookPath }` );
		if( !this.getGadgetData().getRemoteUniversePath() )
		{
			persistence.setGadgetHookPath( this.m_gadgetData.getPersistenceUuid(), hookPath );
		}
	}

	private detachFromHook( hookId: EndpointAddr )
	{
		if( !this.m_gadgetData.getRemoteUniversePath() )
		{
			persistence.setGadgetHook( this.m_gadgetData.getPersistenceUuid(), null, null );
		}
	}

	@bind private onSaveSettings( env: Envelope, m: MsgSaveSettings )
	{
		if( this.m_gadgetData && !this.m_gadgetData.isBeingDestroyed() 
			&& !this.m_gadgetData.getRemoteUniversePath() )
		{
			persistence.setGadgetSettings( this.m_gadgetData.getPersistenceUuid(), m.settings );
		}
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
		console.log( `Installing gadget from web ${ m.gadgetUri }` );
		persistence.addInstalledGadget( m.gadgetUri );
	}

	public verifyPermission( permissionName: Permission )
	{
		if( !this.getGadgetData() )
		{
			throw new Error( "No gadget data on check for permission " + permissionName );
		}

		this.getGadgetData().verifyPermission( permissionName );
	}


	@bind private onSignRequest( env: Envelope, m: MsgSignRequest )
	{
		let actualReq: GadgetAuthedRequest =
		{
			...m.request,
			ownerUuid: persistence.localUserInfo.userUuid,
			gadgetUuid: this.getGadgetData().getPersistenceUuid(),
		}

		let msgRes: MsgSignRequestResponse =
		{
			request: persistence.signRequest( actualReq ) as GadgetAuthedRequest
		};
		
		this.sendReply( MessageType.SignRequestResponse, msgRes, env );
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
		this.m_server.listen( port, () => 
		{
			console.log(`Server started on port ${ port } :)`);

			this.m_wss.on('connection', this.onConnection );
		} );

		this.m_app.use( "/gadgets", express.static( path.resolve( g_localInstallPath, "gadgets" ),
		{
			setHeaders: ( res: express.Response, path: string ) =>
			{
				if( path.endsWith( ".webmanifest" ) )
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
			new CEndpoint( ws, request.headers.origin, this.m_nextEndpointId++, this.m_dispatcher ) );
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

startup();

