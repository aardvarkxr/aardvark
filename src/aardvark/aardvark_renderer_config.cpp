#include <aardvark/aardvark_renderer_config.h>

void to_json( nlohmann::json & j, const CAardvarkRendererConfig& gm )
{
	j = nlohmann::json{
		{ "enable_mixed_reality", gm.m_bMixedRealityEnabled},
		{ "mixed_reality_fov", gm.m_fMixedRealityFOV},
	};
}

void from_json( const nlohmann::json & j, CAardvarkRendererConfig& gm )
{
	try
	{
		j.at("enable_mixed_reality").get_to(gm.m_bMixedRealityEnabled);
	}
	catch ( nlohmann::json::exception & e )
	{
		(void)e;
		gm.m_bMixedRealityEnabled = false;
	}

	try
	{
		j.at("mixed_reality_fov").get_to(gm.m_bMixedRealityEnabled);
	}
	catch ( nlohmann::json::exception & e )
	{
		(void)e;
		gm.m_fMixedRealityFOV = 50.3;
	}
}
