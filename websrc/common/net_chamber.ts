import { CroquetSession, startSession } from '@croquet/croquet';
import { AuthedRequest, verifySignature, MsgUpdatePose, MsgActuallyJoinChamber, 
	MsgActuallyLeaveChamber, 
	MinimalPose,
	SharedGadget,
	MsgAddGadgetToChambers,
	MsgRemoveGadgetFromChambers,
	MsgUpdateChamberGadgetHook} from '@aardvarkxr/aardvark-shared';
import { ACModel, ACView } from './croquet_utils';


interface ChamberGadgetOptions extends SharedGadget
{
	chamberModelId: string;
	userUuid: string;
}

export interface ChamberGadgetInfo
{
	readonly persistenceUuid: string;
	readonly gadgetUri: string;
	readonly hook: string;
};

class ChamberGadget extends ACModel implements ChamberGadgetInfo
{
	private m_persistenceUuid: string;
	private m_gadgetUri: string;
	private m_hook: string;

	public init( options: ChamberGadgetOptions )
	{
		super.init( options );
		this.m_persistenceUuid = options.persistenceUuid;
		this.m_gadgetUri = options.gadgetUri;
		this.m_hook = options.hook;
	}

	public updateHook( hook: string )
	{
		this.m_hook = hook;
	}

	public get persistenceUuid() { return this.m_persistenceUuid; }
	public get gadgetUri() { return this.m_gadgetUri; }
	public get hook() { return this.m_hook; }
}

ChamberGadget.register();

interface ChamberMemberOptions
{
	chamberModelId: string;
	userUuid: string;
	userPublicKey: string;
	gadgets: SharedGadget[];
}

export interface ChamberMemberInfo
{
	readonly uuid: string;
	gadgets: ChamberGadgetInfo[];
	readonly poses: { [path: string] : MinimalPose };
};

export interface PoseUpdatedArgs
{
	userUuid: string;
	originPath: string;
	pose: MinimalPose;
}

export interface GadgetUpdatedArgs
{
	userUuid: string;
	gadgetPersistenceUuid: string;
}

export interface GadgetListUpdatedArgs
{
	userUuid: string;
}

class ChamberMember extends ACModel implements ChamberMemberInfo
{
	private chamberModelId: string;
	private userUuid: string;
	private userPublicKey: string;
	private m_poses: { [path: string ]: MinimalPose } = {};
	private m_gadgets: { [ persistenceUuid: string ]: ChamberGadget } = {};
	private m_lastPoseTime: number;

	public init( options: ChamberMemberOptions )
	{
		super.init( options );
		this.chamberModelId = options.chamberModelId;
		this.userUuid = options.userUuid;
		this.userPublicKey = options.userPublicKey;
		this.subscribe( this.id, "updatePose", this.updatePose );
		this.m_lastPoseTime = this.callNow();

		if( options.gadgets )
		{
			for( let sharedGadget of options.gadgets )
			{
				this.addGadget( sharedGadget );
			}
		}
	}

	public updatePose( args: MsgUpdatePose )
	{
		//( this as any ).modelOnly();
		// silently ignore poses from non-members
		verifySignature( args, this.userPublicKey );
		this.m_poses[ args.originPath ] = args.newPose;
		this.m_lastPoseTime = this.callNow();

		let outboundPose: PoseUpdatedArgs =
		{
			userUuid: this.userUuid,
			originPath: args.originPath,
			pose: args.newPose,
		}

		this.publish( this.chamberModelId, "poseUpdated", outboundPose );
	}

	public addGadget( sharedGadget: SharedGadget )
	{
		let gadgetOptions: ChamberGadgetOptions =
		{
			...sharedGadget,
			chamberModelId: this.chamberModelId,
			userUuid: this.userUuid,
		};

		this.m_gadgets[ gadgetOptions.persistenceUuid ] = ChamberGadget.createT( gadgetOptions );

		this.sendGadgetListUpdate();
	}

	public removeGadget( persistenceUuid: string )
	{
		if( this.m_gadgets[ persistenceUuid ] )
		{
			this.m_gadgets[ persistenceUuid ].destroy();
			delete this.m_gadgets[ persistenceUuid ];
			this.sendGadgetListUpdate();
		}
	}

