// ---------------------------------------------------------------------------
// Purpose: Test gadget API in Aardvark
// ---------------------------------------------------------------------------
#include <catch/catch.hpp>
#include <aardvark/aardvark_server.h>
#include <aardvark/aardvark_client.h>
#include <aardvark/aardvark_gadget_manifest.h>
#include <json/json.hpp>

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

using nlohmann::json;

TEST_CASE( "parse manifest", "[gadgets]" )
{
	json j = R"JSON(
		{
			"name" : "Default Hand",
			"permissions" : [ "scenegraph" ],
			"resolution": [ 1024, 512 ],
			"model" : "http://aardvark.data/models/space_man_hand.glb"
		}
	)JSON"_json;

	CAardvarkGadgetManifest gm = j.get<CAardvarkGadgetManifest>();
	REQUIRE( "Default Hand" == gm.m_name );
	REQUIRE( 1024 == gm.m_width );
	REQUIRE( 512 == gm.m_height );
	REQUIRE( std::vector<std::string>{ "scenegraph" } == gm.m_permissions);
	REQUIRE( "http://aardvark.data/models/space_man_hand.glb" == gm.m_modelUri );
}

TEST_CASE( "parse partial manifest", "[gadgets]" )
{
	json j = R"JSON(
		{
			"name" : "Default Hand",
			"permissions" : [ "scenegraph", "master" ],
			"model" : "http://aardvark.data/models/space_man_hand.glb"
		}
	)JSON"_json;

	CAardvarkGadgetManifest gm = j.get<CAardvarkGadgetManifest>();
	REQUIRE( "Default Hand" == gm.m_name );
	REQUIRE( 16 == gm.m_width );
	REQUIRE( 16 == gm.m_height );
	REQUIRE( std::vector<std::string>{ "scenegraph", "master" } == gm.m_permissions );
	REQUIRE( "http://aardvark.data/models/space_man_hand.glb" == gm.m_modelUri );
}



