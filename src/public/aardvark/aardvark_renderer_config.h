#pragma once

#include <json/json.hpp>

class CAardvarkRendererConfig
{
public:
	bool m_mixedRealityEnabled = false;
	std::array<float_t, 3> m_clearColor;
	float_t m_mixedRealityFOV = 50.3f;
};

void to_json( nlohmann::json & j, const CAardvarkRendererConfig& gm );
void from_json( const nlohmann::json & j, CAardvarkRendererConfig& gm );