	private sendGadgetListUpdate()
	{
		let args: GadgetListUpdatedArgs =
		{
			userUuid: this.uuid
		};

		this.publish( this.chamberModelId, "gadgetListUpdated", args);
	}

	public updateGadgetHook( args: MsgUpdateChamberGadgetHook )
	{
		if( this.m_gadgets[ args.persistenceUuid ] )
		{
			this.m_gadgets[ args.persistenceUuid ].updateHook( args.hook );
			let gadgetUpdated: GadgetUpdatedArgs =
			{
				userUuid: this.uuid,
				gadgetPersistenceUuid: args.persistenceUuid,
			}
			this.publish( this.chamberModelId, "gadgetUpdated", gadgetUpdated );
		}
	}

	public findGadget( gadgetPersistenceUuid: string )
	{
		return this.m_gadgets[ gadgetPersistenceUuid ];
	}

	public get uuid() : string
	{
		return this.userUuid;
	}

	public get publicKey() : string
	{
		return this.userPublicKey;
	}

	public get gadgets() : ChamberGadgetInfo[]
	{
		return Object.values( this.m_gadgets );
	}

	public get poses()
	{
		return this.m_poses;
	}

	public get lastPoseTime(): number
	{
		return this.m_lastPoseTime;
	}
}

ChamberMember.register();

interface ChamberOptions
{
	path: string;
}


class Chamber extends ACModel
{
	public path: string;
	public members: ChamberMember[] = [];

	public init( options: ChamberOptions )
	{
		super.init( options );
		this.path = options.path;

		this.subscribeAckable( "initChamber", this.initChamber );
		this.subscribeAckable( "joinChamber", this.joinChamber );
		this.subscribeAckable( "leaveChamber", this.leaveChamber );
		this.subscribe( this.id, "updatePose", this.updatePose );
		this.subscribe( this.id, "addGadget", this.addGadget );
		this.subscribe( this.id, "removeGadget", this.removeGadget );
		this.subscribe( this.id, "updateGadgetHook", this.updateGadgetHook );
	}

	public static uuidToPath( uuid: string )
	{
		return "/aardvark/chamber/" + uuid;
	}

	public findMember( userUuid: string )
	{
		return this.members.find( ( member: ChamberMember ) =>
		{
			return member.uuid == userUuid;
		})
	}

	private findAndAuthMember( userUuid: string, request: AuthedRequest )
	{
		//( this as any ).modelOnly();
		let member = this.findMember( userUuid );
		if( !member )
		{
			throw new Error( "Unknown member " + userUuid );
		}

		verifySignature( request, member.publicKey );
		return member;
	}

	private verifyChamber( chamberPath: string ) 
	{
		if ( chamberPath != this.path ) 
		{
			throw new Error( "request to interact with chamber " + this.path
				+ " came from the wrong chamber " + chamberPath );
		}
	}

	public initChamber( path: string )
	{
		if( !this.path )
		{
			this.path = path;
		}
	}

	public joinChamber( args: MsgActuallyJoinChamber )
	{
		//( this as any ).modelOnly();
		verifySignature( args, args.userPublicKey );
		this.verifyChamber( args.chamberPath );

		let existingMember = this.findMember( args.userUuid );
		if( existingMember )
		{
			// update the gadget list
			let gadgetsToDelete  = new Set<string>();
			for( let existingGadget of existingMember.gadgets )
			{
				gadgetsToDelete.add( existingGadget.persistenceUuid );
			}

			for( let newGadget of args.gadgets )
			{
				if( gadgetsToDelete.has( newGadget.persistenceUuid ) )
				{
					gadgetsToDelete.delete( newGadget.persistenceUuid );
					let existingGadget = existingMember.findGadget( newGadget.persistenceUuid );
					existingGadget.updateHook( newGadget.hook );
				}
				else
				{
					existingMember.addGadget( newGadget );
				}
			}

			for( let exGadget of gadgetsToDelete.values() )
			{

				existingMember.removeGadget( exGadget );
			}

			return true; // true means we're in the chamber now
		}

		let userOptions: ChamberMemberOptions =
		{
			chamberModelId: this.id,
			userUuid: args.userUuid,
			userPublicKey: args.userPublicKey,
			gadgets: args.gadgets,
		};

		this.members.push( ChamberMember.create( userOptions ) as ChamberMember );
		this.publish( this.id, "member_joined", args.userUuid );
	
		this.cleanupIdleMembers();
		return true;
	}

