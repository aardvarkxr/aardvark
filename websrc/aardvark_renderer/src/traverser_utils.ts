import { TransformedVolume } from './volume_intersection';
import { mat4 } from '@tlaukkan/tsm';
import { EndpointAddr, stringToEndpointAddr, AvVolume, JointInfo, Av, JointTransform, nodeTransformToMat4, EVolumeType, sphereVolume, EHand } from '@aardvarkxr/aardvark-shared';
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

enum HandSkeletonBone
{
	Root = 0,
	Wrist,
	Thumb0,
	Thumb1,
	Thumb2,
	Thumb3,
	IndexFinger0,
	IndexFinger1,
	IndexFinger2,
	IndexFinger3,
	IndexFinger4,
	MiddleFinger0,
	MiddleFinger1,
	MiddleFinger2,
	MiddleFinger3,
	MiddleFinger4,
	RingFinger0,
	RingFinger1,
	RingFinger2,
	RingFinger3,
	RingFinger4,
	PinkyFinger0,
	PinkyFinger1,
	PinkyFinger2,
	PinkyFinger3,
	PinkyFinger4,
	Aux_Thumb,
	Aux_IndexFinger,
	Aux_MiddleFinger,
	Aux_RingFinger,
	Aux_PinkyFinger,
};

interface JointVolume
{
	volume: AvVolume;
	jointFromVolume: mat4;
	joint: HandSkeletonBone;
}

interface SkeletonInfo
{
	joints: JointInfo[];
	volumes: JointVolume[];
}

let skeletonInfoCache = new Map<string, SkeletonInfo | null >();


function boneSphere( hand: EHand, joint: HandSkeletonBone, offset?: number, radius?: number )
{
	let x = offset ?? 0;
	if( hand == EHand.Right )
	{
		x = -x;
	}

	let jointFromVolume = nodeTransformToMat4( { position: { x, y: 0, z: 0 } } );
	let jv: JointVolume =
	{
		joint,
		jointFromVolume,
		volume: sphereVolume( radius ?? 0.01 ),
	}
	return jv;
}

function createHandVolumes( handPath: string )
{
	// volumes are processed in the order that they appear in the list, so put the 
	// most important fingertip volumes first in the list
	let hand = handPath == "/user/hand/left" ? EHand.Left : EHand.Right;
	return [
		boneSphere( hand, HandSkeletonBone.IndexFinger4 ),
		boneSphere( hand, HandSkeletonBone.Thumb3 ),
		boneSphere( hand, HandSkeletonBone.MiddleFinger4 ),
		boneSphere( hand, HandSkeletonBone.RingFinger4 ),
		boneSphere( hand, HandSkeletonBone.PinkyFinger4 ),
		//boneSphere( hand, HandSkeletonBone.Wrist ),
		//boneSphere( hand, HandSkeletonBone.Thumb0 ),
		boneSphere( hand, HandSkeletonBone.Thumb1, 0, 0.012 ),
		boneSphere( hand, HandSkeletonBone.Thumb2, 0, 0.012 ),
		// boneSphere( hand, HandSkeletonBone.IndexFinger0 ),
		boneSphere( hand, HandSkeletonBone.IndexFinger1, 0, 0.011 ),
		boneSphere( hand, HandSkeletonBone.IndexFinger2, 0, 0.011 ),
		boneSphere( hand, HandSkeletonBone.IndexFinger3 ),
		boneSphere( hand, HandSkeletonBone.MiddleFinger0, 0.02, 0.03 ),
		boneSphere( hand, HandSkeletonBone.MiddleFinger1, 0, 0.011 ),
		boneSphere( hand, HandSkeletonBone.MiddleFinger2, 0, 0.011 ),
		boneSphere( hand, HandSkeletonBone.MiddleFinger3 ),
		// boneSphere( hand, HandSkeletonBone.RingFinger0 ),
		boneSphere( hand, HandSkeletonBone.RingFinger1, 0, 0.011 ),
		boneSphere( hand, HandSkeletonBone.RingFinger2, 0, 0.011 ),
		boneSphere( hand, HandSkeletonBone.RingFinger3 ),
		// boneSphere( hand, HandSkeletonBone.PinkyFinger0 ),
		boneSphere( hand, HandSkeletonBone.PinkyFinger1 ),
		boneSphere( hand, HandSkeletonBone.PinkyFinger2 ),
		boneSphere( hand, HandSkeletonBone.PinkyFinger3 ),
	];
}

function getSkeletonInfo( handPath: string ): SkeletonInfo | null
{
	if( skeletonInfoCache.has( handPath ) )
	{
		return skeletonInfoCache.get( handPath );
	}
	else
	{
		let joints = Av().renderer.getSkeletonInfo( handPath );
		if( !joints )
		{
			return null;
		}

		let info: SkeletonInfo =
		{
			joints,
			volumes: createHandVolumes( handPath ),
		}

		skeletonInfoCache.set( handPath, info );
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

	if( transforms.length != info.joints.length )
	{
		console.log( `Mismatched array lengths for ${ handPath } skeleton ${ transforms.length } != ${ info.joints.length }` );
		return [];
	}

	let parentFromJoint = transforms.map( ( t: JointTransform ) =>
		nodeTransformToMat4( { position: t.translation, rotation: t.rotation } ) );

	let universeFromRootArray = Av().renderer.getUniverseFromOriginTransform( handPath + "/raw" );
	if( !universeFromRootArray )
	{
		return [];
	}
	let universeFromRoot = new mat4( universeFromRootArray );

	let universeFromJoint: mat4[] = [];

	// the bone indices in the hands are actually ordered such that the parents 
	// will be resolved first so we don't need this loop. Leaving it here in case
	// a future skeleton is not so kind.
	let missedOne = true;
	while( missedOne )
	{
		missedOne = false;
		for( let i = 0; i < transforms.length; i++ )
		{
			if( universeFromJoint[i] )
				continue;

			const parentIndex = info.joints[i].parentIndex;
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
	for( let v of info.volumes )
	{
		let universeFromVolume = ( new mat4( universeFromJoint[ v.joint ].all() ) ).multiply( v.jointFromVolume );
		results.push(
			{
				...v.volume,
				universeFromVolume,
			} );
	}

	return results;
}
