import { AvGadget } from '@aardvarkxr/aardvark-react';
import bind from 'bind-decorator';
import { initLocalUser } from 'common/net_user';
import { MessageType, MsgActuallyJoinChamber, MsgActuallyLeaveChamber } from '@aardvarkxr/aardvark-shared';
import { findChamber } from 'common/net_chamber';


export class CMasterModel
{
	constructor()
	{
		AvGadget.instance().addUserInfoListener( this.onUserInfo );
		AvGadget.instance().registerMessageHandler( MessageType.ActuallyJoinChamber, this.onActuallyJoinChamber );
		AvGadget.instance().registerMessageHandler( MessageType.ActuallyLeaveChamber, this.onActuallyLeaveChamber );
	}

	@bind
	private async onUserInfo()
	{
		console.log( `Trying to init local user ${ AvGadget.instance().localUserInfo.userUuid }` );
		initLocalUser( AvGadget.instance().localUserInfo );
	}

	@bind
	private async onActuallyJoinChamber( m: MsgActuallyJoinChamber )
	{
		let chamber = await findChamber( m.chamberPath );
		chamber.joinChamber( m );
	}

	@bind
	private async onActuallyLeaveChamber( m: MsgActuallyLeaveChamber )
	{
		let chamber = await findChamber( m.chamberPath );
		chamber.leaveChamber( m );
	}
}


