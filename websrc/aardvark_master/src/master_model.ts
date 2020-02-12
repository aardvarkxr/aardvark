import { AvGadget } from '@aardvarkxr/aardvark-react';
import { UserView, UserModelOptions, UserModel } from './net_user';
import * as Croquet from '@croquet/croquet'
import bind from 'bind-decorator';

class MasterModel extends Croquet.Model
{
	public localUser: UserModel;
	init( )
	{
		let userOptions: UserModelOptions =
		{
			uuid: AvGadget.instance().localUserUuid,
			displayName: AvGadget.instance().localUserDisplayName,
			publicKey: AvGadget.instance().localUserPublicKey,
		}
		this.localUser = UserModel.create( userOptions ) as UserModel;
	}
}


MasterModel.register();

class MasterView extends Croquet.View
{
	public masterModel: MasterModel;
	constructor( model: MasterModel )
	{
		super( model );
		this.masterModel = model;
	}
}

export class CMasterModel
{
	private userView: UserView = null;

	constructor()
	{
		AvGadget.instance().addUserInfoListener( this.onUserInfo );
	}

	@bind
	private onUserInfo()
	{
		Croquet.startSession( "aardvark", MasterModel, MasterView )
	}
}


