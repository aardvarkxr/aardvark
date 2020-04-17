#include <aardvark/aardvark_renderer_config.h>

void to_json( nlohmann::json & j, const CAardvarkRendererConfig& gm )
{
	j = nlohmann::json{
		{ "enableMixedReality", gm.m_bMixedRealityEnabled},
		{ "mixedRealityFov", gm.m_fMixedRealityFOV},
	};
}

void from_json( const nlohmann::json & j, CAardvarkRendererConfig& gm )
{
	try
	{
		j.at("enableMixedReality").get_to(gm.m_bMixedRealityEnabled);
	}
	catch ( nlohmann::json::exception & e )
	{
		(void)e;
		gm.m_bMixedRealityEnabled = false;
	}

	try
	{
		j.at("mixedRealityFov").get_to(gm.m_bMixedRealityEnabled);
	}
	catch ( nlohmann::json::exception & e )
	{
		(void)e;
		gm.m_fMixedRealityFOV = 50.3;
	}
}
