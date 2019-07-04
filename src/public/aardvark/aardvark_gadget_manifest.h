#pragma once

#include <json/json.hpp>

class CAardvarkGadgetManifest
{
public:
	std::string m_name;
	std::vector<std::string> m_permissions;
	uint32_t m_width = 16, m_height = 16;
	std::string m_modelUri;
};

void to_json( nlohmann::json & j, const CAardvarkGadgetManifest & gm )
{
	j = nlohmann::json{
		{ "name", gm.m_name },
		{ "permissions", gm.m_permissions },
		{ "resolution", { gm.m_width, gm.m_height } },
		{"model", gm.m_modelUri }
	};
}

void from_json( const nlohmann::json & j, CAardvarkGadgetManifest & gm )
{
	j.at( "name" ).get_to( gm.m_name );
	j.at( "permissions" ).get_to( gm.m_permissions );
	try
	{
		auto & resArray = j.at( "resolution" );
		if ( resArray.is_array() && resArray.size() >= 2 )
		{
			resArray[0].get_to( gm.m_width );
			resArray[1].get_to( gm.m_height );
		}
	}
	catch (nlohmann::json::exception & e)
	{
		(void)e;
		gm.m_width = gm.m_height = 16;
	}

	j.at( "model" ).get_to( gm.m_modelUri );
}
