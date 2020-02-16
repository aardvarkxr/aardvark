import { Model, View, CroquetSession, startSession } from '@croquet/croquet';
import { AuthedRequest, verifySignature, MsgUpdatePose, MsgActuallyJoinChamber, 
	MsgActuallyLeaveChamber } from '@aardvarkxr/aardvark-shared';


interface ChamberMemberOptions
{
	userUuid: string;
	userPublicKey: string;
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


interface ChamberOptions
{
	path: string;
}


export class Chamber extends Model
{
	public path: string;
	private members: ChamberMember[] = [];

	public init( options: ChamberOptions )
	{
		this.path = options.path;

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

	private verifyChamber( chamberPath: string ) 
	{
		if ( chamberPath != this.path ) 
		{
			throw new Error( "request to join chamber " + this.path
				+ " came from the wrong chamber " + chamberPath );
		}
	}


	public joinChamber( args: MsgActuallyJoinChamber )
	{
		//( this as any ).modelOnly();
		verifySignature( args, args.userPublicKey );
		this.verifyChamber( args.chamberPath );

		let userOptions: ChamberMemberOptions =
		{
			userUuid: args.userUuid,
			userPublicKey: args.userPublicKey,
		};

		this.members.push( Model.create( userOptions ) as ChamberMember );
		this.publish( this.id, "member_joined", args.userUuid );
	}

	public leaveChamber( args: MsgActuallyLeaveChamber )
	{
		let member = this.findAndAuthMember( args.userUuid, args);
		this.verifyChamber( args.chamberPath );

		let index = this.members.indexOf( member );
		delete this.members[ index ];
		member.destroy();
	}

	public updatePose( args: MsgUpdatePose )
	{
		let member = this.findAndAuthMember( args.userUuid, args );
		this.verifyChamber( args.chamberPath );
		member.updatePose( args );
	}
}

export interface ChamberSubscription
{
	readonly chamberPath: string;
	joinChamber( args: MsgActuallyJoinChamber ): void;
	leaveChamber( args: MsgActuallyLeaveChamber ): void;
	updatePose( args: MsgUpdatePose ): void;
}


export class ChamberView extends View implements ChamberSubscription
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

	public joinChamber( args: MsgActuallyJoinChamber ): void
	{
		this.publish( this.chamber.id, "joinChamber", args );
	}

	public leaveChamber( args: MsgActuallyLeaveChamber ): void
	{
		this.publish( this.chamber.id, "leaveChamber", args );
	}

	public updatePose( args: MsgUpdatePose ): void
	{
		this.publish( this.chamber.id, "updatePose", args );
	}
}


let g_subscriptions: { [ userPath: string ] : CroquetSession< ChamberView >} = {};

export function findChamber( path: string ) : Promise< ChamberView >
{
	return new Promise( async ( resolve, reject ) =>
	{
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

