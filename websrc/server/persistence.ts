import { v4 as uuid } from 'uuid';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

interface GadgetPersistence
{
	uri: string;
	hook?: string;
	extraData?: any;
}

export interface StoredGadget
{
	uri: string;
	uuid: string;
}

class CPersistenceManager
{
	private m_gadgets: { [uuid:string]: GadgetPersistence } = {};
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
		this.m_gadgets[ id ] = { uri: gadgetUri };
		this.markDirty();
		return id;
	}

	public destroyGadgetPersistence( gadgetUri: string, uuid: string )
	{
		if( this.m_gadgets[ uuid ] )
		{
			if( this.m_gadgets[uuid].uri == gadgetUri )
			{
				delete this.m_gadgets[uuid];
				this.markDirty();
			}
			else
			{
				throw `Mismatched gadget uri ${ gadgetUri} vs ${ this.m_gadgets[uuid].uri }`;
			}
		}
	}

	public getGadgetHook( uuid: string ): string
	{
		if( this.m_gadgets[ uuid ] )
		{
			return this.m_gadgets[ uuid ].hook;
		}
		else
		{
			return null;
		}
	}

	public getGadgetExtraData( uuid: string ): any
	{
		if( this.m_gadgets[ uuid ] )
		{
			return this.m_gadgets[ uuid ].extraData;
		}
		else
		{
			return null;
		}
	}

	public setGadgetHook( uuid: string, hook: string )
	{
		if( !this.m_gadgets[ uuid ] )
		{
			throw "unknown persistence uuid";
		}

		this.m_gadgets[ uuid ].hook = hook;
		this.markDirty();
	}

	public setGadgetExtraData( uuid: string, extraData: any )
	{
		if( !this.m_gadgets[ uuid ] )
		{
			throw "unknown persistence uuid";
		}

		this.m_gadgets[ uuid ].extraData = extraData;
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
		fs.writeFileSync( this.statePath, JSON.stringify( this.m_gadgets, null, 2 ) );
	}

	public readNow()
	{
		try
		{
			let previousState = fs.readFileSync( this.statePath, 'utf8' );
			this.m_gadgets = JSON.parse( previousState );

			console.log( `Read state from ${ this.statePath } for `
				+ `${ Object.keys( this.m_gadgets ).length } gadgets` );
		}
		catch( e )
		{
			console.log( "Failed to read state file. Using default start" );

			this.m_gadgets[ "master" ] =
			{
				uri: "https://aardvark.install/gadgets/aardvark_master",
			}
		}
	}

	public getGadgets() : StoredGadget[]
	{
		let res: StoredGadget[] = [];
		for( let uuid in this.m_gadgets )
		{
			res.push(
				{
					uri: this.m_gadgets[uuid ].uri,
					uuid,
				}
			);
		}
		return res;
	}
}

export let persistence = new CPersistenceManager();
