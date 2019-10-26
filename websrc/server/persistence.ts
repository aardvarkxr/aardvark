import { v4 as uuid } from 'uuid';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

interface GadgetPersistence
{
	uri: string;
	hook?: string;
	settings?: any;
}

export interface StoredGadget
{
	uri: string;
	uuid: string;
}

const AardvarkStateFormat = 1;

export interface AardvarkState
{
	format: number;
	activeGadgets: { [uuid:string]: GadgetPersistence };
	installedGadgets: string[];
}

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
		try
		{
			let previousState = fs.readFileSync( this.statePath, 'utf8' );
			this.m_state = JSON.parse( previousState );

			if( this.m_state.format != AardvarkStateFormat )
			{
				throw `Inappropriate state format ${this.m_state.format}`;
			}

			console.log( `Read state from ${ this.statePath } for `
				+ `${ Object.keys( this.m_state.activeGadgets ).length } active gadgets` );
		}
		catch( e )
		{
			console.log( "Failed to read state file. Using default start" );

			this.m_state =
			{
				format: AardvarkStateFormat,
				activeGadgets: 
				{
					"master" : { uri: "https://aardvark.install/gadgets/aardvark_master" },
				},
				installedGadgets: 
				[
					"https://aardvark.install/gadgets/test_panel",
					"https://aardvark.install/gadgets/charm_bracelet",
					"https://aardvark.install/gadgets/control_test",
				],
			}
		}
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
					return value == gadgetUri;
				});
			this.markDirty();
		}
	}
}

export let persistence = new CPersistenceManager();
