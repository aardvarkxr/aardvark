import { AvGadget } from '@aardvarkxr/aardvark-react';
import bind from 'bind-decorator';
import { initLocalUser } from 'common/net_user';
import { MessageType, MsgActuallyJoinChamber, MsgActuallyLeaveChamber, MsgUpdatePose, MsgAddGadgetToChambers, MsgRemoveGadgetFromChambers, MsgUpdateChamberGadgetHook, AvStartGadgetResult, MsgDestroyGadget, MsgChamberGadgetHookUpdated, MsgChamberMemberListUpdated } from '@aardvarkxr/aardvark-shared';
import { findChamber, ChamberSubscription, ChamberMemberInfo, ChamberGadgetInfo } from 'common/net_chamber';
import { parsePersistentHookPath, buildPersistentHookPath, buildPersistentHookPathFromParts } from 'common/hook_utils';


interface GadgetTracker
{
	gadget: ChamberGadgetInfo;
	endpointId: number;
}

interface MemberTracker
{
	member: ChamberMemberInfo;
	remoteUniversePath: string;
	gadgets: { [ persistenceUuid: string ] : GadgetTracker };
}

interface ChamberTracker
{
	chamber: ChamberSubscription;
	members: { [ uuid: string ] : MemberTracker };
}

function computeRemotePersistenceUuid( gadgetPersistenceUuid: string, remoteUniversePath: string )
{
	let newGadgetPersistenceUuid = remoteUniversePath + "/g/" + gadgetPersistenceUuid;
	return newGadgetPersistenceUuid.replace( /\W/g, "_" ).toLowerCase();
}

export class CMasterModel
{
	private chambers: { [ chamberPath: string ]: ChamberTracker } = {};
	private chamberListener: () => void;

	constructor( listener: () => void )
	{
		console.log( "Starting master model" );
		this.chamberListener = listener;

		AvGadget.instance().addUserInfoListener( this.onUserInfo );
		AvGadget.instance().registerAsyncMessageHandler( MessageType.ActuallyJoinChamber, this.onActuallyJoinChamber );
		AvGadget.instance().registerAsyncMessageHandler( MessageType.ActuallyLeaveChamber, this.onActuallyLeaveChamber );
		AvGadget.instance().registerAsyncMessageHandler( MessageType.UpdatePose, this.onUpdatePose );
		AvGadget.instance().registerMessageHandler( MessageType.AddGadgetToChambers, this.onAddGadgetToChambers );
		AvGadget.instance().registerMessageHandler( MessageType.RemoveGadgetFromChambers, 
			this.onRemoveGadgetFromChambers );
		AvGadget.instance().registerMessageHandler( MessageType.UpdateChamberGadgetHook, 
			this.onUpdateChamberGadgetHook );
	}

	public get activeChambers()
	{
		let chambers: ChamberSubscription[] = [];
		for( let chamberPath in this.chambers )
		{
			let chamber = this.chambers[ chamberPath ];
			chambers.push( chamber.chamber );
		}
		return chambers;
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
		console.log( `onActuallyJoinChamber with ${ m.gadgets?.length } gadgets`)
		let chamber = await findChamber( m.chamberPath );
		if( await chamber.joinChamber( m ) )
		{
			this.addChamber( chamber );
			this.chamberListener?.();
		}
	}

	@bind
	private async onActuallyLeaveChamber( m: MsgActuallyLeaveChamber )
	{
		let chamber = await findChamber( m.chamberPath );
		await chamber.leaveChamber( m );
		this.removeChamber( chamber );
		this.chamberListener?.();
	}

	@bind
	private async onUpdatePose( m: MsgUpdatePose )
	{
		for( let chamberPath in this.chambers )
		{
			this.chambers[ chamberPath ].chamber.updatePose( m );
		}
	}

	@bind
	private onAddGadgetToChambers( m: MsgAddGadgetToChambers )
	{
		console.log( `onAddGadgetToChambers for ${ m.gadget.persistenceUuid } in ${ Object.keys( this.chambers ).length }` );
		for( let chamberPath in this.chambers )
		{
			this.chambers[ chamberPath ].chamber.addGadget( m );
		}
	}

	@bind
	private onRemoveGadgetFromChambers( m: MsgRemoveGadgetFromChambers)
	{
		for( let chamberPath in this.chambers )
		{
			this.chambers[ chamberPath ].chamber.removeGadget( m );
		}
	}

