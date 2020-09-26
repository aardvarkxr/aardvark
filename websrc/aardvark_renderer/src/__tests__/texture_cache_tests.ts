import { gearBlob } from './../../test_models';
import { textureCache } from "../texture_cache";
import { g_builtinModelSphere, g_builtinModelGear } from '@aardvarkxr/aardvark-shared';
import axios  from 'axios';
import { sphereBlob } from 'aardvark_renderer/test_models';

jest.mock( 'axios' );
const mockedAxios = axios as jest.Mocked< typeof axios >;


beforeEach( async() =>
{
	await textureCache.init(
		{
			negativeCaching: true,
		}
	);
} );

afterEach( async () =>
{
	mockedAxios.get.mockReset();
	await textureCache.cleanup();
} );

const k_NonexistentUrl = "http://aardvarkxr.com/lsadjfsadlkjweoiruklsdjflkilskjvdowiuerojzkjoiuwrlaslkdslfa";

describe( "texture cache", () =>
{
	it( "simple load", async () =>
	{
		axios.get = jest.fn().mockResolvedValue( { data: sphereBlob } );
		let texturePromise = textureCache.loadTexture( g_builtinModelSphere );
		expect( mockedAxios.get ).toHaveBeenCalled();

		let model = await texturePromise;
		expect( model.binary ).not.toBeNull();

		mockedAxios.get.mockReset();
		
		let model2 = await textureCache.loadTexture( g_builtinModelSphere );
		expect( mockedAxios.get ).not.toHaveBeenCalled();
		expect( model ).toBe( model2 );
	} );

	it( "more complex model", async () =>
	{
		axios.get = jest.fn().mockResolvedValue( { data: gearBlob } );
		let texturePromise = textureCache.loadTexture( g_builtinModelGear );
		expect( mockedAxios.get ).toHaveBeenCalled();

		let model = await texturePromise;
		expect( model.binary ).not.toBeNull();

		mockedAxios.get.mockReset();
		
		let model2 = await textureCache.loadTexture( g_builtinModelGear );
		expect( mockedAxios.get ).not.toHaveBeenCalled();
		expect( model ).toBe( model2 );
	} );

	it( "failed load", async () =>
	{
		axios.get = jest.fn().mockRejectedValue( "HTTP request failed" );
		let texturePromise = textureCache.loadTexture( k_NonexistentUrl );
		expect( mockedAxios.get ).toHaveBeenCalled();

		expect( texturePromise ).rejects.toEqual( "Texture Load Failed: " + k_NonexistentUrl );
		try
		{
			let model = await texturePromise;
		}
		catch (e)
		{
			// this failure is expected
		}

		// check negative caching too
		axios.get = jest.fn().mockResolvedValue( { data: sphereBlob } );
		texturePromise = textureCache.loadTexture( k_NonexistentUrl );
		expect( mockedAxios.get ).not.toHaveBeenCalled();

		expect( texturePromise ).rejects.toEqual( "Texture Load Failed: " + k_NonexistentUrl );
		try
		{
			let model = await texturePromise;
		}
		catch (e)
		{
			// this failure is expected
		}

	} );
} );



