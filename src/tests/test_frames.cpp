// ---------------------------------------------------------------------------
// Purpose: Test app API in Aardvark
// ---------------------------------------------------------------------------
#include <catch/catch.hpp>
#include <aardvark/aardvark.h>
#include <aardvark/aardvark_apps.h>
#include <aardvark/aardvark_server.h>
#include <aardvark/aardvark_client.h>

using namespace aardvark;

TEST_CASE( "Aardvark frames", "[frames]" )
{
	CServerThread serverThread;
	serverThread.Start();

	CAardvarkClient client;

	client.Start();

	{
		auto reqCreateApp = client.Server().createAppRequest();
		reqCreateApp.setName( "fnord" );
		auto promCreateApp = reqCreateApp.send();

		SECTION( "empty frame" )
		{
			auto reqCreateGadget = promCreateApp.getApp().createGadgetRequest();
			reqCreateGadget.setName( "foo" );
			auto promCreateGadget = reqCreateGadget.send();

			auto promFrame = client.Server().getNextVisualFrameRequest().send();
			auto resFrame = promFrame.wait( client.WaitScope() );

			REQUIRE( resFrame.hasFrame() );
			auto frame = resFrame.getFrame();
			REQUIRE( frame.getId() == 1 );
			REQUIRE( !frame.hasModels() );
		}
	}

	client.Stop();

	serverThread.Join();
}