	@bind
	private onUpdateChamberGadgetHook( m: MsgUpdateChamberGadgetHook )
	{
		for( let chamberPath in this.chambers )
		{
			this.chambers[ chamberPath ].chamber.updateGadgetHook( m );
		}
	}

	@bind 
	private onGadgetListUpdated( chamberSub: ChamberSubscription, memberInfo: ChamberMemberInfo )
	{
		console.log( "onGadgetListUpdated" );
		let chamberTracker = this.chambers[ chamberSub.chamberPath ];
		let memberTracker = chamberTracker?.members[ memberInfo.uuid ];
		if( !chamberTracker || !memberTracker )
			return;

		let gadgetsToRemove = Object.keys( memberTracker.gadgets );
		for( let gadgetInfo of memberInfo.gadgets )
		{
			let gadgetIndex = gadgetsToRemove.indexOf( gadgetInfo.persistenceUuid );
			if( -1 != gadgetIndex )
			{
				// we found one in our existing list.
				gadgetsToRemove.splice( gadgetIndex, 1 );
			}
			else
			{
				this.addChamberMemberGadget( chamberSub, memberInfo, gadgetInfo );
			}
		}

		for( let gadgetPersistenceUuid of gadgetsToRemove )
		{
			this.removeChamberMemberGadget( chamberSub, memberInfo, gadgetPersistenceUuid );
		}
	}

	private addChamber( chamberSub: ChamberSubscription )
	{
		this.chambers[ chamberSub.chamberPath ] =
		{
			chamber: chamberSub,
			members: {},
		};

		chamberSub.addGadgetListUpdateHandler( this.onGadgetListUpdated );
		chamberSub.addGadgetUpdateHandler( this.onGadgetUpdate );
		chamberSub.addChamberMemberListUpdateHandler( this.onChamberMemberListUpdate );

		for( let memberInfo of chamberSub.members )
		{
			this.addChamberMember( chamberSub, memberInfo );
		}

		this.onChamberMemberListUpdate( chamberSub );
	}

	private addChamberMember( chamberSub: ChamberSubscription, memberInfo: ChamberMemberInfo )
	{
		let chamber = this.chambers[ chamberSub.chamberPath ];
		if( !chamber )
			return;

		if( chamber.members[ memberInfo.uuid ] )
			return;

		chamber.members[ memberInfo.uuid ] =
		{
			member: memberInfo,
			remoteUniversePath: chamberSub.chamberPath + "/" + memberInfo.uuid,
			gadgets: {},
		};

		for( let gadgetInfo of memberInfo.gadgets )
		{
			this.addChamberMemberGadget( chamberSub, memberInfo, gadgetInfo );
		}
	}

	private addChamberMemberGadget( chamberSub: ChamberSubscription, memberInfo: ChamberMemberInfo,
		gadgetInfo: ChamberGadgetInfo )
	{
		let memberTracker = this.chambers[ chamberSub.chamberPath ]?.members[ memberInfo.uuid ];
		if( !memberTracker )
		{
			return;
		}

		let gadgetTracker = memberTracker.gadgets[ gadgetInfo.persistenceUuid ];
		if( gadgetTracker )
		{
			// don't add a gadget twice
			return;
		}

		// remember we tried to start the gadget
		gadgetTracker =
		{
			gadget: gadgetInfo,
			endpointId: 0,
		};
		memberTracker.gadgets[ gadgetInfo.persistenceUuid ] = gadgetTracker;

		// most chambers don't show the local user
		if( memberTracker.member.uuid == AvGadget.instance().localUserInfo.userUuid 
			&& !memberTracker.member.showSelf )
		{
			return;
		}

		// make a unique ID for the new gadget namespaced by the remote universe
		let newGadgetPersistenceUuid = computeRemotePersistenceUuid( gadgetInfo.persistenceUuid, 
			memberTracker.remoteUniversePath );

		// parse the hook path lookig for gadget UUIDs to fix up
		let hookToUse = gadgetInfo.hook;
		let hookParts = parsePersistentHookPath( gadgetInfo.hook );
		if( hookParts && hookParts.gadgetUuid )
		{
			hookParts.gadgetUuid = computeRemotePersistenceUuid( hookParts.gadgetUuid, 
				memberTracker.remoteUniversePath );
			hookToUse = buildPersistentHookPathFromParts( hookParts );
		}

		console.log( `master starting gadget ${ newGadgetPersistenceUuid } on ${ hookToUse } `
			+ `via ${ gadgetInfo.gadgetUri }` );
		AvGadget.instance().startGadget( gadgetInfo.gadgetUri, hookToUse, 
			memberTracker.remoteUniversePath, newGadgetPersistenceUuid )
		.then( ( res: AvStartGadgetResult ) =>
		{
			if( res.success )
			{
				gadgetTracker.endpointId = res.startedGadgetEndpointId;
			}
		})
	}

