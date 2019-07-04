// ---------------------------------------------------------------------------
// Purpose: Test gadget API in Aardvark
// ---------------------------------------------------------------------------
#include <catch/catch.hpp>
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


TEST_CASE( "Aardvark Gadgets", "[gadgets]" ) 
{
	CServerThread serverThread;
	serverThread.Start();

	CAardvarkClient client;

	client.Start();

	{
		auto reqCreateGadget = client.Server().createGadgetRequest();
		reqCreateGadget.setName( "fnord" );
		auto promCreateGadget = reqCreateGadget.send();

		auto resCreateGadget = promCreateGadget.wait( client.WaitScope() );
		REQUIRE( resCreateGadget.hasGadget() );

		auto promName = resCreateGadget.getGadget().nameRequest().send();
		auto resName = promName.wait( client.WaitScope() );

		REQUIRE( "fnord" == resName.getName() );

		auto promDestroy = resCreateGadget.getGadget().destroyRequest().send();
		auto resDestroy = promDestroy.wait( client.WaitScope() );
		REQUIRE( resDestroy.getSuccess() );
	}

	client.Stop();

	serverThread.Join();
}
