import { AvGadget } from '@aardvarkxr/aardvark-react';
import bind from 'bind-decorator';
import { initLocalUser } from 'common/net_user';
import { MessageType, MsgActuallyJoinChamber, MsgActuallyLeaveChamber, MsgUpdatePose, MsgAddGadgetToChambers, MsgRemoveGadgetFromChambers, MsgUpdateChamberGadgetHook } from '@aardvarkxr/aardvark-shared';
import { findChamber, ChamberSubscription } from 'common/net_chamber';


export class CMasterModel
{
	private chambers: ChamberSubscription[] = [];
	constructor()
	{
		AvGadget.instance().addUserInfoListener( this.onUserInfo );
		AvGadget.instance().registerMessageHandler( MessageType.ActuallyJoinChamber, this.onActuallyJoinChamber );
		AvGadget.instance().registerMessageHandler( MessageType.ActuallyLeaveChamber, this.onActuallyLeaveChamber );
		AvGadget.instance().registerMessageHandler( MessageType.UpdatePose, this.onUpdatePose );
		AvGadget.instance().registerMessageHandler( MessageType.AddGadgetToChambers, this.onAddGadgetToChambers );
		AvGadget.instance().registerMessageHandler( MessageType.RemoveGadgetFromChambers, 
			this.onRemoveGadgetFromChambers );
		AvGadget.instance().registerMessageHandler( MessageType.UpdateChamberGadgetHook, 
			this.onUpdateChamberGadgetHook );

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
		if( chamber.joinChamber( m ) )
		{
			this.chambers.push( chamber );
		}
	}

	@bind
	private async onActuallyLeaveChamber( m: MsgActuallyLeaveChamber )
	{
		let chamber = await findChamber( m.chamberPath );
		chamber.leaveChamber( m );
	}

	@bind
	private async onUpdatePose( m: MsgUpdatePose )
	{
		for( let chamber of this.chambers )
		{
			chamber.updatePose( m );
		}
	}

	@bind
	private onAddGadgetToChambers( m: MsgAddGadgetToChambers )
	{
		for( let chamber of this.chambers )
		{
			chamber.addGadget( m );
		}
	}

	@bind
	private onRemoveGadgetFromChambers( m: MsgRemoveGadgetFromChambers)
	{
		for( let chamber of this.chambers )
		{
			chamber.removeGadget( m );
		}
	}

	@bind
	private onUpdateChamberGadgetHook( m: MsgUpdateChamberGadgetHook )
	{
		for( let chamber of this.chambers )
		{
			chamber.updateGadgetHook( m );
		}
	}
}


