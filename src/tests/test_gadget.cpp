// ---------------------------------------------------------------------------
// Purpose: Test app API in Aardvark
// ---------------------------------------------------------------------------
#include <catch/catch.hpp>
#include <aardvark/aardvark.h>

using namespace aardvark;

TEST_CASE( "Aardvark gadgets", "[gadgets]" )
{
	AppHandle_t hApp = nullptr;
	REQUIRE( avCreateApp( "fnord", &hApp ) == AardvarkError_None );
	REQUIRE( hApp != nullptr );

	SECTION( "Simple Gadget" )
	{
		GadgetHandle_t hGadget = nullptr;
		REQUIRE( avCreateGadget( hApp, "mygadget", &hGadget ) == AardvarkError_None );
		REQUIRE( hGadget != nullptr );

		REQUIRE( avDestroyGadget( hGadget ) == AardvarkError_None );

	}

	REQUIRE( avDestroyApp( hApp ) == AardvarkError_None );
}
