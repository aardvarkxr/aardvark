#include <aardvark/aardvark_renderer_config.h>

void to_json( nlohmann::json & j, const CAardvarkRendererConfig& gm )
{
	j = nlohmann::json{
		{ "enableMixedReality", gm.m_mixedRealityEnabled},
		{ "mixedRealityFov", gm.m_mixedRealityFOV},
		{ "clearColor", gm.m_clearColor}
	};
}

void from_json( const nlohmann::json & j, CAardvarkRendererConfig& gm )
{
	try
	{
		j.at("enableMixedReality").get_to(gm.m_mixedRealityEnabled);
		j.at("mixedRealityFov").get_to(gm.m_mixedRealityFOV);
		j.at("clearColor").get_to(gm.m_clearColor);
	}
	catch ( nlohmann::json::exception & e )
	{
		(void)e;
		gm.m_mixedRealityEnabled = false;
		gm.m_mixedRealityFOV = 50.3f;
	}
}
