#pragma once

#include <json/json.hpp>

class CAardvarkRendererConfig
{
public:
	bool m_bMixedRealityEnabled = false;
	float_t m_fMixedRealityFOV = 50.3;
};

void to_json( nlohmann::json & j, const CAardvarkRendererConfig& gm );
void from_json( const nlohmann::json & j, CAardvarkRendererConfig& gm );
