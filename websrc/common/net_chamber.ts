import { CroquetSession, startSession } from '@croquet/croquet';
import { AuthedRequest, verifySignature, MsgUpdatePose, MsgActuallyJoinChamber, 
	MsgActuallyLeaveChamber, 
	MinimalPose,
	SharedGadget} from '@aardvarkxr/aardvark-shared';
import { ACModel, ACView } from './croquet_utils';


interface ChamberGadgetOptions extends SharedGadget
{
	chamberModelId: string;
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
	private chamberModelId: string;

	public init( options: ChamberGadgetOptions )
	{
		super.init( options );
		this.chamberModelId = options.chamberModelId;
		this.m_persistenceUuid = options.persistenceUuid;
		this.m_gadgetUri = options.gadgetUri;
		this.m_hook = options.hook;

		// TODO: Moving gadgets around from their initial hook
		// this.subscribe( this.id, "updatePose", this.updatePose );
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
};

export interface PoseUpdatedArgs
{
	userUuid: string;
	originPath: string;
	pose: MinimalPose;
}

class ChamberMember extends ACModel implements ChamberMemberInfo
{
	private chamberModelId: string;
	private userUuid: string;
	private userPublicKey: string;
	private poses: { [path: string ]: MinimalPose } = {};
	private m_gadgets: { [ persistenceUuid: string ]: ChamberGadget } = {};

	public init( options: ChamberMemberOptions )
	{
		super.init( options );
		this.chamberModelId = options.chamberModelId;
		this.userUuid = options.userUuid;
		this.userPublicKey = options.userPublicKey;
		this.subscribe( this.id, "updatePose", this.updatePose );

		if( options.gadgets )
		{
			for( let sharedGadget of options.gadgets )
			{
				let gadgetOptions: ChamberGadgetOptions =
				{
					...sharedGadget,
					chamberModelId: options.chamberModelId,
				};

				this.m_gadgets[ gadgetOptions.persistenceUuid ] = ChamberGadget.createT( gadgetOptions );
			}
		}
	}

	public updatePose( args: MsgUpdatePose )
	{
		//( this as any ).modelOnly();
		verifySignature( args, this.userPublicKey );
		this.poses[ args.originPath ] = args.newPose;

		let outboundPose: PoseUpdatedArgs =
		{
			userUuid: this.userUuid,
			originPath: args.originPath,
			pose: args.newPose,
		}

		this.publish( this.chamberModelId, "poseUpdated", outboundPose );
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
	}

	public static uuidToPath( uuid: string )
	{
		return "/aardvark/chamber/" + uuid;
	}

	private findMember( userUuid: string )
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

		if( this.findMember( args.userUuid ) )
		{
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
		return true;
	}

	public leaveChamber( args: MsgActuallyLeaveChamber )
	{
		let member = this.findAndAuthMember( args.userUuid, args);
		this.verifyChamber( args.chamberPath );

		let index = this.members.indexOf( member );
		delete this.members[ index ];
		member.destroy();
		return true;
	}

	public updatePose( args: MsgUpdatePose )
	{
		let member = this.findAndAuthMember( args.userUuid, args );
		member.updatePose( args );
	}
}

Chamber.register();

export interface PoseUpdateHandler
{
	( chamber: ChamberSubscription, newPose: PoseUpdatedArgs ): void;
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
}


export class ChamberView extends ACView implements ChamberSubscription
{
	private chamber: Chamber;
	private poseHandlers: PoseUpdateHandler[] = [];

	constructor( chamber: Chamber )
	{
		super( chamber );
		this.chamber = chamber;
		this.subscribe( chamber.id, "poseUpdated", this.onPoseUpdated );
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

	public onPoseUpdated( args: PoseUpdatedArgs )
	{
		for( let handler of this.poseHandlers )
		{
			handler( this, args );
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

