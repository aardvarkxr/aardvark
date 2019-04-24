// ---------------------------------------------------------------------------
// Purpose: Test gadget API in Aardvark
// ---------------------------------------------------------------------------
#include <catch/catch.hpp>
#include <../aardvark/pathtools.h>
#include <../aardvark/filetools.h>
#include <../aardvark/stringtools.h>

#include <random>

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

TEST_CASE( "string conversion", "[tools]" )
{
	REQUIRE( L"test string" == Utf8ToWString( "test string" ) );
	REQUIRE( "test string" == WStringToUtf8( L"test string" ) );
}

TEST_CASE( "binary read/write", "[tools]" )
{
	std::random_device rd;
	std::mt19937 gen( rd() );
	std::uniform_int_distribution<> dis( 0, 255 );

	std::vector<char> vecTestData;
	vecTestData.reserve( 100 );
	for ( uint32_t unCount = 0; unCount < 100; unCount++ )
	{
		vecTestData.push_back( dis( gen ) );
	}

	std::filesystem::path pathUnique = GetUniqueTempFilePath();

	REQUIRE( WriteBinaryFile( pathUnique, &vecTestData[0], 100 ) );

	auto vecLoaded( ReadBinaryFile( pathUnique ) );
	REQUIRE( vecTestData == vecLoaded );
}

