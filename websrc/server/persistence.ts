import { AardvarkState, StoredGadget, readPersistentState } from '@aardvarkxr/aardvark-shared';
import { v4 as uuid } from 'uuid';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';


class CPersistenceManager
{
	private m_state: AardvarkState;
	private m_writeTimer: NodeJS.Timeout = null;

	constructor()
	{
		if( !fs.existsSync( this.path ) )
		{
			fs.mkdirSync( this.path );
		}

		this.readNow();
	}

	public get path(): string
	{
		return path.join( os.homedir(), "aardvark" );
	}

	public get statePath(): string
	{
		return path.join( this.path, "state.json" );
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
			if( this.m_state.activeGadgets[uuid].uri == gadgetUri )
			{
				delete this.m_state.activeGadgets[uuid];
				this.markDirty();
			}
			else
			{
				throw `Mismatched gadget uri ${ gadgetUri} vs ${ this.m_state.activeGadgets[uuid].uri }`;
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
