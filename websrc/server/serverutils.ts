import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import * as fileUrl from 'file-url';
import axios, { AxiosResponse } from 'axios';1

export let g_localInstallPathUri = fileUrl( path.resolve( path.dirname( __filename ), ".." ));

export function fixupUriForLocalInstall( originalUri: string ):URL
{
	let lowerUri = originalUri.toLowerCase();

	let httpPrefix = "http://aardvark.install";
	let httpsPrefix = "https://aardvark.install";

	if ( lowerUri.indexOf( httpPrefix ) == 0 )
	{
		return new URL( g_localInstallPathUri + originalUri.slice( httpPrefix.length ) );
	}
	else
	{
		if ( lowerUri.indexOf( httpsPrefix ) == 0 )
		{
			return new URL( g_localInstallPathUri + originalUri.slice( httpsPrefix.length ) );
		}
	}

	return new URL( originalUri );
}

export function getJSONFromUri( uri: string ): Promise< any >
{
	return new Promise<any>( ( resolve, reject ) =>
	{
		try
		{
			let url = fixupUriForLocalInstall( uri );
			if( url.protocol == "file:" )
			{
				fs.readFile( url, "utf8", (err: NodeJS.ErrnoException, data: string ) =>
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


export function buildPersistentHookPath( gadgetUuid: string, hookPersistentName: string )
{
	return "/gadget/" + gadgetUuid + "/" + hookPersistentName;
}

export interface HookPathParts
{
	gadgetUuid: string;
	hookPersistentName: string;
}

export function parsePersistentHookPath( path: string ): HookPathParts
{
	let re = new RegExp( "^/gadget/(.*)/(.*)$" );
	let match = re.exec( path );
	if( !match )
	{
		// this probably isn't a gadget hook path
		return null;
	}

	return (
		{ 
			gadgetUuid: match[1],
			hookPersistentName: match[2],
		} );
}
