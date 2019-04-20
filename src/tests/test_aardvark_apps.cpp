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

		auto res = promise.wait( client.WaitScope() );
		REQUIRE( res.hasApp() );
		auto destroyPromise = res.getApp().destroyRequest().send();
		auto destroyRes = destroyPromise.wait( client.WaitScope() );
		REQUIRE( destroyRes.getSuccess() );
	}

	client.Stop();

	serverThread.Join();
}
