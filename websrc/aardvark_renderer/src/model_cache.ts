import { ipfsUtils } from './ipfs_utils';
import { AABB, AvNodeTransform, nodeTransformToMat4, stringToEndpointAddr } from '@aardvarkxr/aardvark-shared';
import * as core from "@loaders.gl/core";
import * as gltf from "@loaders.gl/gltf";
import { mat4, vec4 } from '@tlaukkan/tsm';
import axios from 'axios';
import { fromByteArray } from 'base64-js';
import * as IPFS from 'ipfs';
import { fixupUrl, UrlType, concatArrayBuffers } from './traverser_utils';

export interface ModelInfo
{
	readonly url: string;
	readonly aabb: AABB;
	readonly binary: ArrayBuffer;
	readonly base64: string;

	getRootFromNode( nodeId: string ): mat4;
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

	private findNode( nodeList: any[], id: string ): any
	{
		for( let node of nodeList )
		{
			if( node.name == id )
				return node;

			if( node.children )
			{
				let child = this.findNode( node.children, id );
				if( child )
				{
					return child;
				}
			}
		}

		return null;
	}

	public getRootFromNode( nodeId: string ): mat4
	{
		for( let scene of this.model.scenes )
		{
			let node = this.findNode( scene.nodes, nodeId );
			if( node )
			{
				return node.rootFromNode;
			}
		}

		return null;
	}

}

/** Options for the model cache */
export interface ModelCacheOptions
{
	/** If this is true, failed URLs will not be requested again.
	 * 
	 * @default true
	 */
	negativeCaching?: boolean;
}


let models: Map<string, ModelInfo> = null;
let failedModels: Set<string> = null;
let loadsPending: Set<string> = null;
let options: ModelCacheOptions = null;
let negativeCaching = false;

async function init( optionsParam: ModelCacheOptions )
{
	await cleanup();

	options = optionsParam;

	models = new Map<string, ModelInfo>();
	failedModels = new Set<string>();
	loadsPending = new Set<string>();

}

async function cleanup()
{
	models = null;
	failedModels = null;
	loadsPending = null;

}

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
			const [ fixedUrl, urlType ] = fixupUrl( "", url, null );

			let modelData: any = null;
			switch( urlType )
			{
				case UrlType.HTTP:
					{
						let response = await axios.get( fixedUrl, { responseType: "arraybuffer" } );
						modelData = response.data;
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

						modelData = concatArrayBuffers( chunks );
					}
					break;

				default:
					{
						reject( `Unable to load from invalid URL ${ url }` );
					}
					break;
			}

			let parsed = await core.parse( modelData, [ gltf.GLTFLoader ] );
	
			let model = new ModelInfoInternal( url, parsed, modelData );
			models.set( url, model );
			resolve( model );	
		}
		catch( e )
		{
			if( options.negativeCaching ?? true )
			{
				failedModels.add( url );
			}
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
	init,
	cleanup,
};