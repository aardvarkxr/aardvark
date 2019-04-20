// ---------------------------------------------------------------------------
// Purpose: Test app API in Aardvark
// ---------------------------------------------------------------------------
#include <catch/catch.hpp>
#include <aardvark/aardvark.h>
#include <aardvark/aardvark_apps.h>
#include <aardvark/aardvark_server.h>
#include <aardvark/aardvark_client.h>

using namespace aardvark;

TEST_CASE( "Aardvark gadgets", "[gadgets]" )
{
	CServerThread serverThread;
	serverThread.Start();

	CAardvarkClient client;

	client.Start();

	{
		auto reqCreateApp = client.Server().createAppRequest();
		reqCreateApp.setName( "fnord" );
		auto promCreateApp = reqCreateApp.send();
		auto reqCreateGadget = promCreateApp.getApp().createGadgetRequest();
		reqCreateGadget.setName( "foo" );
		auto promCreateGadget = reqCreateGadget.send();

		auto gadget = promCreateGadget.getGadget();
		auto reqName = gadget.nameRequest();
		auto promName = reqName.send();

		auto resName = promName.wait( client.WaitScope() );
		REQUIRE( "foo" == resName.getName() );

		auto promDestroy = gadget.destroyRequest().send();
		auto resDestroy = promDestroy.wait( client.WaitScope() );
		REQUIRE( resDestroy.getSuccess() );
	}

	client.Stop();

	serverThread.Join();
}
