// ---------------------------------------------------------------------------
// Purpose: Test model API in Aardvark
// ---------------------------------------------------------------------------
#include <catch/catch.hpp>
#include <aardvark/aardvark_server.h>
#include <aardvark/aardvark_client.h>

#include <tools/pathtools.h>
#include <tools/filetools.h>
#include <tools/stringtools.h>

#include "testutils.h"

using namespace aardvark;


TEST_CASE( "Aardvark models", "[models]" )
{
	CServerThread serverThread;
	serverThread.Start();

	CAardvarkClient client;

	client.Start();

	std::vector<char> vecTestData = RandomBytes( 100 );
	std::filesystem::path pathUnique = tools::GetUniqueTempFilePath();
	REQUIRE( tools::WriteBinaryFile( pathUnique, &vecTestData[0], vecTestData.size() ) );
	std::string sUriUnique = tools::PathToFileUri( pathUnique );

	{
		auto reqGetModelSource = client.Server().getModelSourceRequest();
		reqGetModelSource.setUri( sUriUnique );
		auto resGetModelSource = reqGetModelSource.send().wait( client.WaitScope() );

		REQUIRE( resGetModelSource.getSuccess() );

		auto source = resGetModelSource.getSource();

		auto resData = source.dataRequest().send().wait( client.WaitScope() );
		REQUIRE( resData.hasData() );
		auto data = resData.getData();
		REQUIRE( data.size() == vecTestData.size() );
		auto dataChars = data.asChars();
		REQUIRE( 0 == memcmp( &dataChars[0], &vecTestData[0], vecTestData.size() ) );

		auto resUri = source.uriRequest().send().wait( client.WaitScope() );
		REQUIRE( resUri.getUri() == sUriUnique );
	}

	client.Stop();

	serverThread.Join();

	REQUIRE( std::filesystem::remove( pathUnique ) );
}
