import { AardvarkState, StoredGadget, readPersistentState, AvGadgetManifest, AvNodeTransform, LocalUserInfo, signRequest, AuthedRequest } from '@aardvarkxr/aardvark-shared';
import { v4 as uuid } from 'uuid';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { getJSONFromUri } from './serverutils';
import { buildPersistentHookPath } from 'common/hook_utils';
import bind from 'bind-decorator';


class CPersistenceManager
{
	private m_state: AardvarkState;
	private m_writeTimer: NodeJS.Timeout = null;
	private m_pendingFileReload: NodeJS.Timeout = null;
	private m_lastWriteTime: number = 0;
	private m_localUserInfo: LocalUserInfo = null;
	private m_privateKey: string = null;

	constructor()
	{
	}

	public async init()
	{
		if( !fs.existsSync( this.path ) )
		{
			fs.mkdirSync( this.path );
		}

		this.readNow();

		try 
		{
			fs.watch( this.statePath, this.onStateFileChanged );
		}
		catch( e )
		{
			// if we couldn't watch it's probably because the file didn't exist. Make it exist
			this.writeNow();
			fs.watch( this.statePath, this.onStateFileChanged );
		}
	}

	public get path(): string
	{
		return path.join( os.homedir(), "aardvark" );
	}

	public get statePath(): string
	{
		return path.join( this.path, "state.json" );
	}

	@bind private onStateFileChanged( event: string, filename: string )
	{
		let timeSinceLastWrite = Date.now() - this.m_lastWriteTime;
		if( !this.m_pendingFileReload && timeSinceLastWrite > 1000 )
		{
			this.m_pendingFileReload = global.setTimeout( ()=>
			{
				this.m_pendingFileReload = null;
				this.reload();
			}, 500 );
		}
	}

	public reload()
	{
		console.log( "Reloading because of external state.json change" );
		this.readNow();
	}

	public createGadgetPersistence( gadgetUri: string ): string
	{
		let id = uuid();
		this.m_state.activeGadgets[ id ] = { uri: gadgetUri };
		this.markDirty();
		return id;
	}

	public destroyGadgetPersistence( gadgetUri: string, uuid: string )
	{
		if( this.m_state.activeGadgets[ uuid ] )
		{
			let stateUri = new URL( this.m_state.activeGadgets[uuid].uri );
			let fixedGadgetUri = new URL( gadgetUri );
			//if( stateUri.toString() == fixedGadgetUri.toString() )
			{
				delete this.m_state.activeGadgets[uuid];
				this.markDirty();
			}
			// else
			// {
			// 	throw `Mismatched gadget uri ${ fixedGadgetUri.toString()} vs ${ stateUri.toString() }`;
			// }
		}
	}

	public getGadgetHookPath( uuid: string ): string
	{
		if( this.m_state.activeGadgets[ uuid ] )
		{
			return this.m_state.activeGadgets[ uuid ].hookPath;
		}
		else
		{
			return null;
		}
	}

	public getGadgetSettings( uuid: string ): any
	{
		if( this.m_state.activeGadgets[ uuid ] )
		{
			return this.m_state.activeGadgets[ uuid ].settings;
		}
		else
		{
			return null;
		}
	}

	public setGadgetHook( uuid: string, hook: string, hookFromGadget: AvNodeTransform )
	{
		let hookPath = buildPersistentHookPath( uuid, hook, hookFromGadget );
		this.setGadgetHookPath( uuid, hookPath );
	}

	public setGadgetHookPath( uuid: string, hookPath: string )
	{
		if( !this.m_state.activeGadgets[ uuid ] )
		{
			throw "unknown persistence uuid";
		}

		this.m_state.activeGadgets[ uuid ].hookPath = hookPath;
		this.markDirty();
	}

	public setGadgetSettings( uuid: string, settings: any )
	{
		if( !this.m_state.activeGadgets[ uuid ] )
		{
			throw "unknown persistence uuid";
		}

		this.m_state.activeGadgets[ uuid ].settings = settings;
		this.markDirty();
	}


	private markDirty()
	{
		this.m_writeTimer = global.setTimeout( () => {
			this.m_writeTimer = null;
			this.writeNow();
		}, 500 );
	}

	public writeNow()
	{
		if( this.m_writeTimer != null )
		{
			clearTimeout( this.m_writeTimer );
			this.m_writeTimer = null;
		}

		this.m_lastWriteTime = Date.now();
		console.log( `Saved state to ${ this.statePath }` );
		fs.writeFileSync( this.statePath, JSON.stringify( this.m_state, null, 2 ) );
	}


	public async readNow()
	{
		this.m_state = readPersistentState( this.statePath );

		// make sure all installed startAutomatically gadgets
		// are in the active list
		for( let installedGadget of this.m_state.installedGadgets )
		{
			let manifest = await getJSONFromUri( installedGadget + "/gadget_manifest.json" ) as AvGadgetManifest;
			if( manifest.startAutomatically )
			{
				let foundOne = false;
				for( let uuid in this.m_state.activeGadgets )
				{
					if( this.m_state.activeGadgets[ uuid ].uri == installedGadget )
					{
						foundOne = true;
						break;
					}
				}

				if( !foundOne )
				{
					this.createGadgetPersistence( installedGadget );
				}
			}
		}

		// create our local user info
		let key = "PUB" + this.m_state.localUserUuid;
		let userInfo: LocalUserInfo =
		{
			userUuid: this.m_state.localUserUuid,
			userDisplayName: this.m_state.localUserDisplayName,
			userPublicKey: key,
		}
		this.m_localUserInfo = signRequest( userInfo, key );
		this.m_privateKey = key;
	}


	public getActiveGadgets() : StoredGadget[]
	{
		let res: StoredGadget[] = [];
		for( let uuid in this.m_state.activeGadgets )
		{
			res.push(
				{
					uri: this.m_state.activeGadgets[uuid ].uri,
					uuid,
				}
			);
		}
		return res;
	}

	public getInstalledGadgets() : string[]
	{
		return this.m_state.installedGadgets;
	}

	public addInstalledGadget( gadgetUri: string )
	{
		if( !this.m_state.installedGadgets.includes( gadgetUri ) )
		{
			this.m_state.installedGadgets.push( gadgetUri );
			this.markDirty();
		}
	}

	public removeInstalledGadget( gadgetUri: string )
	{
		if( this.m_state.installedGadgets.includes( gadgetUri ) )
		{
			this.m_state.installedGadgets = 
				this.m_state.installedGadgets.filter( ( value: string ) =>
				{
					return value != gadgetUri;
				});
			this.markDirty();
		}
	}

	public isGadgetUriInstalled( gadgetUri: string ): boolean
	{
		return this.m_state.installedGadgets.includes( gadgetUri )
			|| gadgetUri == "http://localhost:23842/gadgets/aardvark_master"
			|| gadgetUri == "http://localhost:23842/gadgets/default_hands"
			|| gadgetUri == "http://localhost:23842/gadgets/gadget_menu";
	}

	public get localUserInfo() : LocalUserInfo
	{
		return this.m_localUserInfo;
	}

	public signRequest( req: AuthedRequest ): AuthedRequest
	{
		return signRequest( req, this.m_privateKey );
	}
}


export let persistence = new CPersistenceManager();
