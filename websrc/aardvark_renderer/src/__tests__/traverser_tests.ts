import { QuaternionToEulerAngles, DegreesToRadians, EulerAnglesToQuaternion } from '@aardvarkxr/aardvark-react';
import { AvSharedTextureInfo, ETextureType, ETextureFormat, AvColor, MessageType, translateMat, AvNodeTransform, nodeTransformToMat4 } from '@aardvarkxr/aardvark-shared';
import { mat4, vec3 } from '@tlaukkan/tsm';
import { addChild, buildModel, buildOrigin, buildTransform, colorFromString, nextGadget, currentGadgetId } from '../scene_graph_test_utils';
import { AvDefaultTraverser } from './../aardvark_traverser';
import { modelCache, ModelInfo } from './../model_cache';
import { textureCache, TextureInfo } from './../texture_cache';
import { CTestModel, CTestRenderer } from './../test_renderer';
import { Traverser, TraverserCallbacks } from './../traverser_interface';
const equal = require( 'fast-deep-equal' );

jest.mock( '../model_cache' );
const mockedModelCache = modelCache as jest.Mocked< typeof modelCache >;

mockedModelCache.queueModelLoad.mockImplementation( 
	( url: string ): ModelInfo =>
	{
		return 	{
			binary: new ArrayBuffer( 123 ),
			base64: "1234",
			url,
			aabb: 
			{ 
				xMin: -1, xMax: 1,
				yMin: -1, yMax: 1,
				zMin: -1, zMax: 1,
			},
			getRootFromNode: ( nodeId: string ) =>
			{
				return new mat4();
			},
		}
	} );

jest.mock( '../texture_cache' );
const mockedTextureCache = textureCache as jest.Mocked< typeof textureCache >;

mockedTextureCache.queueTextureLoad.mockImplementation( 
	( url: string ): TextureInfo =>
	{
		return 	{
			binary: new ArrayBuffer( 123 ),
			base64: "1234",
			url,
		}
	} );

class CTestCallbacks implements TraverserCallbacks
{
	public messages: object[] = [];

	sendMessage(type: MessageType, m: object )
	{
		this.messages.push( m );
	}
}

function matsAreClose( a: mat4, b: mat4 )
{
	let ar = a.all();
	let br = b.all();

	for( let i = 0; i < 16; i++ )
	{
		if( Math.abs( ar[i] - br[i] ) > 0.001 )
		{
			return false;
		}
	}

	return true;
}

function colorToString( color : string | AvColor ): string
{
	return JSON.stringify( colorFromString( color ) );
}

expect.extend( 
{
	toContainModels( renderList: CTestModel[], expectedCount: number, url: string, color?: string | AvColor, 
		universeFromModel?: mat4, sharedTextureInfo?: AvSharedTextureInfo )
	{
		let foundCount = 0;
		let reason = `model ${ url } not found`;
		for( let model of renderList )
		{
			if( model.url == url )
			{
				if( universeFromModel && !matsAreClose( universeFromModel, model.universeFromModel ) )
				{
					reason = `matrices did not match expected=${ universeFromModel.all() } `
						+ `actual=${ model.universeFromModel.all() }`;
					continue;
				}

				if( color && !equal( colorFromString( color ), model.color ) )
				{
					reason = `expected color ${ colorToString( color ) } did not match `
						+ `actual color ${ JSON.stringify( model.color ) }`;
					continue;
				}

				if( sharedTextureInfo && !equal( sharedTextureInfo, model.overrideTexture ) )
				{
					reason = `expected overrideTexture ${ JSON.stringify( sharedTextureInfo ) } did not match `
						+ `actual overrideTexture ${ JSON.stringify( model.overrideTexture ) }`;
					continue;
				}
				foundCount++;
			}
		}

		if( foundCount > 0 && foundCount < expectedCount )
		{
			reason = `found ${ foundCount } matching models, expected ${ expectedCount }`;
		}

		if( foundCount == expectedCount )
		{
			return {
				message: () =>
					`expected render list to not contain model: ${ url }: ${ reason }`,
				pass: true,
			};
		}
		else
		{
			return {
				message: () =>
					`expected render list to contain model ${ url }: ${ reason }`,
				pass: false,
			};
		}

	}
} );

