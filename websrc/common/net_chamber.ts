import { Model, View, CroquetSession, startSession } from '@croquet/croquet';
import { AuthedRequest, verifySignature, MsgUpdatePose, MsgActuallyJoinChamber, 
	MsgActuallyLeaveChamber } from '@aardvarkxr/aardvark-shared';
import { ACModel, ACView } from './croquet_utils';

interface ChamberMemberOptions
{
	userUuid: string;
	userPublicKey: string;
}

export interface ChamberMemberInfo
{
	readonly uuid: string;
};

class ChamberMember extends ACModel implements ChamberMemberInfo
{
	private userUuid: string;
	private userPublicKey: string;
	private poses: { [path: string ]: number[] } = {};

	public init( options: ChamberMemberOptions )
	{
		super.init( options );
		this.userUuid = options.userUuid;
		this.userPublicKey = options.userPublicKey;
		this.subscribe( this.id, "updatePose", this.updatePose );
	}

	public updatePose( args: MsgUpdatePose )
	{
		//( this as any ).modelOnly();
		verifySignature( args, this.userPublicKey );
		this.poses[ args.whichPose ] = args.newPose;
	}

	public get uuid() : string
	{
		return this.userUuid;
	}

	public get publicKey() : string
	{
		return this.userPublicKey;
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
			return false;
		}
		
		let userOptions: ChamberMemberOptions =
		{
			userUuid: args.userUuid,
			userPublicKey: args.userPublicKey,
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
		this.verifyChamber( args.chamberPath );
		member.updatePose( args );
	}
}

Chamber.register();

export interface ChamberSubscription
{
	readonly chamberPath: string;
	readonly members: ChamberMemberInfo[];
	joinChamber( args: MsgActuallyJoinChamber ): Promise< boolean >;
	leaveChamber( args: MsgActuallyLeaveChamber ): Promise< boolean >;
	updatePose( args: MsgUpdatePose ): void;
}


export class ChamberView extends ACView implements ChamberSubscription
{
	private chamber: Chamber;

	constructor( chamber: Chamber )
	{
		super( chamber );
		this.chamber = chamber;
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
			members.push( 
				{
					uuid: member.uuid
				} );
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

