import { ipfsUtils } from './ipfs_utils';
import axios from 'axios';
import { fromByteArray } from 'base64-js';
import * as IPFS from 'ipfs';
import { concatArrayBuffers, fixupUrl, UrlType } from './traverser_utils';

export interface TextureInfo
{
	readonly url: string;
	readonly binary: ArrayBuffer;
	readonly base64: string;
}

class TextureInfoInternal implements TextureInfo
{
	public url: string;
	public binary: ArrayBuffer;
	public base64: string;

	constructor( url: string, binary: ArrayBuffer )
	{
		this.url = url;
		this.binary = binary;
		this.base64 = fromByteArray( new Uint8Array( binary ) );
	}
}

/** Options for the Texture cache */
export interface TextureCacheOptions
{
	/** If this is true, failed URLs will not be requested again.
	 * 
	 * @default true
	 */
	negativeCaching?: boolean;
}


let textures: Map<string, TextureInfo> = null;
let failedTextures: Set<string> = null;
let loadsPending: Set<string> = null;
let options: TextureCacheOptions = null;

async function init( optionsParam: TextureCacheOptions )
{
	await cleanup();

	options = optionsParam;

	textures = new Map<string, TextureInfo>();
	failedTextures = new Set<string>();
	loadsPending = new Set<string>();

}

async function cleanup()
{
	textures = null;
	failedTextures = null;
	loadsPending = null;

}

function loadTexture( url: string ): Promise< TextureInfo >
{
	return new Promise<TextureInfo>( async ( resolve, reject ) =>
	{
		if( textures.has( url ) )
		{
			resolve( textures.get( url ) );
			return;
		}
		if( failedTextures.has( url ) )
		{
			reject( `Texture Load Failed: ${ url }` );
			return;
		}

		try
		{
			const [ fixedUrl, urlType ] = fixupUrl( "", url, null );

			let textureData: any = null;
			switch( urlType )
			{
				case UrlType.HTTP:
					{
						let response = await axios.get( fixedUrl, { responseType: "arraybuffer" } );
						textureData = response.data;
					}
					break;

				case UrlType.IPFS:
					{
						if( !ipfsUtils.instance() )
						{
							reject("IPFS not initialized" );
							return;
						}
						
						let chunks: Uint8Array[] = [];
						for await( let chunk of ipfsUtils.instance().cat( fixedUrl ) )
						{
							chunks.push( chunk );
						}

						textureData = concatArrayBuffers( chunks );
					}
					break;

				default:
					{
						reject( `Unable to load from invalid URL ${ url }` );
					}
					break;
			}

			let texture = new TextureInfoInternal( url, textureData );
			textures.set( url, texture );
			resolve( texture );	
		}
		catch( e )
		{
			if( options.negativeCaching ?? true )
			{
				failedTextures.add( url );
			}
			reject( `Texture Load Failed: ${ url }` );
		}
	} );
}

function queueTextureLoad( url: string ): TextureInfo
{
	if( textures.has( url ) )
	{
		return textures.get( url );
	}
	if( failedTextures.has( url ) )
	{
		throw new Error( `Texture Load Failed: ${ url }` );
	}
	if( loadsPending.has( url ) )
	{
		// we already started a load
		return null;
	}

	if( !loadsPending.has( url ) )
	{
		// otherwise, queue a load
		loadsPending.add( url );
		loadTexture( url )
		.then( () => 
		{
			loadsPending.delete( url );
		} )
		.catch( ( reason: any ) =>
		{
			// eat the error on the background load. 
			// If the caller still cares about this load they'll
			// get an exception above when they call back.
			loadsPending.delete( url );
		} );

	}
}


export const textureCache = 
{
	queueTextureLoad,
	loadTexture,
	init,
	cleanup,
};
