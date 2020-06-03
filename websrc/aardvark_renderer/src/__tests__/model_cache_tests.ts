import { gearBlob } from './../../test_models';
import { modelCache } from "../model_cache";
import { g_builtinModelSphere, g_builtinModelGear } from '@aardvarkxr/aardvark-shared';
import axios  from 'axios';
import { sphereBlob } from 'aardvark_renderer/test_models';

jest.mock( 'axios' );
const mockedAxios = axios as jest.Mocked< typeof axios >;


beforeEach( async() =>
{
} );

afterEach( () =>
{
	mockedAxios.get.mockReset();
} );

describe( "model cache", () =>
{
	it( "simple load", async () =>
	{
		axios.get = jest.fn().mockResolvedValue( { data: sphereBlob } );
		let modelPromise = modelCache.loadModel( g_builtinModelSphere );
		expect( mockedAxios.get ).toHaveBeenCalled();

		let model = await modelPromise;
		expect( model.aabb ).not.toBeNull();
		expect( model.binary ).not.toBeNull();

		mockedAxios.get.mockReset();
		
		let model2 = await modelCache.loadModel( g_builtinModelSphere );
		expect( mockedAxios.get ).not.toHaveBeenCalled();
		expect( model ).toBe( model2 );
	} );

	it( "more complex model", async () =>
	{
		axios.get = jest.fn().mockResolvedValue( { data: gearBlob } );
		let modelPromise = modelCache.loadModel( g_builtinModelGear );
		expect( mockedAxios.get ).toHaveBeenCalled();

		let model = await modelPromise;
		expect( model.aabb ).not.toBeNull();
		expect( model.binary ).not.toBeNull();

		mockedAxios.get.mockReset();
		
		let model2 = await modelCache.loadModel( g_builtinModelGear );
		expect( mockedAxios.get ).not.toHaveBeenCalled();
		expect( model ).toBe( model2 );
	} );

	it( "failed load", async () =>
	{
		axios.get = jest.fn().mockRejectedValue( "HTTP request failed" );
		let modelPromise = modelCache.loadModel( "bogus url" );
		expect( mockedAxios.get ).toHaveBeenCalled();

		expect( modelPromise ).rejects.toEqual( "Model Load Failed: bogus url" );
		try
		{
			let model = await modelPromise;
		}
		catch (e)
		{
			// this failure is expected
		}

		// check negative caching too
		axios.get = jest.fn().mockResolvedValue( { data: sphereBlob } );
		modelPromise = modelCache.loadModel( "bogus url" );
		expect( mockedAxios.get ).not.toHaveBeenCalled();

		expect( modelPromise ).rejects.toEqual( "Model Load Failed: bogus url" );
		try
		{
			let model = await modelPromise;
		}
		catch (e)
		{
			// this failure is expected
		}

	} );
} );



