import { CTestRenderer } from './../test_renderer';
import { TraverserCallbacks, Traverser } from './../traverser_interface';
import { AvDefaultTraverser } from './../aardvark_traverser';
import { AvNode, AvNodeType, ENodeFlags, MessageType } from '@aardvarkxr/aardvark-shared';
import { mat4, vec3 } from '@tlaukkan/tsm';

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

describe( "AvDefaultTraverser ", () =>
{
	it( "just a model", async () =>
	{
		let root: AvNode =
		{
			type: AvNodeType.Origin,
			id: 0,
			flags: ENodeFlags.Visible,

			propOrigin: "/space/stage",

			children: 
			[
				{
					type: AvNodeType.Model,
					id: 1,
					flags: ENodeFlags.Visible,

					propModelUri: "http://test.com/mymodel.glb",
				}
			],
		};

		traverser.updateSceneGraph( root, "http://test.com/mygadget", 12 );
		traverser.traverse();

		expect( r.lastRenderList.length ).toBe( 1 );
		expect( r.lastModel( 0 ).url ).toBe( "http://test.com/mymodel.glb" );

		traverser.forgetGadget( 12 );
		traverser.traverse();

		expect( r.lastRenderList.length ).toBe( 0 );

	} );

} );