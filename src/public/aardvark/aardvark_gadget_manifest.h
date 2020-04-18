#pragma once

#include <json/json.hpp>
#include <unordered_set>

class CAardvarkManifestExtension
{
public:
	std::unordered_set<std::string> m_permissions;
	uint32_t m_width = 16, m_height = 16;
};

void to_json( nlohmann::json& j, const CAardvarkManifestExtension& gm );
void from_json( const nlohmann::json& j, CAardvarkManifestExtension& gm );

class CWebAppManifest
{
public:
	std::string m_name;
	std::string m_type;
	CAardvarkManifestExtension m_aardvark;
};

void to_json( nlohmann::json & j, const CWebAppManifest& gm );
void from_json( const nlohmann::json & j, CWebAppManifest& gm );