	public leaveChamber( args: MsgActuallyLeaveChamber )
	{
		let member = this.findAndAuthMember( args.userUuid, args);
		this.verifyChamber( args.chamberPath );

		this.removeMember( member );
		return true;
	}

	private removeMember( member: ChamberMember )
	{
		let index = this.members.indexOf( member );
		this.members.splice( index, 1 );

		member.destroy();
	}

	private updatePose( args: MsgUpdatePose )
	{
		// silently drop pose updates from non-members
		if( !this.findMember( args.userUuid ) )
			return;

		let member = this.findAndAuthMember( args.userUuid, args );
		member.updatePose( args );
		this.cleanupIdleMembers();
	}

	private addGadget( args: MsgAddGadgetToChambers )
	{
		let member = this.findAndAuthMember( args.userUuid, args );
		member.addGadget( args.gadget );
	}

	private removeGadget( args: MsgRemoveGadgetFromChambers )
	{
		let member = this.findAndAuthMember( args.userUuid, args );
		member.removeGadget( args.persistenceUuid );
	}

	private updateGadgetHook( args: MsgUpdateChamberGadgetHook )
	{
		let member = this.findAndAuthMember( args.userUuid, args );
		member.updateGadgetHook( args );
	}

	private cleanupIdleMembers()
	{
		let expirationTime = this.callNow() - 5 * 60 * 1000;
		for( let member of this.members )
		{
			if( member.lastPoseTime < expirationTime )
			{
				console.log( `Should have removed idle member ${ member.id } but didn't` );
				// this.removeMember( member );
			}
		}
	}
}

Chamber.register();

export interface PoseUpdateHandler
{
	( chamber: ChamberSubscription, newPose: PoseUpdatedArgs ): void;
}

export interface GadgetUpdateHandler
{
	( chamber: ChamberSubscription, member: ChamberMemberInfo, gadget: ChamberGadgetInfo ): void;
}

export interface GadgetListUpdateHandler
{
	( chamber: ChamberSubscription, member: ChamberMemberInfo ): void;
}

export interface ChamberSubscription
{
	readonly chamberPath: string;
	readonly members: ChamberMemberInfo[];
	joinChamber( args: MsgActuallyJoinChamber ): Promise< boolean >;
	leaveChamber( args: MsgActuallyLeaveChamber ): Promise< boolean >;
	updatePose( args: MsgUpdatePose ): void;
	addPoseHandler( fn: PoseUpdateHandler ): void;
	removePoseHandler( fn: PoseUpdateHandler ): void;
	removeAllPoseHandlers(): void;
	addGadget( m: MsgAddGadgetToChambers ): void;
	removeGadget( m: MsgRemoveGadgetFromChambers): void;
	updateGadgetHook( m: MsgUpdateChamberGadgetHook ): void;
	addGadgetUpdateHandler( fn: GadgetUpdateHandler ): void;
	removeGadgetUpdateHandler( fn: GadgetUpdateHandler ): void;
	addGadgetListUpdateHandler( fn: GadgetListUpdateHandler ): void;
	removeGadgetListUpdateHandler( fn: GadgetListUpdateHandler ): void;
}


export class ChamberView extends ACView implements ChamberSubscription
{
	private chamber: Chamber;
	private poseHandlers: PoseUpdateHandler[] = [];
	private gadgetHookUpdateHandlers: GadgetUpdateHandler[] = [];
	private gadgetListUpdateHandlers: GadgetListUpdateHandler[] = [];

	constructor( chamber: Chamber )
	{
		super( chamber );
		this.chamber = chamber;
		this.subscribe( chamber.id, "poseUpdated", this.onPoseUpdated );
		this.subscribe( chamber.id, "gadgetUpdated", this.onGadgetUpdated );
		this.subscribe( chamber.id, "gadgetListUpdated", this.onGadgetListUpdated );
	}

