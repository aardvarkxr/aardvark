#!/usr/bin/env node
import { URL } from 'url';
import axios, { AxiosResponse } from 'axios';
import { getStandardAardvarkPath, getStandardPersistencePath, readPersistentState, 
	writePersistentState, AvGadgetManifest } from '@aardvarkxr/aardvark-shared';
import * as fs from 'fs';
import fileUrl from 'file-url';
import isUrl from 'is-url';
import * as winston from 'winston';
import * as os from 'os';
import * as path from 'path';

let program = require( 'commander' );


let showHelp = true;

let asyncCommand: null | { (): void} = null;

let logDir = path.resolve( os.homedir(), "Documents/aardvark/logs" );
let logFile = path.resolve( logDir, "avcmd.txt" );

const logger = winston.createLogger(
	{
		format: winston.format.combine(
			winston.format.splat(),
			winston.format.simple()
		  ),
		transports: 
		[
			new winston.transports.Console(),
			new winston.transports.File( 
				{ 
					filename: logFile,
					format: 
						winston.format.printf( 
							( info: any ) => `${new Date().toISOString() }: ${ info.message }` ),
					maxsize: 1000000,
					maxFiles: 3,
					tailable: true,
				} ),
		]
	}
)

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
			installGadgets( urls );
		}

		showHelp = false;
	})
	
program
	.command( "uninstall [url...]" )
	.action( ( urls: string[] ) =>
	{
		uninstallGadgets(urls);
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
			logger.info( "No installed gadgets" );
		}
		else
		{
			for( let gadgetUrl of state.installedGadgets )
			{
				logger.info( gadgetUrl );
			}
		}

		if( !state.activeGadgets )
		{
			logger.info( "No active gadgets" );
		}
		else
		{
			for( let uuid in state.activeGadgets )
			{
				let gadgetState = state.activeGadgets[ uuid ];
				logger.info( `\t${ uuid }: ${gadgetState.uri}` );
				if( gadgetState.hookPath )
				{
					logger.info( `\t\t${ gadgetState.hookPath }: ${gadgetState.uri}` );
				}
				if( gadgetState.settings )
				{
					logger.info( `\t\t${ JSON.stringify( gadgetState.settings, undefined, "\t" ) }` );
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
			logger.info( `Deleting persistent state for Aardvark: ${ persistencePath }` );	
		}
		else
		{
			logger.info( "No persistent Aardvark data to clear" );
		}

		showHelp = false;
	});
	
program
	.command( "handleurl [url]", undefined, { noHelp: true } )
	.action( ( url: string ) =>
	{
		logger.info( "handleurl "+ url );
		let re = /^aardvark:\/\/([a-zA-Z]+)(\/(.*)$)/;
		let match = re.exec( url );
		if( !match )
		{
			logger.info( `Failed to parse URL ${ url }` );
		}
		else
		{
			let command = match[1];
			let arg = decodeURIComponent( match[3] );
			logger.info( `handling url ${ command } "${ arg }"`)

			switch( command )
			{
				case "install":
					asyncCommand = async () =>
					{
						installGadgets( [ arg ] );
					}
					break;
				
				case "uninstall":
					uninstallGadgets( [ arg ] );
					break;
			}
		}

		showHelp = false;
	} );
	
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

async function installGadgets( urls: string[] )
{
	let aardvarkPath = getStandardAardvarkPath();
	let persistencePath = getStandardPersistencePath();

	let state = readPersistentState( persistencePath );

	let dirty = false;
	for( let gadgetUrl of urls )
	{
		if (!isUrl(gadgetUrl) 
			&& !gadgetUrl.startsWith( "file:" ) && !gadgetUrl.startsWith( "FILE:" ) )
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
				logger.info( `${ gadgetManifest.name } is already installed: ${ gadgetUrl }` );
			}
			else
			{
				logger.info( `Installing ${ gadgetManifest.name }: ${ gadgetUrl }` );
				state.installedGadgets.push( gadgetUrl );
				dirty = true;
			}
		}
		catch( e )
		{
			logger.info( `Invalid gadget url ${ gadgetUrl }: ${ e }` );
		}
	}

	if( dirty )
	{
		logger.info( `writing state to ${ persistencePath }` );
		writePersistentState( state, persistencePath );
	}
}

function uninstallGadgets( urls: string[] ) 
{
	let aardvarkPath = getStandardAardvarkPath();
	let persistencePath = getStandardPersistencePath();
	let state = readPersistentState(persistencePath);
	let dirty = false;
	for (let gadgetUrl of urls) {
		if (!isUrl(gadgetUrl) 
			&& !gadgetUrl.startsWith( "file:" ) && !gadgetUrl.startsWith( "FILE:" ) ) 
		{
			// turn paths into URLs
			gadgetUrl = fileUrl(gadgetUrl);
		}
		if (!state.installedGadgets.includes(gadgetUrl)) {
			logger.info(`Gadget is not installed: ${gadgetUrl}`);
		}
		else {
			logger.info(`Uninstalling gadget: ${gadgetUrl}`);
			state.installedGadgets =
				state.installedGadgets.filter((value: string) => {
					return value != gadgetUrl;
				});
			dirty = true;
		}
	}

	if (dirty) {
		logger.info(`writing state to ${persistencePath}`);
		writePersistentState(state, persistencePath);
	}
}

