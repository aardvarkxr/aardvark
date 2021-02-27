import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import * as fileUrl from 'file-url';
import axios, { AxiosResponse } from 'axios';

export let g_localInstallPath = path.resolve( path.dirname( __filename ), ".." );
export let g_localInstallPathUri = fileUrl( g_localInstallPath );

export function getJSONFromUri( uri: string ): Promise< any >
{
	return new Promise<any>( ( resolve, reject ) =>
	{
		try
		{
			let url = new URL( uri );
			if( url.protocol == "file:" )
			{
				fs.readFile( url, "utf8", (err: NodeJS.ErrnoException, data: string ) =>
				{
					if( err )
					{
						console.log( "readFile.reject", uri );
						reject( err );
					}
					else
					{
						console.log( "readFile.resolve", uri );
						resolve( JSON.parse( data ) );
					}
				});
			}
			else
			{
				let promRequest = axios.get( url.toString() )
				.then( (value: AxiosResponse ) =>
				{
					console.log( "axios.get.resolve", uri );
					resolve( value.data );
				} )
				.catch( (reason: any ) =>
				{
					console.log( "axios.get.resolve", uri );
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
