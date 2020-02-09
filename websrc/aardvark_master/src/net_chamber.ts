import { Model, View } from '@croquet/croquet';
import { mat4 } from '@tlaukkan/tsm';
import { UserModel } from './net_user';


interface ChamberMemberOptions
{
	userUuid: string;
}

interface UpdatePoseArgs
{
	whichPose: string;
	newPose: number[];
	signature?: string;
}


export class ChamberMember extends Model
{
	private user: UserModel;
	private poses: { [path: string ]: number[] } = {};

	public init( options: ChamberMemberOptions )
	{
		this.user = UserModel.findUserModel( options.userUuid );
		this.subscribe( this.id, "updatePose", this.updatePose );
	}

	public updatePose( args: UpdatePoseArgs )
	{
		( this as any ).modelOnly();
		this.user.verifySignature( args );
		this.poses[ args.whichPose ] = args.newPose;
	}
}

export class ChamberMemberView extends View
{
	private member: ChamberMember;

	constructor( member: ChamberMember )
	{
		super( member );
		this.member = member;
	}

	public updatePose( whichPose: string, newPose: mat4 )
	{
		this.member.publish( this.member.id, "updatePose", { whichPose, newPose: newPose.all() } );
	}
}


interface ChamberOptions
{
	path: string;
}

interface JoinChamberArgs
{
	userUuid: string;
	signature?: string;
}
export class Chamber extends Model
{
	private path: string;
	private users: ChamberMember[] = [];

	public init( options: ChamberOptions )
	{
		this.path = options.path;
		( this as any ).beWellKnownAs( this.path );

		this.subscribe( this.id, "joinChamber", this.joinChamber );
	}

	public joinChamber( args: JoinChamberArgs )
	{
		( this as any ).modelOnly();
		UserModel.verifyUserSignature( args, args.userUuid );

		this.users.push( Model.create( { userUuid: args.userUuid } ) as ChamberMember );
		this.publish( this.id, "member_joined", args.userUuid );
	}
}

export class ChamberView extends View
{
	private chamber: Chamber;

	constructor( path: string )
	{
		let chamber = ( Model as any ).wellKnownModel( path ) as Chamber;
		super( chamber );
		this.chamber = chamber;
	}
}

