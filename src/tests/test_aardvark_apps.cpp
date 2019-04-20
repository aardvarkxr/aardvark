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
		auto reqCreateApp = client.Server().createAppRequest();
		reqCreateApp.setName( "fnord" );
		auto promCreateApp = reqCreateApp.send();

		auto resCreateApp = promCreateApp.wait( client.WaitScope() );
		REQUIRE( resCreateApp.hasApp() );

		auto promName = resCreateApp.getApp().nameRequest().send();
		auto resName = promName.wait( client.WaitScope() );

		REQUIRE( "fnord" == resName.getName() );

		auto promDestroy = resCreateApp.getApp().destroyRequest().send();
		auto resDestroy = promDestroy.wait( client.WaitScope() );
		REQUIRE( resDestroy.getSuccess() );
	}

	client.Stop();

	serverThread.Join();
}