	private removeChamber( chamberSub: ChamberSubscription )
	{
		console.log( "removeChamber "+ chamberSub.chamberPath );
		let chamberTracker = this.chambers[ chamberSub.chamberPath ];
		if( !chamberTracker )
			return;

		chamberSub.removeGadgetUpdateHandler( this.onGadgetUpdate );
		chamberSub.removeChamberMemberListUpdateHandler( this.onChamberMemberListUpdate );
		chamberSub.removeGadgetListUpdateHandler( this.onGadgetListUpdated );

		for( let memberUuid in chamberTracker.members )
		{
			this.removeChamberMember( chamberSub, chamberTracker.members[ memberUuid ].member );
		}

		delete this.chambers[ chamberSub.chamberPath ];
	}

	private removeChamberMember( chamberSub: ChamberSubscription, memberInfo: ChamberMemberInfo )
	{
		console.log( "removeChamberMember "+ chamberSub.chamberPath + " " + memberInfo.uuid);
		let chamberTracker = this.chambers[ chamberSub.chamberPath ];
		if( !chamberTracker )
			return;

		let memberTracker = chamberTracker.members[ memberInfo.uuid ];
		if( !memberTracker )
			return;

		for( let gadgetPersistenceUuid in memberTracker.gadgets )
		{
			this.removeChamberMemberGadget( chamberSub, memberInfo, 
				memberTracker.gadgets[ gadgetPersistenceUuid ].gadget.persistenceUuid );
		}
	
		delete chamberTracker.members[ memberInfo.uuid ];
	}

	private removeChamberMemberGadget( chamberSub: ChamberSubscription, memberInfo: ChamberMemberInfo,
		gadgetPersistenceUuid: string )
	{
		console.log( "removeChamberMemberGadget " + chamberSub.chamberPath + " member: " + memberInfo.uuid
			+ " gadget: " + gadgetPersistenceUuid );
		let memberTracker = this.chambers[ chamberSub.chamberPath ]?.members[ memberInfo.uuid ];
		if( !memberTracker )
		{
			return;
		}

		let gadgetTracker = memberTracker.gadgets[ gadgetPersistenceUuid ];
		if( !gadgetTracker )
		{
			// don't remove a gadget twice
			return;
		}

		let msg: MsgDestroyGadget =
		{
			gadgetId: gadgetTracker.endpointId,
		}

		AvGadget.instance().sendMessage( MessageType.DestroyGadget, msg );
		delete memberTracker.gadgets[ gadgetPersistenceUuid ];
	}

	@bind
	onGadgetUpdate( chamber: ChamberSubscription, member: ChamberMemberInfo, gadget: ChamberGadgetInfo )
	{
		let memberTracker = this.chambers[ chamber.chamberPath ]?.members[ member.uuid ];
		if( !memberTracker )
		{
			return;
		}

		let gadgetTracker = memberTracker.gadgets[ gadget.persistenceUuid ];
		if( gadgetTracker && gadgetTracker.endpointId )
		{
			// parse the hook path lookig for gadget UUIDs to fix up
			let hookToUse = gadget.hook;
			let hookParts = parsePersistentHookPath( gadget.hook );
			if( hookParts && hookParts.gadgetUuid )
			{
				hookParts.gadgetUuid = computeRemotePersistenceUuid( hookParts.gadgetUuid, 
					memberTracker.remoteUniversePath );
				hookToUse = buildPersistentHookPathFromParts( hookParts );
			}
			
			let msg: MsgChamberGadgetHookUpdated =
			{
				gadgetId: gadgetTracker.endpointId,
				newHook: hookToUse,
			}

			AvGadget.instance().sendMessage( MessageType.ChamberGadgetHookUpdated, msg );
		}

	}

	@bind
	onChamberMemberListUpdate( chamber: ChamberSubscription )
	{
		console.log( "onChamberMemberListUpdate" );
		let msg: MsgChamberMemberListUpdated =
		{
			chamberPath: chamber.chamberPath,
			members: chamber.members.map( mem => mem.uuid ),
		};

		AvGadget.instance().sendMessage( MessageType.ChamberMemberListUpdated, msg );
	}
}

