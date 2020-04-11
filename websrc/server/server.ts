import { Room, ServerRoomCallbacks, createRoom, RoomMemberGadget, onRoomMessage, updateRoomPose, addLocalGadget, destroyLocalGadget, updateLocalGadgetHook, findMemberOrigins } from './rooms';
import { g_localInstallPathUri, g_localInstallPath,	getJSONFromUri } from './serverutils';
import { parsePersistentHookPath, buildPersistentHookPathFromParts,
	HookPathParts,  buildPersistentHookPath, HookType } from 'common/hook_utils';
import { StoredGadget, AvGadgetManifest, AvNode, AvNodeType, AvNodeTransform, AvGrabEvent, 
	AvGrabEventType, MsgAttachGadgetToHook, MsgMasterStartGadget, MsgSaveSettings, 
	MsgOverrideTransform, MsgGetGadgetManifest, MsgGetGadgetManifestResponse, 
	MsgUpdateSceneGraph, EndpointAddr, endpointAddrToString, MsgGrabEvent, 
	endpointAddrsMatch, MsgGrabberState, MsgGadgetStarted, MsgSetEndpointTypeResponse, 
	MsgPokerProximity, MsgMouseEvent, MsgNodeHaptic, MsgUpdateActionState, 
	MsgDetachGadgetFromHook, MessageType, EndpointType, MsgSetEndpointType, Envelope, 
	MsgNewEndpoint, MsgLostEndpoint, parseEnvelope, MsgError, AardvarkPort,
	MsgGetInstalledGadgets, MsgGetInstalledGadgetsResponse, MsgDestroyGadget, WebSocketCloseCodes, 
	MsgResourceLoadFailed, 	MsgInstallGadget, EVolumeType, parseEndpointFieldUri, MsgUserInfo, 
	MsgRequestJoinChamber, MsgActuallyJoinChamber, MsgRequestLeaveChamber, MsgActuallyLeaveChamber, 
	MsgChamberList, gadgetDetailsToId, MsgUpdatePose, Permission, SharedGadget, 
	MsgAddGadgetToChambers, 
	MsgRemoveGadgetFromChambers, 
	AuthedRequest, 
	MsgUpdateChamberGadgetHook, 
	ENodeFlags, 
	MsgChamberGadgetHookUpdated, 
	MsgSignRequest, 
	GadgetAuthedRequest, 
	MsgSignRequestResponse, 
	ChamberNamespace, 
	MsgChamberMemberListUpdated,
	MsgCreateRoom,
	MsgDestroyRoom,
	MsgRoomMessageReceived,
	MsgCreateRoomResponse,
	MsgSendRoomMessage,
	GadgetRoomEnvelope,
	MsgDestroyRoomResponse,
	MsgRoomMessageReceivedResponse,
	AvStartGadgetResult
} from '@aardvarkxr/aardvark-shared';
import * as express from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';
import bind from 'bind-decorator';
import * as path from 'path';
import { persistence } from './persistence';
import isUrl from 'is-url';

console.log( "Data directory is", g_localInstallPathUri );


function computeRemoteGadgetId( remoteUserId: string, persistenceUuid: string )
{
	return `${ remoteUserId }_${ persistenceUuid }`.toLowerCase();
}

function computeRemoteUserId( roomGadgetPersistenceUuid: string, roomId: string, memberId: string )
{
	return `remote_${ roomGadgetPersistenceUuid }_${ roomId }_${ memberId }`.toLowerCase();
}

function computeRemoteIds( roomGadgetPersistenceUuid: string, roomId: string,
	memberId: string, persistenceUuid: string ): [ string, string ]
{
	let remoteUserId = computeRemoteUserId( roomGadgetPersistenceUuid, roomId, memberId );
	return (
		[
			remoteUserId,
			computeRemoteGadgetId( remoteUserId, persistenceUuid ),
		] );
}


