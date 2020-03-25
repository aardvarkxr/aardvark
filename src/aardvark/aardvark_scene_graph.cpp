#include "aardvark/aardvark_scene_graph.h"

#include <vector>
#include <set>
#include <cassert>

namespace aardvark
{

	std::string endpointAddrToString( const EndpointAddr_t & epa )
	{
		std::string res;
		switch ( epa.type )
		{
		case EEndpointType::Unknown:
			res = "U";
			break;
		case EEndpointType::Hub:
			res = "H";
			break;
		case EEndpointType::Gadget:
			res = "G";
			break;
		case EEndpointType::Node:
			res = "N";
			break;
		case EEndpointType::Monitor:
			res = "M";
			break;
		case EEndpointType::Renderer:
			res = "R";
			break;
		default:
			res = "?";
			break;
		}

		return res
			+ ":" + std::to_string( epa.endpointId )
			+ ":" + std::to_string( epa.nodeId );
	}

	void to_json( nlohmann::json& j, const EndpointAddr_t& epa )
	{
		j = nlohmann::json {
			{ "type", epa.type },
			{ "endpointId", epa.endpointId },
			{ "nodeId", epa.nodeId },
		};
	}

	void from_json( const nlohmann::json& j, EndpointAddr_t& epa )
	{
		j.at( "type" ).get_to( epa.type );
		j.at( "endpointId" ).get_to( epa.endpointId );
		j.at( "nodeId" ).get_to( epa.nodeId );
	}

	void to_json( nlohmann::json& j, const GadgetParams_t& params )
	{
		j = nlohmann::json {
			{ "uri", params.uri },
			{ "initialHook", params.initialHook },
			{ "persistenceUuid", params.persistenceUuid },
			{ "epToNotify", params.epToNotify },
			{ "remoteUniversePath", params.remoteUniversePath },
			{ "ownerUuid", params.ownerUuid },
		};
	}

	void from_json( const nlohmann::json& j, GadgetParams_t& params )
	{
		j.at( "uri" ).get_to( params.uri );
		j.at( "persistenceUuid" ).get_to( params.persistenceUuid);
		try
		{
			j.at( "initialHook" ).get_to( params.initialHook );
		}
		catch ( nlohmann::json::exception & e )
		{
			(void)e;
			params.initialHook.clear();
		}
		try
		{
			j.at( "epToNotify" ).get_to( params.epToNotify );
		}
		catch ( nlohmann::json::exception & e )
		{
			(void)e;
			params.epToNotify.type = EEndpointType::Unknown;
		}
		try
		{
			j.at( "remoteUniversePath" ).get_to( params.remoteUniversePath );
		}
		catch ( nlohmann::json::exception & e )
		{
			(void)e;
			params.remoteUniversePath.clear();
		}
		try
		{
			j.at( "ownerUuid" ).get_to( params.ownerUuid );
		}
		catch ( nlohmann::json::exception & e )
		{
			(void)e;
			params.ownerUuid.clear();
		}
	}

}


