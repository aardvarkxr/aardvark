#include "aardvark/aardvark_gadget_manifest.h"

void to_json( nlohmann::json & j, const CAardvarkGadgetManifest & gm )
{
	j = nlohmann::json{
		{ "name", gm.m_name },
		{ "permissions", gm.m_permissions },
		{ "width", gm.m_width },
		{ "height", gm.m_height },
		{"model", gm.m_modelUri }
	};
}

void from_json( const nlohmann::json & j, CAardvarkGadgetManifest & gm )
{
	j.at( "name" ).get_to( gm.m_name );
	j.at( "permissions" ).get_to( gm.m_permissions );
	try
	{
		j.at( "width" ).get_to( gm.m_width );
		j.at( "height" ).get_to( gm.m_height );
	}
	catch ( nlohmann::json::exception & e )
	{
		(void)e;
		gm.m_width = gm.m_height = 16;
	}

	j.at( "model" ).get_to( gm.m_modelUri );
}
