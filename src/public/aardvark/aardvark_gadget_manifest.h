#pragma once

#include <json/json.hpp>
#include <unordered_set>

class CAardvarkGadgetManifest
{
public:
	std::string m_name;
	std::unordered_set<std::string> m_permissions;
	uint32_t m_width = 16, m_height = 16;
	std::string m_modelUri;
};

void to_json( nlohmann::json & j, const CAardvarkGadgetManifest & gm );
void from_json( const nlohmann::json & j, CAardvarkGadgetManifest & gm );
