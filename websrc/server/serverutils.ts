import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import * as fileUrl from 'file-url';
import axios, { AxiosResponse } from 'axios';import { AvNodeTransform } from '@aardvarkxr/aardvark-shared';
1

export let g_localInstallPath = path.resolve( path.dirname( __filename ), ".." );
export let g_localInstallPathUri = fileUrl( g_localInstallPath );

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

export function transformToUriString( transform: AvNodeTransform )
{
	let res = "";
	if( transform.position )
	{
		res += `t(${ transform.position.x },${ transform.position.y },${ transform.position.z })`;
	}
	if( transform.scale )
	{
		if( res.length )
		{
			res += "+";
		}
		res += `s(${ transform.scale.x },${ transform.scale.y },${ transform.scale.z })`;
	}
	if( transform.rotation )
	{
		if( res.length )
		{
			res += "+";
		}
		res += `r(${ transform.rotation.w },${ transform.rotation.x },${ transform.rotation.y },${ transform.rotation.z })`;
	}
	return res;
}

export function uriStringToTransform( uriFragment: string ): AvNodeTransform
{
	// a zero length fragment means "no transform". Everything else should parse
	if( !uriFragment.length )
	{
		return null;
	}

	let re = /^([tsr])\((.*)\)$/;

	let transform : AvNodeTransform = {};

	let parts = uriFragment.split( "+" );
	for( let part of parts )
	{
		let match = re.exec( part );
		if( !match )
		{
			throw new Error( "Could not parse transform fragment " + part );
		}

		let components = match[2].split( "," );
		switch( match[1] )
		{
			case "t":
				if( components.length != 3 )
				{
					throw new Error( "translation has three components " + part );
				}

				transform.position = 
				{
					x: parseFloat( components[0] ),
					y: parseFloat( components[1] ),
					z: parseFloat( components[2] ),
				}
				break;
		
			case "s":
				if( components.length != 3 )
				{
					throw new Error( "scale has three components " + part );
				}

				transform.scale = 
				{
					x: parseFloat( components[0] ),
					y: parseFloat( components[1] ),
					z: parseFloat( components[2] ),
				}
				break;

			case "r":
				if( components.length != 4 )
				{
					throw new Error( "scale has three components " + part );
				}

				transform.rotation = 
				{
					w: parseFloat( components[0] ),
					x: parseFloat( components[1] ),
					y: parseFloat( components[2] ),
					z: parseFloat( components[3] ),
				}
				break;

			default:
				throw new Error( "Unknown transform component " + match[1] );
		} 
	}

	return transform;
}


export function buildPersistentHookPath( gadgetUuid: string, hookPersistentName: string, 
	hookFromGadget: AvNodeTransform )
{
	let path = "/gadget/" + gadgetUuid + "/" + hookPersistentName;
	if( hookFromGadget )
	{
		path += "/" + transformToUriString( hookFromGadget );
	}
	return path;
}

export interface HookPathParts
{
	gadgetUuid: string;
	hookPersistentName: string;
	hookFromGadget?: AvNodeTransform;
}

export function parsePersistentHookPath( path: string ): HookPathParts
{
	let reLong = /^\/gadget\/(.*)\/(.*)\/(.*)$/ ;
	let match = reLong.exec( path );
	if( !match )
	{
		let reShort = /^\/gadget\/(.*)\/(.*)$/ ;
		match = reShort.exec( path );
	}

	if( !match )
	{
		// this probably isn't a gadget hook path
		return null;
	}

	let hookFromGadget: AvNodeTransform;
	if( match.length == 4 ) // if we matched reLong
	{
		try
		{
			hookFromGadget = uriStringToTransform( match[3] );
		}
		catch( e )
		{
			return null;
		}
	}

	return (
		{ 
			gadgetUuid: match[1],
			hookPersistentName: match[2],
			hookFromGadget,
		} );
}
