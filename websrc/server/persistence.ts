import { AardvarkState, StoredGadget, readPersistentState } from '@aardvarkxr/aardvark-shared';
import { v4 as uuid } from 'uuid';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { fixupUriForLocalInstall } from './serverutils';
import bind from 'bind-decorator';


class CPersistenceManager
{
	private m_state: AardvarkState;
	private m_writeTimer: NodeJS.Timeout = null;
	private m_pendingFileReload: NodeJS.Timeout = null;
	private m_lastWriteTime: number = 0;

	constructor()
	{
		if( !fs.existsSync( this.path ) )
		{
			fs.mkdirSync( this.path );
		}

		this.readNow();

		fs.watch( this.statePath, this.onStateFileChanged )
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
			this.m_pendingFileReload = setTimeout( ()=>
			{
				this.m_pendingFileReload = null;
				this.reload();
			}, 500 );
		}
	}

	public reload()
	{
		console.log( "Reloading state.json" );
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
			let stateUri = fixupUriForLocalInstall( this.m_state.activeGadgets[uuid].uri );
			let fixedGadgetUri = fixupUriForLocalInstall( gadgetUri );
			if( stateUri.toString() == fixedGadgetUri.toString() )
			{
				delete this.m_state.activeGadgets[uuid];
				this.markDirty();
			}
			else
			{
				throw `Mismatched gadget uri ${ fixedGadgetUri.toString()} vs ${ stateUri.toString() }`;
			}
		}
	}

	public getGadgetHook( uuid: string ): string
	{
		if( this.m_state.activeGadgets[ uuid ] )
		{
			return this.m_state.activeGadgets[ uuid ].hook;
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

	public setGadgetHook( uuid: string, hook: string )
	{
		if( !this.m_state.activeGadgets[ uuid ] )
		{
			throw "unknown persistence uuid";
		}

		this.m_state.activeGadgets[ uuid ].hook = hook;
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
		this.m_writeTimer = setTimeout( () => {
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

	public readNow()
	{
		this.m_state = readPersistentState( this.statePath );
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
}

export let persistence = new CPersistenceManager();
