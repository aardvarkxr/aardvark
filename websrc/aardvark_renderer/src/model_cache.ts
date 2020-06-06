import { nodeTransformToMat4 } from '@aardvarkxr/aardvark-react';
import { AABB, AvNodeTransform, EndpointAddr, stringToEndpointAddr } from '@aardvarkxr/aardvark-shared';
import * as core from "@loaders.gl/core";
import * as gltf from "@loaders.gl/gltf";
import { mat4, vec4 } from '@tlaukkan/tsm';
import axios from 'axios';
import { fromByteArray } from 'base64-js';
import * as IPFS from 'ipfs';

export interface ModelInfo
{
	readonly url: string;
	readonly aabb: AABB;
	readonly binary: ArrayBuffer;
	readonly base64: string;
}

function addNodeToAabb( aabb: AABB, node: any )
{
	for( let prim of node.mesh?.primitives ?? [] )
	{
		for( let i =  0; i < prim.attributes.POSITION.count; i++ )
		{
			let v = new vec4( [ 
				prim.attributes.POSITION.value[ i + 0 ],
				prim.attributes.POSITION.value[ i + 1 ],
				prim.attributes.POSITION.value[ i + 2 ],
				1
			] );

			let v2 = node.rootFromNode.multiplyVec4( v );
			aabb.xMin = Math.min( v2.x, aabb.xMin );
			aabb.xMax = Math.max( v2.x, aabb.xMax );
			aabb.yMin = Math.min( v2.y, aabb.yMin );
			aabb.yMax = Math.max( v2.y, aabb.yMax );
			aabb.zMin = Math.min( v2.z, aabb.zMin );
			aabb.zMax = Math.max( v2.z, aabb.zMax );
		}
	}

	for( let child of node?.children ?? [] )
	{
		addNodeToAabb( aabb, child );
	}
}


function aabbFromGltf( model: any ): AABB
{
	let aabb: AABB =
	{
		xMin: Number.MAX_VALUE,
		xMax: Number.MIN_VALUE,
		yMin: Number.MAX_VALUE,
		yMax: Number.MIN_VALUE,
		zMin: Number.MAX_VALUE,
		zMax: Number.MIN_VALUE,
	};

	let scene = model.scene;
	for( let node of scene.nodes )
	{
		addNodeToAabb( aabb, node );
	}

	return aabb;
}

function updateModelTransforms( node: any, rootFromParent: mat4 )
{
	let parentFromNode: mat4;
	if( node.matrix )
	{
		parentFromNode = new mat4( node.matrix );
	}
	else
	{
		let trsParentFromNode: AvNodeTransform = {};
		if( node.scale )
		{
			trsParentFromNode.scale = { x: node.scale[0], y: node.scale[1], z: node.scale[2] };
		}

		if( node.translation )
		{
			trsParentFromNode.position = { x: node.translation[0], y: node.translation[1], z: node.translation[2] };
		}

		if( node.rotation )
		{
			trsParentFromNode.rotation = 
			{ 
				x: node.rotation[0], 
				y: node.rotation[1], 
				z: node.rotation[2], 
				w: node.rotation[3] 
			};
		}
		parentFromNode = nodeTransformToMat4( trsParentFromNode );
	}

	node.parentFromNode = parentFromNode;
	node.rootFromNode = mat4.product( rootFromParent, parentFromNode, new mat4() );

	for( let child of node.children ?? [] )
	{
		updateModelTransforms( child, node.rootFromNode );
	}
}


class ModelInfoInternal implements ModelInfo
{
	public url: string;
	public aabb: AABB;
	public binary: ArrayBuffer;
	public base64: string;
	private model: any;

	constructor( url: string, model: any, binary: ArrayBuffer )
	{
		this.url = url;
		this.model = model;
		this.binary = binary;
		this.base64 = fromByteArray( new Uint8Array( binary ) );

		for( let scene of model.scenes )
		{
			for( let node of scene.nodes )
			{
				updateModelTransforms( node, mat4.identity );
			}
		}

		this.aabb = aabbFromGltf( model );
	}
}

let models = new Map<string, ModelInfo>();
let failedModels = new Set<string>();
let loadsPending = new Set<string>();
let ipfsNode: any = null;

async function init()
{
	ipfsNode = await IPFS.create();
	const version = await ipfsNode.version()

	console.log('IPFS Version:', version.version );
}

//init();

function loadModel( url: string ): Promise< ModelInfo >
{
	return new Promise<ModelInfo>( async ( resolve, reject ) =>
	{
		if( models.has( url ) )
		{
			resolve( models.get( url ) );
			return;
		}
		if( failedModels.has( url ) )
		{
			reject( `Model Load Failed: ${ url }` );
			return;
		}

		try
		{
			let response = await axios.get( url, { responseType: "arraybuffer" } );
			let parsed = await core.parse( response.data, [ gltf.GLTFLoader ] );
	
			let model = new ModelInfoInternal( url, parsed, response.data );
			models.set( url, model );
			resolve( model );	
		}
		catch( e )
		{
			failedModels.add( url );
			reject( `Model Load Failed: ${ url }` );
		}
	} );
}

function queueModelLoad( url: string ): ModelInfo
{
	if( models.has( url ) )
	{
		return models.get( url );
	}
	if( failedModels.has( url ) )
	{
		throw new Error( `Model Load Failed: ${ url }` );
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
		loadModel( url )
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


export const modelCache = 
{
	queueModelLoad,
	loadModel,
};