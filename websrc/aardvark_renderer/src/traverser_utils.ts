import { EndpointAddr, stringToEndpointAddr } from '@aardvarkxr/aardvark-shared';
import validator from 'validator';


export enum UrlType
{
	Invalid, 
	HTTP, 	// a regular HTTP or HTTPS URL
	IPFS,   // an ipfs reference canonicalized to /ipfs/<hash>[/<path>/<to>/<resource>]
	NodeField, // a node field URL that couldn't be resolved because the node field lookup function wasn't provided
}

function fixupUrlInternal( gadgetBaseUrl: string, rawUrl: string, 
	lookupNodeField: ( epa: EndpointAddr, fieldName: string ) => [ string, string], depth: number ): [ string, UrlType ]
{
	let reNodeField = /^nodefield:\/\/(.*)\/(.*)$/;

	let res = reNodeField.exec( rawUrl );
	if( res )
	{
		if( depth > 10 )
		{
			return [ null, UrlType.Invalid ];
		}

		if( !lookupNodeField )
		{
			return [ rawUrl, UrlType.NodeField ];
		}
		else
		{
			let nodeField = lookupNodeField( stringToEndpointAddr( res[1] ), res[2] );
			if( !nodeField )
			{
				return [ null, UrlType.Invalid ];
			}

			const [ nodeGadgetBaseUrl, nodeFieldUrl ] = nodeField;
			return fixupUrlInternal( nodeGadgetBaseUrl, nodeFieldUrl, lookupNodeField, depth + 1 );
		}
	}

	// already canonical IPFS
	if( /^\/ipfs\/.*$/.test( rawUrl ) )
	{
		return [ rawUrl, UrlType.IPFS ];
	}

	// IPFS:// and friends
	res = /^ipfs:\/?\/?(.+)$/i.exec( rawUrl );
	if( res )
	{
		return [ "/ipfs/" + res[1], UrlType.IPFS ];
	}

	// DWEB://ipfs/ and friends
	res = /^dweb:\/?\/?ipfs\/(.+)$/i.exec( rawUrl );
	if( res )
	{
		return [ "/ipfs/" + res[1], UrlType.IPFS ];
	}

	if( !validator.isURL( rawUrl ) )
	{
		if( validator.isURL( gadgetBaseUrl ) )
		{
			if( gadgetBaseUrl.endsWith( "/" ) )
			{
				return [ gadgetBaseUrl + rawUrl, UrlType.HTTP ];
			}
			else
			{
				return [ gadgetBaseUrl + "/" + rawUrl, UrlType.HTTP ];
			}
		}
		else
		{
			return [ null, UrlType.Invalid ];
		}
	}
	else
	{
		return [ rawUrl, UrlType.HTTP ];
	}
}


/** Normalizes URL formats for all the various kinds of URLs that Aardvark supports */
export function fixupUrl( gadgetBaseUrl: string, rawUrl: string, 
	lookupNodeField: ( epa: EndpointAddr, fieldName: string ) => [ string, string] ): [string, UrlType ]
{
	return fixupUrlInternal( gadgetBaseUrl, rawUrl, lookupNodeField, 0 );
}

