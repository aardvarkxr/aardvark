import { computeEndpointFieldUri, EndpointAddr, endpointAddrsMatch, EndpointType } from '@aardvarkxr/aardvark-shared';
import { fixupUrl, UrlType } from '../traverser_utils';


beforeEach( async() =>
{
} );

afterEach( () =>
{
} );

describe( "traverser utils", () =>
{

	it( "fixupUrl", ()=>
	{
		let [ url, type ] = fixupUrl("http://dontcare.com", "http://foo.com/", null );
		expect( url ).toBe( "http://foo.com/" );
		expect( type ).toBe( UrlType.HTTP );

		[ url, type ] = fixupUrl("http://dontcare.com", "HTTPS://foo.com/", null );
		expect( url ).toBe( "HTTPS://foo.com/" );
		expect( type ).toBe( UrlType.HTTP );
		
		[ url, type ] = fixupUrl("http://gadgetbase.com/mygadget", "relative/path.glb", null );
		expect( url ).toBe( "http://gadgetbase.com/mygadget/relative/path.glb" );
		expect( type ).toBe( UrlType.HTTP );
		
		[ url, type ] = fixupUrl("http://gadgetbase.com/mygadget/", "relative/path.glb", null );
		expect( url ).toBe( "http://gadgetbase.com/mygadget/relative/path.glb" );
		expect( type ).toBe( UrlType.HTTP );

		[ url, type ] = fixupUrl("", "IPFS://abc123", null );
		expect( url ).toBe( "/ipfs/abc123" );
		expect( type ).toBe( UrlType.IPFS );

		[ url, type ] = fixupUrl("", "IPFS://abc123/", null );
		expect( url ).toBe( "/ipfs/abc123/" );
		expect( type ).toBe( UrlType.IPFS );

		[ url, type ] = fixupUrl("", "dweb://ipfs/abc123/some/path", null );
		expect( url ).toBe( "/ipfs/abc123/some/path" );
		expect( type ).toBe( UrlType.IPFS );

		[ url, type ] = fixupUrl("", "/ipfs/abc123/some/path", null );
		expect( url ).toBe( "/ipfs/abc123/some/path" );
		expect( type ).toBe( UrlType.IPFS );

		let testEpa: EndpointAddr = { endpointId: 23, nodeId: 2, type: EndpointType.Node };
		let findNodeField = ( epa: EndpointAddr, fieldName:string ) : [ string, string ]=>
		{
			if( !endpointAddrsMatch( epa, testEpa ) )
			{
				return null;
			}

			switch( fieldName )
			{
				case "fullUrl": return [ "http://mygadget.com", "http://full.com/url/to/model.glb" ];
				case "relativeUrl": return [ "http://mygadget.com", "to/model.glb" ];
				case "ipfs": return [ "http://mygadget.com", "ipfs://abcd1234" ];
				case "loop": return [ "http://mygadget.com", computeEndpointFieldUri( testEpa, "loop" ) ];
				case "recurse": return [ "http://mygadget.com", computeEndpointFieldUri( testEpa, "fullUrl" ) ];
				default: return null;
			}
		}
		let bogusEpa: EndpointAddr = { endpointId: 2, nodeId: 7, type: EndpointType.Node };

		[ url, type ] = fixupUrl("", computeEndpointFieldUri( testEpa, "fullUrl" ), findNodeField );
		expect( url ).toBe( "http://full.com/url/to/model.glb" );
		expect( type ).toBe( UrlType.HTTP );

		[ url, type ] = fixupUrl("", computeEndpointFieldUri( testEpa, "relativeUrl" ), findNodeField );
		expect( url ).toBe( "http://mygadget.com/to/model.glb" );
		expect( type ).toBe( UrlType.HTTP );

		[ url, type ] = fixupUrl("", computeEndpointFieldUri( testEpa, "ipfs" ), findNodeField );
		expect( url ).toBe( "/ipfs/abcd1234" );
		expect( type ).toBe( UrlType.IPFS );

		[ url, type ] = fixupUrl("", computeEndpointFieldUri( testEpa, "recurse" ), findNodeField );
		expect( url ).toBe( "http://full.com/url/to/model.glb" );
		expect( type ).toBe( UrlType.HTTP );

		[ url, type ] = fixupUrl("", computeEndpointFieldUri( testEpa, "loop" ), findNodeField );
		expect( url ).toBeNull();
		expect( type ).toBe( UrlType.Invalid );

		[ url, type ] = fixupUrl("", computeEndpointFieldUri( bogusEpa, "fullUrl" ), findNodeField );
		expect( url ).toBeNull();
		expect( type ).toBe( UrlType.Invalid );

	} );

} );



