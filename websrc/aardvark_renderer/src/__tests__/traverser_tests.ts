import { CTestRenderer } from './../test_renderer';
import { TraverserCallbacks, Traverser } from './../traverser_interface';
import { AvDefaultTraverser } from './../aardvark_traverser';
import { AvNode, AvNodeType, ENodeFlags, MessageType } from '@aardvarkxr/aardvark-shared';
import { mat4, vec3 } from '@tlaukkan/tsm';
import { buildOrigin, addChild, buildModel } from '../scene_graph_test_utils';

class CTestCallbacks implements TraverserCallbacks
{
	public messages: object[] = [];

	sendMessage(type: MessageType, m: object )
	{
		this.messages.push( m );
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
} );

afterEach( () =>
{
	cb = null;
	r = null;
	traverser = null;
} );

const k_testModelUrl = "http://test.com/mymodel.glb";
const k_testGadgetUrl = "http://test.com/mygadget";

describe( "AvDefaultTraverser ", () =>
{
	it( "just a model", async () =>
	{
		let root = buildOrigin( "/space/stage" );
		addChild( root, buildModel( k_testModelUrl ) );

		traverser.updateSceneGraph( root, k_testGadgetUrl, 12 );
		traverser.traverse();

		expect( r.lastRenderList.length ).toBe( 1 );
		expect( r.lastModel( 0 ).url ).toBe( k_testModelUrl );

		traverser.forgetGadget( 12 );
		traverser.traverse();

		expect( r.lastRenderList.length ).toBe( 0 );

	} );

} );