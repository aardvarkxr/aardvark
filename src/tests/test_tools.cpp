// ---------------------------------------------------------------------------
// Purpose: Test gadget API in Aardvark
// ---------------------------------------------------------------------------
#include <catch/catch.hpp>
#include <../aardvark/pathtools.h>


using namespace tools;

TEST_CASE( "path tools", "[tools]" )
{
	REQUIRE( IsFileUri( "file://fnord" ) );
	REQUIRE( IsFileUri( "FILE://fnord" ) );
	REQUIRE( !IsFileUri( "file:fnord" ) );
	REQUIRE( !IsFileUri( "http://fnord" ) );
	REQUIRE( !IsFileUri( "/fnord/something" ) );

	REQUIRE( FileUriToPath( "file://fnord/somepath/somefile.ext" ) == "//fnord/somepath/somefile.ext" );
	REQUIRE( FileUriToPath( "file:///c:/somepath/somefile.ext" ) == "c:/somepath/somefile.ext" );
}