class CDispatcher
{
	private m_endpoints: { [connectionId: number ]: CEndpoint } = {};
	private m_monitors: CEndpoint[] = [];
	private m_renderers: CEndpoint[] = [];
	private m_gadgets: CEndpoint[] = [];
	private m_gadgetsByUuid: { [ uuid: string ] : CEndpoint } = {};
	private m_nextSequenceNumber = 1;
	private m_chambers: { [ chamberPath: string ]: string } = {};
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

		this.sendChamberUpdate();
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

	public getChamberOwner( chamberPath: string ): string
	{
		return this.m_chambers[ chamberPath ];
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
	
	public forEachRoom( fn: ( room: Room ) => void )
	{
		for( let ep of this.getListForType( EndpointType.Gadget ) )
		{
			if( !ep.getGadgetData() )
			{
				continue;
			}

			for( let room of ep.getGadgetData().getRooms() )
			{
				fn( room );
			}
		}
	}

	public addRemoteGadget( roomGadgetPersistenceUuid: string, roomId: string,
		memberId: string, gadgetInfo: SharedGadget ): Promise< number >
	{
		let [ remoteUserId, newGadgetPersistenceUuid ] = computeRemoteIds( roomGadgetPersistenceUuid,
			roomId, memberId, gadgetInfo.persistenceUuid );

		// parse the hook path lookig for gadget UUIDs to fix up
		let hookToUse = gadgetInfo.hook;
		let hookParts = parsePersistentHookPath( gadgetInfo.hook );
		if( hookParts && hookParts.gadgetUuid )
		{
			hookParts.gadgetUuid = computeRemoteGadgetId( remoteUserId, hookParts.gadgetUuid );
			hookToUse = buildPersistentHookPathFromParts( hookParts );
		}

		console.log( `server starting ${ newGadgetPersistenceUuid } on ${ hookToUse } `
			+ `via ${ gadgetInfo.gadgetUri }` );
		return this.tellMasterToStartGadget( gadgetInfo.gadgetUri, hookToUse, newGadgetPersistenceUuid, 
			remoteUserId );
	}

	public destroyRemoteGadget( gadgetId: number )
	{
		let ep = this.getGadgetEndpoint( gadgetId );
		if( !ep )
		{
			console.log( `Request to destroy remote gadget ${ gadgetId }, which does not exist` );
			return;
		}

		ep.startDestroyGadget();
	}

	public updateRemoteGadgetHook( gadgetId: number, newHook: string )
	{
		let gadget = this.findGadgetById( gadgetId );
		if( !gadget )
		{
			console.log( "updateRemoteGadgetHook for unknown gadget", gadgetId );
			return;
		}

		
		// parse the hook path lookig for gadget UUIDs to fix up
		let hookToUse = newHook;
		let hookParts = parsePersistentHookPath( newHook );
		if( hookParts && hookParts.gadgetUuid )
		{
			hookParts.gadgetUuid = computeRemoteGadgetId( gadget.getRemoteUniversePath(),
				hookParts.gadgetUuid );
			hookToUse = buildPersistentHookPathFromParts( hookParts );
		}
		
		// console.log( `REMOTE UPDATE gadget ${ gadget.getEndpointId() } hook path to ${ m.newHook }` );
		gadget.clearGrabHook();
		gadget.attachToHook( hookToUse );
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

	private sendChamberUpdate()
	{
		let m: MsgChamberList =
		{
			chamberPaths: Array.from( Object.keys( this.m_chambers ) )
		}

		this.sendMessageToAllEndpointsOfType( EndpointType.Monitor, MessageType.ChamberList, m );
	}
	
	public addChamber( chamberPath: string, owningGadgetUuid: string )
	{
		this.m_chambers[ chamberPath ] = owningGadgetUuid;
		this.sendChamberUpdate();
	}

	public removeChamber( chamberPath: string )
	{
		delete this.m_chambers[ chamberPath ];
		this.sendChamberUpdate();
	}

	public gatherSharedGadgets(): SharedGadget[]
	{
		let gadgets: SharedGadget[] = [];

		for( let ep of this.getListForType( EndpointType.Gadget ) )
		{
			if( !ep.getGadgetData() || !ep.getGadgetData().getShareInChamber() )
			{
				continue;
			}

			let gadgetData = ep.getGadgetData();
			gadgets.push(
				{
					persistenceUuid: gadgetData.getPersistenceUuid(),
					gadgetUri: gadgetData.getUri(),
					hook: gadgetData.getHookPathToShare(),
				} );
		}

		return gadgets;
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

interface RoomDetails
{
	room: Room;
	callbacks: ServerRoomCallbacks;
}

class CGadgetData
{
	private m_gadgetUri: string;
	private m_ep: CEndpoint;
	private m_manifest: AvGadgetManifest = null;
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
	private m_chambers: { [ chamberPath: string ] : MsgRequestJoinChamber } = {};
	private m_roomDetails: { [ roomId: string ] : RoomDetails } = {};

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
			let manifestJson = await getJSONFromUri( this.m_gadgetUri + "/gadget_manifest.json" );
			this.m_manifest = manifestJson as AvGadgetManifest;
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
		for( let roomId in this.m_roomDetails )
		{
			// destroy all the remote gadgets
			for( let member of room.members )
			{
				for( let gadget of member.gadgets )
				{
					this.m_dispatcher.destroyRemoteGadget( gadget.gadgetId );
				}
			}

			// discard the room
			delete this.m_roomDetails[ roomId ];
		}
		this.m_roomDetails = {};

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
	public getShareInChamber() 
	{ 
		return ( typeof this.m_manifest.shareInChamber == "boolean" ? this.m_manifest.shareInChamber : true )
			&& !this.m_remoteUniversePath; 
	}
	public isMaster() { return this.m_persistenceUuid == "master"; }
	public isBeingDestroyed() { return this.m_gadgetBeingDestroyed; }

	public getRooms(): Room[] 
	{ 
		let res = [];
		for( let roomDetails of Object.values( this.m_roomDetails ) )
		{
			res.push( roomDetails.room );
		}
		return res;
	}

	private getOriginsForRoomMember( roomId: string, memberId: string )
	{
		let room = this.m_roomDetails[roomId].room;
		if( !room )
			return null;

		return findMemberOrigins( room, memberId );
	}

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
		this.sendChamberHookUpdate();
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

		this.sendChamberHookUpdate();
	}

	private sendChamberHookUpdate() 
	{
		if ( !this.getRemoteUniversePath() ) 
		{
			let msgUpdateHook: MsgUpdateChamberGadgetHook = 
			{
				userUuid: persistence.localUserInfo.userUuid,
				persistenceUuid: this.getPersistenceUuid(),
				hook: this.getHookPathToShare(),
			};
			this.m_dispatcher.sendToMasterSigned(MessageType.UpdateChamberGadgetHook, msgUpdateHook);

			this.m_dispatcher.forEachRoom( ( room ) =>
			{
				updateLocalGadgetHook( room, this.getPersistenceUuid(), this.getHookPathToShare() );
			} );

			// console.log( 'Telling remote about hook change ' + msgUpdateHook.hook );
		}
	}

	@bind
	public onCreateRoom( env: Envelope, m: MsgCreateRoom )
	{
		console.log( `onCreateRoom ${ JSON.stringify( m ) }` );
		let response: MsgCreateRoomResponse =
		{
		};

		if( this.m_roomDetails[ m.roomId ] )
		{
			response.error = `Room ${ m.roomId } already exists on this gadget`;
		}
		else
		{
			try
			{
				let callbacks: ServerRoomCallbacks =
				{
					sendMessage: ( message: GadgetRoomEnvelope ) => 
					{
						let msg: MsgSendRoomMessage = 
						{
							roomId: m.roomId,
							message,
						}
						this.m_ep.sendMessage( MessageType.SendRoomMessage, msg );
					},
					getSharedGadgets: () => 
					{ 
						return this.m_dispatcher.gatherSharedGadgets();
					},
					addRemoteGadget: ( memberId: string, gadget: RoomMemberGadget ) => 
					{
						return this.m_dispatcher.addRemoteGadget( this.m_persistenceUuid, m.roomId,
							memberId, gadget );
					},
					removeRemoteGadget: ( gadgetId: number ) => 
					{
						this.m_dispatcher.destroyRemoteGadget( gadgetId );
					},
					updateRemoteGadgetHook: ( gadgetId: number, 
						newHook: string ) => 
					{
						this.m_dispatcher.updateRemoteGadgetHook( gadgetId, newHook );
					},
		
				}
				
				let room = createRoom( m.roomId, callbacks );
				this.m_roomDetails[ m.roomId ] = { room, callbacks };
			}
			catch( e )
			{
				response.error = `${ e }`;
			}
		}
		this.m_ep.sendReply( MessageType.CreateRoomResponse, response, env );
	}

	@bind
	public onDestroyRoom( env: Envelope, m: MsgDestroyRoom )
	{
		console.log( `onCreateRoom ${ JSON.stringify( m ) }` );
		let response: MsgDestroyRoomResponse =
		{
		};

		let room = this.m_roomDetails[ m.roomId ]?.room;
		if( !room )
		{
			response.error = `Room ${ m.roomId } does not exist on this gadget`;
		}
		else
		{
			try
			{
				// destroy all the remote gadgets
				for( let member of room.members )
				{
					for( let gadget of member.gadgets )
					{
						this.m_dispatcher.destroyRemoteGadget( gadget.gadgetId );
					}
				}

				// discard the room
				delete this.m_roomDetails[ m.roomId ];
			}
			catch( e )
			{
				response.error = `${ e }`;
			}
		}
		this.m_ep.sendReply( MessageType.DestroyRoomResponse, response, env );
	}

	@bind
	public onRoomMessageReceived( env: Envelope, m: MsgRoomMessageReceived )
	{
		console.log( `onRoomMessageReceived on ${ this.getName() }: ${ JSON.stringify( m ) }` );
		let response: MsgRoomMessageReceivedResponse =
		{
		};

		let room = this.m_roomDetails[ m.roomId ]?.room;
		if( !room )
		{
			response.error = `Room ${ m.roomId } does not exist on this gadget`;
		}
		else
		{
			try
			{
				onRoomMessage( room, m.message );
			}
			catch( e )
			{
				response.error = `${ e }`;
			}
		}
		this.m_ep.sendReply( MessageType.RoomMessageReceivedResponse, response, env );
	}

	public sendUpdatedPose( m: MsgUpdatePose )
	{
		for( let roomId in this.m_roomDetails )
		{
			let room = this.m_roomDetails[roomId].room;
			updateRoomPose( room, m.originPath, m.newPose );
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

		if( !this.m_manifest?.permissions.includes( permissionName ) )
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

			case AvNodeType.Chamber:
				node.propChamberPath = this.computeChamberPath( node.propChamberId, node.propChamberNamespace );
				break;

			case AvNodeType.RoomMember:
				node.propMemberOrigins = this.getOriginsForRoomMember( node.propRoomId, node.propMemberId );
				node.propUniverseName = computeRemoteUserId( this.getPersistenceUuid(),
					node.propRoomId, node.propMemberId );
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

		for( let chamberPath in this.m_chambers )
		{
			this.leaveChamberInternal( chamberPath );
		}
		this.m_chambers = {};
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

	private computeChamberPath( chamberId: string, namespace: ChamberNamespace )
	{
		switch( namespace )
		{
			case ChamberNamespace.GadgetInstance:
				return `/gadget_instance/${ this.getId() }/chamber/${ chamberId }`;

			case ChamberNamespace.GadgetClass:
				return `/gadget_class/${ this.getClassId() }/chamber/${ chamberId }`;
		}
	}

	public joinChamber( chamberId: string, namespace: ChamberNamespace, showSelf: boolean )
	{
		if( namespace == undefined )
		{
			namespace = ChamberNamespace.GadgetInstance;
		}
		
		let req: MsgActuallyJoinChamber =
		{
			chamberPath: this.computeChamberPath( chamberId, namespace ),
			userUuid: persistence.localUserInfo.userUuid,
			userPublicKey: persistence.localUserInfo.userPublicKey,
			gadgets: this.m_dispatcher.gatherSharedGadgets(),
			showSelf,
		}
		this.m_dispatcher.sendToMasterSigned( MessageType.ActuallyJoinChamber, req );
		this.m_dispatcher.addChamber( req.chamberPath, this.m_persistenceUuid );

		this.m_chambers[ req.chamberPath ] =
		{
			chamberId,
			namespace,
			showSelf,
		};
	}

	private leaveChamberInternal( chamberPath: string )
	{
		let req: MsgActuallyLeaveChamber =
		{
			chamberPath,
			userUuid: persistence.localUserInfo.userUuid,
		}
		this.m_dispatcher.sendToMasterSigned( MessageType.ActuallyLeaveChamber, req );
		this.m_dispatcher.removeChamber( chamberPath );
	}

	public leaveChamber( chamberId: string, namespace: ChamberNamespace )
	{
		let chamberPath = this.computeChamberPath( chamberId, namespace );
		this.leaveChamberInternal( chamberPath );
		delete this.m_chambers[ chamberPath ];
	}

	public getChamberDetails( chamberPath: string ): MsgRequestJoinChamber
	{
		return this.m_chambers[ chamberPath ];
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
		this.registerEnvelopeHandler( MessageType.GetGadgetManifest, this.onGetGadgetManifest );
		this.registerEnvelopeHandler( MessageType.UpdateSceneGraph, this.onUpdateSceneGraph );
		this.registerForwardHandler( MessageType.GrabberState, ( m: MsgGrabberState ) =>
		{
			return [m.grabberId, EndpointType.Monitor ];
		} );
		this.registerEnvelopeHandler( MessageType.GrabEvent, this.onGrabEvent );
		this.registerEnvelopeHandler( MessageType.GadgetStarted, this.onGadgetStarted );
		this.registerForwardHandler( MessageType.PokerProximity, ( m: MsgPokerProximity ) =>
		{
			return [ m.pokerId, EndpointType.Monitor ];
		} );
		this.registerForwardHandler( MessageType.MouseEvent, ( m: MsgMouseEvent ) =>
		{
			return [ m.event.panelId, EndpointType.Monitor ];
		} );
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

		this.registerEnvelopeHandler( MessageType.GetInstalledGadgets, this.onGetInstalledGadgets );
		this.registerEnvelopeHandler( MessageType.DestroyGadget, this.onDestroyGadget );
		this.registerEnvelopeHandler( MessageType.InstallGadget, this.onInstallGadget );
		this.registerEnvelopeHandler( MessageType.RequestJoinChamber, this.onRequestJoinChamber );
		this.registerEnvelopeHandler( MessageType.RequestLeaveChamber, this.onRequestLeaveChamber );
		this.registerEnvelopeHandler( MessageType.SignRequest, this.onSignRequest );

		this.registerEnvelopeHandler( MessageType.UpdatePose, this.onUpdatePose );
		this.registerEnvelopeHandler( MessageType.ChamberGadgetHookUpdated, this.onChamberGadgetHookUpdated );
		this.registerEnvelopeHandler( MessageType.ChamberMemberListUpdated, this.onChamberMemberListUpdated );
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
		else
		{
			return false;
		}
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
				gadgetUri: m.gadgetUri,
			}

			if( !isUrl( response.manifest.model ) )
			{
				response.manifest.model = m.gadgetUri + "/" + response.manifest.model;
			}

			this.sendReply( MessageType.GetGadgetManifestResponse, response, env );
		})
		.catch( (reason:any ) =>
		{
			let response: MsgGetGadgetManifestResponse =
			{
				error: "Unable to load manifest " + reason,
				gadgetUri: m.gadgetUri,
			}
			this.sendReply( MessageType.GetGadgetManifestResponse, response, env );
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

			this.registerEnvelopeHandler( MessageType.CreateRoom, this.m_gadgetData.onCreateRoom );
			this.registerEnvelopeHandler( MessageType.DestroyRoom, this.m_gadgetData.onDestroyRoom );
			this.registerEnvelopeHandler( MessageType.RoomMessageReceived, 
				this.m_gadgetData.onRoomMessageReceived );
		
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

			// Tell any chambers this user is in about the new gadget
			if( this.m_gadgetData.getShareInChamber() )
			{
				let localGadget: SharedGadget =
				{
					gadgetUri: this.getGadgetData().getUri(),
					persistenceUuid: this.getGadgetData().getPersistenceUuid(),
					hook: this.getGadgetData().getHookPathToShare(),
				};

				let msgAddGadget: MsgAddGadgetToChambers =
				{
					userUuid: persistence.localUserInfo.userUuid,
					gadget: localGadget,
				};

				console.log( `SHARING ${ this.m_gadgetData.getUri() }`
					+` ${ msgAddGadget.gadget.persistenceUuid } hookPath: ${ msgAddGadget.gadget.hook }` );
				this.m_dispatcher.sendToMasterSigned( MessageType.AddGadgetToChambers, msgAddGadget );

				this.m_dispatcher.forEachRoom( ( room ) =>
				{
					addLocalGadget( room, localGadget );
				} );
			}
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

	@bind private onRequestJoinChamber( env: Envelope, m: MsgRequestJoinChamber )
	{
		this.verifyPermission( Permission.Chamber );
		this.getGadgetData().joinChamber( m.chamberId, m.namespace, m.showSelf );
	}

	@bind private onRequestLeaveChamber( env: Envelope, m: MsgRequestLeaveChamber )
	{
		this.verifyPermission( Permission.Chamber );
		this.getGadgetData().leaveChamber( m.chamberId, m.namespace );
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

	@bind
	private onUpdatePose( env: Envelope, m: MsgUpdatePose )
	{
		let gadgetEps = this.m_dispatcher.getListForType( EndpointType.Gadget );
		for( let gadgetEp of gadgetEps )
		{
			gadgetEp?.m_gadgetData.sendUpdatedPose( m );
		}

		this.m_dispatcher.sendToMasterSigned( MessageType.UpdatePose, m );
	}

	@bind
	private onChamberGadgetHookUpdated( env: Envelope, m: MsgChamberGadgetHookUpdated )
	{
		// console.log( 'remote telling us about hook change' );

		this.getGadgetData().verifyMaster();
		let gadget = this.m_dispatcher.findGadgetById( m.gadgetId );
		if( gadget )
		{
			// console.log( `REMOTE UPDATE gadget ${ gadget.getEndpointId() } hook path to ${ m.newHook }` );
			gadget.clearGrabHook();
			gadget.attachToHook( m.newHook );
		}
	}

	@bind
	private async onChamberMemberListUpdated( env: Envelope, m: MsgChamberMemberListUpdated )
	{
		// console.log( 'remote telling us about member list  change' );
		this.getGadgetData().verifyMaster();

		let chamberOwner = this.m_dispatcher.getChamberOwner( m.chamberPath );
		if( chamberOwner )
		{
			let chamberOwningGadget = await this.m_dispatcher.findGadget( chamberOwner );
			let chamberDetails = chamberOwningGadget?.getChamberDetails( m.chamberPath );
			if( chamberOwningGadget && chamberDetails )
			{
				m.chamberId = chamberDetails.chamberId;
				chamberOwningGadget.sendMessage( MessageType.ChamberMemberListUpdated, m );
			}
		}
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
			let msgRemoveGadget: MsgRemoveGadgetFromChambers =
			{
				userUuid: persistence.localUserInfo.userUuid,
				persistenceUuid: this.getGadgetData().getPersistenceUuid(),
			};
			this.m_dispatcher.sendToMasterSigned( MessageType.RemoveGadgetFromChambers, msgRemoveGadget );

			this.m_dispatcher.forEachRoom( ( room ) =>
			{
				destroyLocalGadget( room, this.getGadgetData().getPersistenceUuid() );
			} );

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

		this.m_app.use( "/gadgets", express.static( path.resolve( g_localInstallPath, "gadgets" ) ) );
		this.m_app.use( "/models", express.static( path.resolve( g_localInstallPath, "models" ) ) );
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

