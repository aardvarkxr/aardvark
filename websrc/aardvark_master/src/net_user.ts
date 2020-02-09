import { Model, View } from '@croquet/croquet';
import { mat4 } from '@tlaukkan/tsm';
import { verifySignature } from '@aardvarkxr/aardvark-shared';

export interface UserModelOptions
{
	uuid: string;
	publicKey: string;
	displayName: string;
}

export class UserModel extends Model
{

	private uuid: string;
	private publicKey: string;
	private displayName: string;

	public static uuidToPath( uuid: string )
	{
		return "/aardvark/user/" + uuid;
	}

	public init( options: UserModelOptions )
	{
		this.uuid = options.uuid;
		( this as any ).beWellKnownAs( UserModel.uuidToPath( this.uuid ) );
		this.publicKey = options.publicKey;
		this.displayName = options.displayName;
	}

	public static findUserModel( userUuid: string ): UserModel
	{
		return ( Model as any).wellKnownModel( UserModel.uuidToPath( userUuid ) ) as UserModel;
	}

	public static verifyUserSignature( args: any, userUuid: string )
	{
		let userModel = UserModel.findUserModel( userUuid );
		if( !userModel )
		{
			throw new Error( "Unknown user " + userUuid );
		}

		verifySignature( args, userModel.publicKey );
	}

	public verifySignature( args: any )
	{
		verifySignature( args, this.publicKey );
	}
}

UserModel.register();

export class UserView extends View
{
	private userModel: UserModel;

	constructor( userUuid: string )
	{
		let userModel = ( Model as any).wellKnownModel( UserModel.uuidToPath( userUuid ) ) as UserModel;
		super( userModel );
		this.userModel = userModel;
	}

}