declare global 
{
	namespace jest 
	{
		interface Matchers<R> 
		{
			toContainModels( expectedCount: number, url: string, color?: string | AvColor, 
				universeFromModel?: mat4, sharedTextureInfo?: AvSharedTextureInfo ): R;
		}
	}
}

let cb: CTestCallbacks = null;
let traverser: Traverser = null;
let r: CTestRenderer = null;

beforeEach( async() =>
{
	cb = new CTestCallbacks();
	r = new CTestRenderer();
	traverser = new AvDefaultTraverser( cb, r );
	await traverser.init();
} );

afterEach( async () =>
{
	cb = null;
	r = null;
	traverser = null;
	await modelCache.cleanup();
	nextGadget();
} );

const k_testModelUrl = "http://test.com/mymodel.glb";
const k_testGadgetUrl = "http://test.com/mygadget";
const k_testTextureUrl = "http://test.com/mytexture.png";

function testUrlTextureInfo( ): AvSharedTextureInfo
{
	return (
	{
		url: k_testTextureUrl,
		type: ETextureType.TextureUrl,
		format: ETextureFormat.R8G8B8A8,
	} );
}

describe( "AvDefaultTraverser ", () =>
{
	it( "just a model", async () =>
	{
		let root = buildOrigin( "/space/stage" );
		addChild( root, buildModel( k_testModelUrl ) );

		traverser.updateSceneGraph( root, k_testGadgetUrl, "http://test.com/", "Aardvark", currentGadgetId() );
		traverser.traverse();

		expect( r.lastRenderList.length ).toBe( 1 );
		expect( r.lastRenderList ).toContainModels( 1, k_testModelUrl );

		traverser.forgetGadget( currentGadgetId() );
		traverser.traverse();

		expect( r.lastRenderList.length ).toBe( 0 );

	} );

	it( "two models", async () =>
	{
		let root = buildOrigin( "/space/stage" );
		addChild( root, buildModel( k_testModelUrl ) );
		addChild( root, buildModel( k_testModelUrl ) );

		traverser.updateSceneGraph( root, k_testGadgetUrl, "http://test.com/", "Aardvark", currentGadgetId() );
		traverser.traverse();

		expect( r.lastRenderList.length ).toBe( 2 );
		expect( r.lastRenderList ).toContainModels( 2, k_testModelUrl );
	} );

	it( "red fish, blue fish", async () =>
	{
		let root = buildOrigin( "/space/stage" );
		addChild( root, buildModel( k_testModelUrl, "red" ) );
		addChild( root, buildModel( k_testModelUrl, "blue" ) );

		traverser.updateSceneGraph( root, k_testGadgetUrl,"http://test.com", "Aardvark",  currentGadgetId() );
		traverser.traverse();

		expect( r.lastRenderList.length ).toBe( 2 );
		expect( r.lastRenderList ).toContainModels( 1, k_testModelUrl, "red" );
		expect( r.lastRenderList ).toContainModels( 1, k_testModelUrl, "blue" );
	} );

	it( "override texture", async () =>
	{
		let root = buildOrigin( "/space/stage" );
		addChild( root, buildModel( k_testModelUrl, "red", testUrlTextureInfo() ) );
		addChild( root, buildModel( k_testModelUrl, null, testUrlTextureInfo() ) );

		traverser.updateSceneGraph( root, k_testGadgetUrl,"http://test.com", "Aardvark",  currentGadgetId() );
		traverser.traverse();

		expect( r.lastRenderList.length ).toBe( 2 );
		expect( r.lastRenderList ).toContainModels( 1, k_testModelUrl, "red", null, testUrlTextureInfo() );
		expect( r.lastRenderList ).toContainModels( 1, k_testModelUrl, "blue", null, testUrlTextureInfo() );
	} );

	it( "transform", async () =>
	{
		let root = buildOrigin( "/space/stage" );
		let trans = addChild( root, buildTransform( new vec3( [ 1, 2, 3 ] ) ) );
		addChild( trans, buildModel( k_testModelUrl ) );

		traverser.updateSceneGraph( root, k_testGadgetUrl, "http://test.com", "Aardvark", currentGadgetId() );
		traverser.traverse();

		expect( r.lastRenderList.length ).toBe( 1 );
		expect( r.lastRenderList ).toContainModels( 1, k_testModelUrl, undefined, 
			translateMat( new vec3( [ 1, 2, 3 ] ) ) );
	} );

	it( "transform parent", async () =>
	{
		let root = buildOrigin( "/space/stage" );
		let transDeclaredParent = addChild( root, buildTransform( new vec3( [ 1, 2, 3 ] ) ) );
		let transActualParent = addChild( root, buildTransform( new vec3( [ 11, 12, 13 ] ) ) );
		let transReparent = addChild( transActualParent, buildTransform( new vec3( [ 0, 0, 0 ] ) ) );
		transReparent.propParentAddr = transDeclaredParent.globalId;
		addChild( transReparent, buildModel( k_testModelUrl ) );

		traverser.updateSceneGraph( root, k_testGadgetUrl, "http://test.com", "Aardvark", currentGadgetId() );
		traverser.traverse();

		expect( r.lastRenderList.length ).toBe( 1 );
		expect( r.lastRenderList ).toContainModels( 1, k_testModelUrl, undefined, 
			translateMat( new vec3( [ 1, 2, 3 ] ) ) );
	} );

	it( "transform parent with constraint", async () =>
	{
		let root = buildOrigin( "/space/stage" );
		let transDeclaredParent = addChild( root, buildTransform( new vec3( [ 11, 12, 13 ] ) ) );
		let transActualParent = addChild( root, buildTransform( new vec3( [ 1, 2, 3 ] ) ) );
		let transReparent = addChild( transActualParent, buildTransform( new vec3( [ 0, 0, 0 ] ) ) );
		transReparent.propParentAddr = transDeclaredParent.globalId;
		transReparent.propConstraint =
		{
			minX: 0, minY: 0, minZ: 0,
			maxX: 3, maxY: 4, maxZ: 5,
		};
		addChild( transReparent, buildModel( k_testModelUrl ) );

		traverser.updateSceneGraph( root, k_testGadgetUrl, "http://test.com", "Aardvark", currentGadgetId() );
		traverser.traverse();

		expect( r.lastRenderList.length ).toBe( 1 );
		expect( r.lastRenderList ).toContainModels( 1, k_testModelUrl, undefined, 
			translateMat( new vec3( [ 4, 6, 8 ] ) ) );
	} );

	it( "transform parent with gravity constraint", async () =>
	{
		let root = buildOrigin( "/space/stage" );
		let transDeclaredParent = addChild( root, buildTransform( new vec3( [ 11, 12, 13 ] ) ) );
		transDeclaredParent.propTransform.rotation = EulerAnglesToQuaternion( 
			{ 
				yaw: DegreesToRadians( 45 ),
				pitch: 0,
				roll: DegreesToRadians( 60 ),
			} );
		let transActualParent = addChild( root, buildTransform( new vec3( [ 1, 2, 3 ] ) ) );
		let transReparent = addChild( transActualParent, buildTransform( new vec3( [ 0, 0, 0 ] ) ) );
		transReparent.propParentAddr = transDeclaredParent.globalId;
		transReparent.propConstraint =
		{
			gravityAligned: true,
		};
		addChild( transReparent, buildModel( k_testModelUrl ) );

		traverser.updateSceneGraph( root, k_testGadgetUrl, "http://test.com", "Aardvark", currentGadgetId() );
		traverser.traverse();

		let expected: AvNodeTransform =
		{
			position: { x: 11, y: 12, z: 13 },
			rotation: EulerAnglesToQuaternion( { yaw: DegreesToRadians( 45 ), pitch: 0, roll: 0 } ),
		}
		let expectedMat = nodeTransformToMat4( expected );

		expect( r.lastRenderList.length ).toBe( 1 );
		expect( r.lastRenderList ).toContainModels( 1, k_testModelUrl, undefined, expectedMat );
	} );

} );