#include "aardvark/aardvark_gadget_manifest.h"

void to_json( nlohmann::json& j, const CAardvarkManifestExtension& gm )
{
	j = nlohmann::json {
		{ "permissions", gm.m_permissions },
		{ "browserWidth", gm.m_width },
		{ "browserHeight", gm.m_height },
	};
}

void from_json( const nlohmann::json& j, CAardvarkManifestExtension& gm )
{
	j.at( "permissions" ).get_to( gm.m_permissions );
	try
	{
		j.at( "browserWidth" ).get_to( gm.m_width );
		j.at( "browserHeight" ).get_to( gm.m_height );
	}
	catch ( nlohmann::json::exception& e )
	{
		(void)e;
		gm.m_width = gm.m_height = 16;
	}
}

void to_json( nlohmann::json & j, const CWebAppManifest& gm )
{
	j = nlohmann::json{
		{ "name", gm.m_name },
		{ "type", gm.m_type },
		{ "aardvark", gm.m_aardvark },
	};
}

void from_json( const nlohmann::json & j, CWebAppManifest& gm )
{
	j.at( "name" ).get_to( gm.m_name );
	j.at( "xr_type" ).get_to( gm.m_type );
	j.at( "aardvark" ).get_to( gm.m_aardvark);
}
