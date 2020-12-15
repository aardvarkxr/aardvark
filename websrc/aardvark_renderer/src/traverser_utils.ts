import { TransformedVolume } from './volume_intersection';
import { mat4 } from '@tlaukkan/tsm';
import { EndpointAddr, stringToEndpointAddr, AvVolume, JointInfo, Av, JointTransform, nodeTransformToMat4, EVolumeType } from '@aardvarkxr/aardvark-shared';
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

	const k_validatorOptions: validator.IsURLOptions =
	{
		require_tld: false,
		require_protocol: true,
	};

	if( !validator.isURL( rawUrl, k_validatorOptions ) )
	{
		if( validator.isURL( gadgetBaseUrl, k_validatorOptions ) )
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

interface TypedArrayFields
{
	readonly buffer: ArrayBuffer;
	readonly byteLength: number;
	readonly byteOffset: number;
}

/** Concatenates any number of array buffers into one big array buffer. */
export function concatArrayBuffers( buffers: TypedArrayFields[] ): ArrayBuffer
{
	let totalSize = 0;
	for( let b of buffers )
	{
		totalSize += b.byteLength;
	}

	let out = new Uint8Array( totalSize );
	let sizeSoFar = 0;
	for( let b of buffers )
	{
		out.set( new Uint8Array( b.buffer, b.byteOffset, b.byteLength ), sizeSoFar );
		sizeSoFar += b.byteLength;
	}
	return out.buffer;
}

let skeletonInfoCache = new Map<string, JointInfo[] | null >();

function getSkeletonInfo( handPath: string )
{
	if( skeletonInfoCache.has( handPath ) )
	{
		return skeletonInfoCache.get( handPath );
	}
	else
	{
		let info = Av().renderer.getSkeletonInfo( handPath );
		if( info )
		{
			skeletonInfoCache.set( handPath, info );
		}
		return info;
	}
}

/** gets a volume list to represent one hand */
export function getHandVolumes( handPath: string ): TransformedVolume[]
{
	let info = getSkeletonInfo( handPath );
	if( !info )
		return [];

	let transforms = Av().renderer.getSkeletonTransforms( handPath );
	if( !transforms )
		return [];

	if( transforms.length != info.length )
	{
		console.log( `Mismatched array lengths for ${ handPath } skeleton ${ transforms.length } != ${ info.length }` );
		return [];
	}

	let parentFromJoint = transforms.map( ( t: JointTransform ) =>
		nodeTransformToMat4( { position: t.translation, rotation: t.rotation } ) );

	if( Number.isNaN( parentFromJoint[0].row( 0)[0]))
	{
		console.log( "It's NaN" );
	}
	let universeFromRootArray = Av().renderer.getUniverseFromOriginTransform( handPath + "/raw" );
	if( !universeFromRootArray )
	{
		return [];
	}
	let universeFromRoot = new mat4( universeFromRootArray );

	let universeFromJoint: mat4[] = [];

	let missedOne = true;
	while( missedOne )
	{
		missedOne = false;
		for( let i = 0; i < transforms.length; i++ )
		{
			if( universeFromJoint[i] )
				continue;

			const parentIndex = info[i].parentIndex;
			if( typeof parentIndex !== "number" )
			{
				universeFromJoint[i] = universeFromRoot;
			}
			else if( !universeFromJoint[ parentIndex ] )
			{
				missedOne = true;
			}
			else
			{
				universeFromJoint[i] = ( new mat4( universeFromJoint[ parentIndex ].all() ) ).multiply( parentFromJoint[ i ] );
			}
		}
	}

	let results:TransformedVolume[] = [];
	for( let i = 0; i < transforms.length; i++ )
	{
		if( info[i].radius == 0 )
			continue;

		results.push(
			{
				universeFromVolume: universeFromJoint[i],
				type: EVolumeType.Sphere,
				radius: info[i].radius,
			} );
	}

	return results;
}
