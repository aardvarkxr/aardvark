#!/usr/bin/env node

import { getStandardAardvarkPath, getStandardPersistencePath, readPersistentState, writePersistentState } from '@aardvarkxr/aardvark-shared';
import * as fs from 'fs';
import fileUrl from 'file-url';
import isUrl from 'is-url';

let program = require( 'commander' );


let showHelp = true;

program
	.version( '0.1.0' )
	.description( "Performs various functions on the local Aardvark install" )
	.arguments( "<cmd> [arguments]" )

program
	.command( "install [url...]" )
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

			if( state.installedGadgets.includes( gadgetUrl ) )
			{
				console.log( `Gadget is already installed: ${ gadgetUrl }` );
			}
			else
			{
				console.log( `Installing gadget: ${ gadgetUrl }` );
				state.installedGadgets.push( gadgetUrl );
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