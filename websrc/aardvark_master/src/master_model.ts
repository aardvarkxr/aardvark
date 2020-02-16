import { AvGadget } from '@aardvarkxr/aardvark-react';
import bind from 'bind-decorator';
import { initLocalUser } from 'common/net_user';


export class CMasterModel
{
	constructor()
	{
		AvGadget.instance().addUserInfoListener( this.onUserInfo );
	}

	@bind
	private async onUserInfo()
	{
		console.log( `Trying to init local user ${ AvGadget.instance().localUserInfo.userUuid }` );
		initLocalUser( AvGadget.instance().localUserInfo );
	}
}


