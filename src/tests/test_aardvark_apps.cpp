// ---------------------------------------------------------------------------
// Purpose: Test app API in Aardvark
// ---------------------------------------------------------------------------
#include <catch/catch.hpp>
#include <aardvark/aardvark_apps.h>

using namespace aardvark;

TEST_CASE( "Aardvark apps", "[apps]" ) 
{
	AppHandle_t appHandle = nullptr;
	REQUIRE( avCreateApp( "fnord", &appHandle ) == AardvarkError_None );
	REQUIRE( appHandle != nullptr );
	REQUIRE( avDestroyApp( appHandle ) == AardvarkError_None );
}