	public get chamberPath(): string
	{
		return this.chamber.path;
	}

	public get members()
	{
		let members: ChamberMemberInfo[] = [];
		for( let member of this.chamber.members )
		{
			members.push( member );
		}
		return members;
	}

	public initChamber( path: string )
	{
		return this.publishAckable( this.chamber.id, "initChamber", path );
	}

	public joinChamber( args: MsgActuallyJoinChamber )
	{
		return this.publishAckable( this.chamber.id, "joinChamber", args );
	}

	public leaveChamber( args: MsgActuallyLeaveChamber )
	{
		return this.publishAckable( this.chamber.id, "leaveChamber", args );
	}

	public updatePose( args: MsgUpdatePose ): void
	{
		this.publish( this.chamber.id, "updatePose", args );
	}

	public addGadget( args: MsgAddGadgetToChambers ): void
	{
		this.publish( this.chamber.id, "addGadget", args );
	}

	public removeGadget( args: MsgRemoveGadgetFromChambers): void
	{
		this.publish( this.chamber.id, "removeGadget", args );
	}
	
	public updateGadgetHook( args: MsgUpdateChamberGadgetHook ): void
	{
		this.publish( this.chamber.id, "updateGadgetHook", args );
	}
	
	public onPoseUpdated( args: PoseUpdatedArgs )
	{
		for( let handler of this.poseHandlers )
		{
			handler( this, args );
		}
	}

	public onGadgetUpdated( args: GadgetUpdatedArgs )
	{
		let chamberMember = this.chamber.findMember( args.userUuid );
		if( !chamberMember )
		{
			console.log( "Received GadgetUpdated for user that the view doesn't know about." );
			return;
		}
		let chamberGadget = chamberMember.findGadget( args.gadgetPersistenceUuid );

		for( let handler of this.gadgetHookUpdateHandlers )
		{
			handler( this, chamberMember, chamberGadget );
		}
	}

	public onGadgetListUpdated( args: GadgetListUpdatedArgs )
	{
		let chamberMember = this.chamber.findMember( args.userUuid );
		for( let handler of this.gadgetListUpdateHandlers )
		{
			handler( this, chamberMember );
		}
	}

	public addPoseHandler( fn: PoseUpdateHandler ): void
	{
		this.poseHandlers.push( fn );
	}

	public removePoseHandler( fn: PoseUpdateHandler ): void
	{
		let handlerIndex = this.poseHandlers.indexOf( fn );
		if( handlerIndex != -1 )
		{
			this.poseHandlers.splice( handlerIndex, 1 );
		}
	}

	public removeAllPoseHandlers(): void
	{
		this.poseHandlers = [];
	}

	public addGadgetListUpdateHandler( fn: GadgetListUpdateHandler ): void
	{
		this.gadgetListUpdateHandlers.push( fn );
	}

	public removeGadgetListUpdateHandler( fn: GadgetListUpdateHandler ) : void
	{
		let handlerIndex = this.gadgetListUpdateHandlers.indexOf( fn );
		if( handlerIndex != -1 )
		{
			this.gadgetListUpdateHandlers.splice( handlerIndex, 1 );
		}
	}

	addGadgetUpdateHandler( fn: GadgetUpdateHandler ): void
	{
		this.gadgetHookUpdateHandlers.push( fn );
	}

	removeGadgetUpdateHandler( fn: GadgetUpdateHandler ): void
	{
		let handlerIndex = this.gadgetHookUpdateHandlers.indexOf( fn );
		if( handlerIndex != -1 )
		{
			this.gadgetHookUpdateHandlers.splice( handlerIndex, 1 );
		}
	}
}


let g_subscriptions: { [ userPath: string ] : CroquetSession< ChamberView >} = {};

export function findChamber( path: string ) : Promise< ChamberSubscription >
{
	return new Promise( async ( resolve, reject ) =>
	{
		if( g_subscriptions[ path ] )
		{
			resolve( g_subscriptions[ path ].view );
			return;
		}
	
		let session = await startSession( path, Chamber, ChamberView );
		await session.view.initChamber( path ); // this is a no-op in all but the first session
		
		g_subscriptions[ path ] = session;
		resolve( session.view );
	});
}

