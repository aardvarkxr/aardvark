// ---------------------------------------------------------------------------
// Purpose: Test app API in Aardvark
// ---------------------------------------------------------------------------
#include <catch/catch.hpp>
#include <aardvark/aardvark_apps.h>
#include <aardvark/aardvark_server.h>
#include <aardvark/aardvark_client.h>

using namespace aardvark;

TEST_CASE( "Aardvark apps", "[apps]" ) 
{
	CServerThread serverThread;
	serverThread.Start();

	CAardvarkClient client;

	client.Start();

	{
		auto createAppRequest = client.Server().createAppRequest();
		createAppRequest.setName( "fnord" );
		auto promise = createAppRequest.send();

		auto response = promise.wait( client.WaitScope() );
		auto sString = response.toString().flatten();
		printf( "%s\n", sString.cStr() );
	}
	client.Stop();

	serverThread.Join();
}
