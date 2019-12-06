#!/usr/bin/env node
import { URL } from 'url';
import axios, { AxiosResponse } from 'axios';
import { getStandardAardvarkPath, getStandardPersistencePath, readPersistentState, 
	writePersistentState, AvGadgetManifest } from '@aardvarkxr/aardvark-shared';
import * as fs from 'fs';
import fileUrl from 'file-url';
import isUrl from 'is-url';

let program = require( 'commander' );


let showHelp = true;

let asyncCommand: null | { (): void} = null;

program
	.version( '0.1.0' )
	.description( "Performs various functions on the local Aardvark install" )
	.arguments( "<cmd> [arguments]" )

program
	.command( "install [url...]" )
	.action( ( urls: string[] ) =>
	{
		asyncCommand = async () =>
		{
			let aardvarkPath = getStandardAardvarkPath();
			let persistencePath = getStandardPersistencePath();
	
			let state = readPersistentState( persistencePath );
	
			let dirty = false;
			for( let gadgetUrl of urls )
			{
				if( !isUrl( gadgetUrl ) )
				{
					// turn paths into URLs
					gadgetUrl = fileUrl( gadgetUrl );
				}
	
				try
				{
					let gadgetManifest: AvGadgetManifest = await getJSONFromUri( gadgetUrl + "/gadget_manifest.json" ) as AvGadgetManifest
					if( !gadgetManifest || !gadgetManifest.name )
					{
						throw "Invalid manifest";
					}
					if( state.installedGadgets.includes( gadgetUrl ) )
					{
						console.log( `${ gadgetManifest.name } is already installed: ${ gadgetUrl }` );
					}
					else
					{
						console.log( `Installing ${ gadgetManifest.name }: ${ gadgetUrl }` );
						state.installedGadgets.push( gadgetUrl );
						dirty = true;
					}
				}
				catch( e )
				{
					console.log( `Invalid gadget url ${ gadgetUrl }` );
				}
			}
	
			if( dirty )
			{
				console.log( `writing state to ${ persistencePath }` );
				writePersistentState( state, persistencePath );
			}
		}

		showHelp = false;
	})
	
program
	.command( "uninstall [url...]" )
	.action( ( urls: string[] ) =>
	{
		let aardvarkPath = getStandardAardvarkPath();
		let persistencePath = getStandardPersistencePath();

		let state = readPersistentState( persistencePath );

		let dirty = false;
		for( let gadgetUrl of urls )
		{
			if( !isUrl( gadgetUrl ) )
			{
				// turn paths into URLs
				gadgetUrl = fileUrl( gadgetUrl );
			}

			if( !state.installedGadgets.includes( gadgetUrl ) )
			{
				console.log( `Gadget is not installed: ${ gadgetUrl }` );
			}
			else
			{
				console.log( `Uninstalling gadget: ${ gadgetUrl }` );
				state.installedGadgets = 
					state.installedGadgets.filter( ( value: string ) =>
					{
						return value != gadgetUrl;
					});
				dirty = true;
			}
		}

		if( dirty )
		{
			console.log( `writing state to ${ persistencePath }` );
			writePersistentState( state, persistencePath );
		}

		showHelp = false;
	})
	
program
	.command( "list" )
	.action( ( ) =>
	{
		let persistencePath = getStandardPersistencePath();

		let state = readPersistentState( persistencePath );

		if( !state.installedGadgets )
		{
			console.log( "No installed gadgets" );
		}
		else
		{
			for( let gadgetUrl of state.installedGadgets )
			{
				console.log( gadgetUrl );
			}
		}

		if( !state.activeGadgets )
		{
			console.log( "No active gadgets" );
		}
		else
		{
			for( let uuid in state.activeGadgets )
			{
				let gadgetState = state.activeGadgets[ uuid ];
				console.log( `\t${ uuid }: ${gadgetState.uri}` );
				if( gadgetState.hookPath )
				{
					console.log( `\t\t${ gadgetState.hookPath }: ${gadgetState.uri}` );
				}
				if( gadgetState.settings )
				{
					console.log( `\t\t${ JSON.stringify( gadgetState.settings, undefined, "\t" ) }` );
				}
			}
		}
		showHelp = false;
	})
	
program
	.command( "reset" )
	.action( ( ) =>
	{
		let persistencePath = getStandardPersistencePath();
		if( fs.existsSync( persistencePath ) )
		{
			fs.unlinkSync( persistencePath );
			console.log( `Deleting persistent state for Aardvark: ${ persistencePath }` );	
		}
		else
		{
			console.log( "No persistent Aardvark data to clear" );
		}

		showHelp = false;
	})
	
program.parse( process.argv );

if( showHelp )
{
	program.outputHelp();
}
if( asyncCommand )
{
	( asyncCommand as () => void) ();
}

export function getJSONFromUri( uri: string ): Promise< any >
{
	return new Promise<any>( ( resolve, reject ) =>
	{
		try
		{
			let url = new URL( uri );
			if( url.protocol == "file:" )
			{
				fs.readFile( url, "utf8", (err: NodeJS.ErrnoException | null, data: string ):void =>
				{
					if( err )
					{
						reject( err );
					}
					else
					{
						resolve( JSON.parse( data ) );
					}
				});
			}
			else
			{
				let promRequest = axios.get( url.toString() )
				.then( (value: AxiosResponse ) =>
				{
					resolve( value.data );
				} )
				.catch( (reason: any ) =>
				{
					reject( reason );
				});
			}
		}
		catch( e )
		{
			reject( e );
		}
	} );
}
