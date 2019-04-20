// ---------------------------------------------------------------------------
// Purpose: Test app API in Aardvark
// ---------------------------------------------------------------------------
#include <catch/catch.hpp>
#include <aardvark/aardvark_apps.h>
#include <aardvark/aardvark_server.h>
#include <aardvark/aardvark_client.h>

using namespace aardvark;

bool operator==( const char *pchLHS, const kj::String & rhs )
{
	return 0 == _stricmp( pchLHS, rhs.cStr() );
}
bool operator==( const kj::String & lhs, const char *pchRHS )
{
	return 0 == _stricmp( pchRHS, lhs.cStr() );
}


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

		auto namePromise = res.getApp().nameRequest().send();
		auto nameRes = namePromise.wait( client.WaitScope() );

		REQUIRE( "fnord" == nameRes.getName() );

		auto destroyPromise = res.getApp().destroyRequest().send();
		auto destroyRes = destroyPromise.wait( client.WaitScope() );
		REQUIRE( destroyRes.getSuccess() );
	}

	client.Stop();

	serverThread.Join();
}
