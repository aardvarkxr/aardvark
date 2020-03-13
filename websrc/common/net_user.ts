import { ACModel, ACView } from './croquet_utils';
import { Model, View, CroquetSession, startSession } from '@croquet/croquet';
import { verifySignature, AuthedRequest } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';

export interface UserModelOptions
{
	uuid: string;
	publicKey: string;
	displayName: string;
}

class UserModel extends ACModel
{

	public uuid: string;
	public publicKey: string;
	public displayName: string;

	public static uuidToPath( uuid: string )
	{
		return "/aardvark/user/" + uuid;
	}

	public init( options: UserModelOptions )
	{
		super.init( options );

		this.uuid = options.uuid;
		this.publicKey = options.publicKey;
		this.displayName = options.displayName;

		this.subscribeAckable( "initOwner", this.onInitOwner );
	}

	public onInitOwner( args: InitOwnerArguments )
	{
		if( !args )
		{
			// somebody wants to know if this user is initialized.
			if( this.uuid || this.displayName || this.publicKey )
			{
				return false; // Yes, but it wasn't us
			}
			else
			{
				return ACModel.deferResult;
			}
			
		}
		if( this.uuid || this.displayName || this.publicKey )
		{
			if( this.uuid != args.userUuid || this.publicKey != args.userPublicKey )
			{
				throw new Error( "uuid and public key are immutable, for now" );
			}

			verifySignature( args, this.publicKey );
			this.displayName = args.userDisplayName;
			return false;
		}
		else
		{
			verifySignature( args, args.userPublicKey );
			this.uuid = args.userUuid;
			this.displayName = args.userDisplayName;
			this.publicKey = args.userPublicKey;
			return true;
		}
	}
}

UserModel.register();

export interface UserSubscription
{
	readonly displayName: string;
	readonly uuid: string;
}

export class UserView extends ACView implements UserSubscription
{
	private userModel: UserModel;

	constructor( userModel: UserModel )
	{
		super( userModel );
		this.userModel = userModel;
	}

	public initOwner( args: InitOwnerArguments ) : Promise< boolean >
	{
		return this.publishAckable( this.userModel.id, "initOwner", args );
	}

	public waitForOwner()
	{
		return this.publishAckable( this.userModel.id, "initOwner", null );
	}

	public get uuid(): string
	{
		return this.userModel.uuid;
	}

	public get displayName(): string
	{
		return this.userModel.displayName;
	}
}

let g_subscriptions: { [ userPath: string ] : CroquetSession< UserView >} = {};

function findUserInternal( uuid: string ) : Promise< UserView >
{
	return new Promise( async ( resolve, reject ) =>
	{
		let path = UserModel.uuidToPath( uuid );
		if( g_subscriptions[ path ] )
		{
			resolve( g_subscriptions[ path ].view );
			return;
		}
	
		let newSession = await startSession( path, UserModel, UserView );
		g_subscriptions[ path ] = newSession;

		resolve( newSession.view );
	});
}

export async function findUser( uuid: string ) : Promise< UserSubscription >
{
	let userView = await findUserInternal( uuid );
	await userView.waitForOwner();
	return userView;
}

interface InitOwnerArguments extends AuthedRequest
{
	userUuid: string;
	userDisplayName: string;
	userPublicKey: string;
}

export async function initLocalUser( args: InitOwnerArguments ) 
{
	let user = await findUserInternal( args.userUuid );
	let weInitialized = await user.initOwner( args );
	return user as UserSubscription;
}

