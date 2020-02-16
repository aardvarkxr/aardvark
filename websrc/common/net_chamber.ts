import { Model, View, CroquetSession, startSession } from '@croquet/croquet';
import { AuthedRequest, verifySignature } from '@aardvarkxr/aardvark-shared';


interface ChamberMemberOptions
{
	userUuid: string;
	userPublicKey: string;
}

interface UpdatePoseArgs extends AuthedRequest
{
	userUuid: string;
	whichPose: string;
	newPose: number[];
}


export class ChamberMember extends Model
{
	private userUuid: string;
	private userPublicKey: string;
	private poses: { [path: string ]: number[] } = {};

	public init( options: ChamberMemberOptions )
	{
		this.userUuid = options.userUuid;
		this.userPublicKey = options.userPublicKey;
		this.subscribe( this.id, "updatePose", this.updatePose );
	}

	public updatePose( args: UpdatePoseArgs )
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


interface ChamberOptions
{
	uuid: string;
}

interface JoinChamberArgs extends AuthedRequest
{
	userUuid: string;
	userPublicKey: string;
}

interface LeaveChamberArgs extends AuthedRequest
{
	userUuid: string;
}



export class Chamber extends Model
{
	public uuid: string;
	private members: ChamberMember[] = [];

	public init( options: ChamberOptions )
	{
		this.uuid = options.uuid;

		this.subscribe( this.id, "joinChamber", this.joinChamber );
		this.subscribe( this.id, "leaveChamber", this.leaveChamber );
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


	public joinChamber( args: JoinChamberArgs )
	{
		//( this as any ).modelOnly();
		verifySignature( args, args.userPublicKey );

		let userOptions: ChamberMemberOptions =
		{
			userUuid: args.userUuid,
			userPublicKey: args.userPublicKey,
		};

		this.members.push( Model.create( userOptions ) as ChamberMember );
		this.publish( this.id, "member_joined", args.userUuid );
	}

	public leaveChamber( args: LeaveChamberArgs )
	{
		let member = this.findAndAuthMember( args.userUuid, args );
		let index = this.members.indexOf( member );
		delete this.members[ index ];
		member.destroy();
	}

	public updatePose( args: UpdatePoseArgs )
	{
		let member = this.findAndAuthMember( args.userUuid, args );

		member.updatePose( args );
	}
}

export interface ChamberSubscription
{
	readonly chamberUuid: string;
	joinChamber( args: JoinChamberArgs ): void;
	leaveChamber( args: LeaveChamberArgs ): void;
	updatePose( args: UpdatePoseArgs ): void;
}


export class ChamberView extends View implements ChamberSubscription
{
	private chamber: Chamber;

	constructor( chamber: Chamber )
	{
		super( chamber );
		this.chamber = chamber;
	}

	public get chamberUuid(): string
	{
		return this.chamber.uuid;
	}

	public joinChamber( args: JoinChamberArgs ): void
	{
		this.publish( this.chamber.id, "joinChamber", args );
	}

	public leaveChamber( args: LeaveChamberArgs ): void
	{
		this.publish( this.chamber.id, "leaveChamber", args );
	}

	public updatePose( args: UpdatePoseArgs ): void
	{
		this.publish( this.chamber.id, "updatePose", args );
	}
}


let g_subscriptions: { [ userPath: string ] : CroquetSession< ChamberView >} = {};

export function findChamber( uuid: string ) : Promise< ChamberView >
{
	return new Promise( async ( resolve, reject ) =>
	{
		let path = Chamber.uuidToPath( uuid );
		if( g_subscriptions[ path ] )
		{
			resolve( g_subscriptions[ path ].view );
			return;
		}
	
		let session = await startSession( path, Chamber, ChamberView );

		g_subscriptions[ path ] = session;
		resolve( session.view );
	});
}

