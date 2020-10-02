
import { manifestUriFromGadgetUri, gadgetUriFromWindow } from "../src/aardvark_protocol"

describe( "Should correctly evaluate manifest Uri from Gadget Uri", () => {
	it( "Removes a trailing / when one is present", () => {
		expect( 
			manifestUriFromGadgetUri( "https://something.com/" )
		).toBe( "https://something.com/manifest.webmanifest" );
	});

	it( "Appends a / when one is not present", () => {
		expect( 
			manifestUriFromGadgetUri( "https://something.com" )
		).toBe( "https://something.com/manifest.webmanifest" );
	});
});

describe( "Should correctly infer gadget location from window", () => {
	const { location } = window;

	beforeAll((): void => {
		delete window.location;
		// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
		// @ts-ignore
		window.location = {
			origin: 'http://test.com',
			pathname: ''
		};
	});

	afterAll((): void => {
		window.location = location;
	});

	it( "Correctly infers when at root", () => {
		window.location.pathname = '/';
		expect( gadgetUriFromWindow() ).toBe( "http://test.com" );
	})

	it( "Correctly infers when at a sub index", () => {
		window.location.pathname = '/some/path/to/here';
		expect( gadgetUriFromWindow() ).toBe( "http://test.com/some/path/to" );
	})
});