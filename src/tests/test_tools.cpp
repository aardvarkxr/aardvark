// ---------------------------------------------------------------------------
// Purpose: Test tool module
// ---------------------------------------------------------------------------
#include <catch/catch.hpp>
#include <tools/pathtools.h>
#include <tools/filetools.h>
#include <tools/stringtools.h>

#include <aardvark/aardvark_scene_graph.h>

#include "testutils.h"

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

	REQUIRE( PathToFileUri( "//fnord/somepath/somefile.ext" ) == "file://fnord/somepath/somefile.ext" );
	REQUIRE( PathToFileUri( "c:/somepath/somefile.ext" ) == "file:///c:/somepath/somefile.ext" );
}

TEST_CASE( "string conversion", "[tools]" )
{
	REQUIRE( L"test string" == Utf8ToWString( "test string" ) );
	REQUIRE( "test string" == WStringToUtf8( L"test string" ) );
}

TEST_CASE( "binary read/write", "[tools]" )
{
	std::vector<char> vecTestData = RandomBytes( 100 );
	std::filesystem::path pathUnique = GetUniqueTempFilePath();

	REQUIRE( WriteBinaryFile( pathUnique, &vecTestData[0], 100 ) );

	auto vecLoaded( ReadBinaryFile( pathUnique ) );
	REQUIRE( vecTestData == vecLoaded );

	std::filesystem::remove( pathUnique );
}

TEST_CASE("Gadget Uri Sanitizer", "[tools]")
{
	aardvark::GadgetParams_t no_trailing_slash = { "http://localhost:23842/gadgets/aardvark_renderer", "", aardvark::EndpointAddr_t() };
	aardvark::sanitize(no_trailing_slash);
	REQUIRE(no_trailing_slash.uri == "http://localhost:23842/gadgets/aardvark_renderer");

	aardvark::GadgetParams_t trailing_slash = { "http://localhost:23842/", "", aardvark::EndpointAddr_t() };
	aardvark::sanitize(trailing_slash);
	REQUIRE(trailing_slash.uri == "http://localhost:23842");
}

