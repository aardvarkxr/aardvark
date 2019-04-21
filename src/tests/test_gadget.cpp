// ---------------------------------------------------------------------------
// Purpose: Test gadget API in Aardvark
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

		SECTION( "simple create" )
		{
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

		SECTION( "set transform" )
		{
			auto reqCreateGadget = promCreateApp.getApp().createGadgetRequest();
			reqCreateGadget.setName( "bar" );
			auto promCreateGadget = reqCreateGadget.send();

			auto gadget = promCreateGadget.getGadget();

			auto reqSetTransform = gadget.setTransformRequest();

			reqSetTransform.setParentPath( "/user/hand/right" );

			auto & bldTransform = reqSetTransform.initTransform();
			bldTransform.getPosition().setX( 1.f );
			bldTransform.getPosition().setY( 2.f );
			bldTransform.getPosition().setZ( 3.f );

			bldTransform.getRotation().setX( 0.1f );
			bldTransform.getRotation().setY( 0.2f );
			bldTransform.getRotation().setZ( 0.3f );
			bldTransform.getRotation().setW( 0.4f );

			bldTransform.getScale().setX( 1.5f );
			bldTransform.getScale().setY( 2.5f );
			bldTransform.getScale().setZ( 3.5f );

			reqSetTransform.send()
			.then( [ &gadget ]( capnp::Response< AvGadget::SetTransformResults > && response ) 
			{
				REQUIRE( response.getSuccess() );
				return gadget.getTransformRequest().send();
			} )
			.then( []( capnp::Response< AvGadget::GetTransformResults > && response )
			{
				REQUIRE( response.hasTransform() );
				REQUIRE( response.hasParentPath() );

				REQUIRE( "/user/hand/right" == response.getParentPath() );

				auto & transform = response.getTransform();
				REQUIRE( 1.f == transform.getPosition().getX() );
				REQUIRE( 2.f == transform.getPosition().getY() );
				REQUIRE( 3.f == transform.getPosition().getZ() );

				REQUIRE( 0.1f == transform.getRotation().getX() );
				REQUIRE( 0.2f == transform.getRotation().getY() );
				REQUIRE( 0.3f == transform.getRotation().getZ() );
				REQUIRE( 0.4f == transform.getRotation().getW() );

				REQUIRE( 1.5f == transform.getScale().getX() );
				REQUIRE( 2.5f == transform.getScale().getY() );
				REQUIRE( 3.5f == transform.getScale().getZ() );
			})
			.wait( client.WaitScope() );
		}

		SECTION( "create model" )
		{
			auto reqCreateGadget = promCreateApp.getApp().createGadgetRequest();
			reqCreateGadget.setName( "baz" );
			auto promCreateGadget = reqCreateGadget.send();

			auto gadget = promCreateGadget.getGadget();

			auto reqCreateModel = gadget.createModelInstanceRequest();
			reqCreateModel.setUri( "https://fnord.com/fnord.glb" );
			
			auto model = reqCreateModel.send().getModel();

			auto reqSetTransform = model.setTransformRequest();

			auto & bldTransform = reqSetTransform.initTransform();
			bldTransform.getPosition().setX( 1.f );
			bldTransform.getPosition().setY( 2.f );
			bldTransform.getPosition().setZ( 3.f );

			bldTransform.getRotation().setX( 0.1f );
			bldTransform.getRotation().setY( 0.2f );
			bldTransform.getRotation().setZ( 0.3f );
			bldTransform.getRotation().setW( 0.4f );

			bldTransform.getScale().setX( 1.5f );
			bldTransform.getScale().setY( 2.5f );
			bldTransform.getScale().setZ( 3.5f );

			reqSetTransform.send()
				.then( [&model]( capnp::Response< AvModelInstance::SetTransformResults > && response )
				{
					REQUIRE( response.getSuccess() );
					return model.getTransformRequest().send();
				} )
				.then( []( capnp::Response< AvModelInstance::GetTransformResults > && response )
				{
					REQUIRE( response.hasTransform() );

					auto & transform = response.getTransform();
					REQUIRE( 1.f == transform.getPosition().getX() );
					REQUIRE( 2.f == transform.getPosition().getY() );
					REQUIRE( 3.f == transform.getPosition().getZ() );

					REQUIRE( 0.1f == transform.getRotation().getX() );
					REQUIRE( 0.2f == transform.getRotation().getY() );
					REQUIRE( 0.3f == transform.getRotation().getZ() );
					REQUIRE( 0.4f == transform.getRotation().getW() );

					REQUIRE( 1.5f == transform.getScale().getX() );
					REQUIRE( 2.5f == transform.getScale().getY() );
					REQUIRE( 3.5f == transform.getScale().getZ() );
				} )
				.wait( client.WaitScope() );

			gadget.modelsRequest().send()
				.then( []( capnp::Response< AvGadget::ModelsResults> && res ) 
				{
					REQUIRE( res.hasModels() );
					REQUIRE( res.getModels().size() == 1 );

					auto firstModel = *res.getModels().begin();
					return firstModel.getTransformRequest().send();
				} )
					.then( []( capnp::Response< AvModelInstance::GetTransformResults > && response )
				{
					REQUIRE( response.hasTransform() );

					auto & transform = response.getTransform();
					REQUIRE( 1.f == transform.getPosition().getX() );
					REQUIRE( 2.f == transform.getPosition().getY() );
					REQUIRE( 3.f == transform.getPosition().getZ() );

					REQUIRE( 0.1f == transform.getRotation().getX() );
					REQUIRE( 0.2f == transform.getRotation().getY() );
					REQUIRE( 0.3f == transform.getRotation().getZ() );
					REQUIRE( 0.4f == transform.getRotation().getW() );

					REQUIRE( 1.5f == transform.getScale().getX() );
					REQUIRE( 2.5f == transform.getScale().getY() );
					REQUIRE( 3.5f == transform.getScale().getZ() );
				} )
					.wait( client.WaitScope() );

		}
	}


	client.Stop();

	serverThread.Join();
}
