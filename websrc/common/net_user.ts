import { Model, View, CroquetSession, startSession } from '@croquet/croquet';
import { verifySignature, AuthedRequest } from '@aardvarkxr/aardvark-shared';

export interface UserModelOptions
{
	uuid: string;
	publicKey: string;
	displayName: string;
}

class UserModel extends Model
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
		this.uuid = options.uuid;
		this.publicKey = options.publicKey;
		this.displayName = options.displayName;

		this.subscribe( this.id, "initOwner", this.onInitOwner );
	}

	public onInitOwner( args: InitOwnerArguments )
	{
		//( Model as any ).modelOnly();

		if( this.uuid || this.displayName || this.publicKey )
		{
			if( this.uuid != args.userUuid || this.publicKey != args.userPublicKey )
			{
				throw new Error( "uuid and public key are immutable, for now" );
			}

			verifySignature( args, this.publicKey );
			this.displayName = args.userDisplayName;
		}
		else
		{
			verifySignature( args, args.userPublicKey );
			this.uuid = args.userUuid;
			this.displayName = args.userDisplayName;
			this.publicKey = args.userPublicKey;
		}

		this.publish( this.id, "ownerInitialized", {} );
	}
}

UserModel.register();

export interface UserSubscription
{
	readonly displayName: string;
	readonly uuid: string;
}

export class UserView extends View implements UserSubscription
{
	private userModel: UserModel;
	private initListener: () => void = null;

	constructor( userModel: UserModel )
	{
		super( userModel );
		this.userModel = userModel;
		this.subscribe( this.userModel.id, "ownerInitialized", this.onOwnerInitialized );
	}

	public async initOwner( args: InitOwnerArguments )
	{
		return new Promise( ( resolve, reject ) =>
		{
			this.initListener = resolve;
			this.publish( this.userModel.id, "initOwner", args );
		} );
	}

	public async waitForOwner()
	{
		return new Promise( ( resolve, reject ) =>
		{
			if( this.userModel.uuid )
			{
				resolve();
			}
			else
			{
				this.initListener = resolve;
			}
		} );
	}

	public onOwnerInitialized()
	{
		if( this.initListener )
		{
			this.initListener();
			this.initListener = null;
		}
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
	return user.initOwner( args );
}

