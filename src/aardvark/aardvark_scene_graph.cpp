#include "aardvark/aardvark_scene_graph.h"

#include <vector>
#include <set>
#include <cassert>

namespace aardvark
{

	void to_json( nlohmann::json& j, const AardvarkConfig_t& config )
	{
		j = nlohmann::json {
			{ "showWindow", config.showWindow },
		};
	}

	void from_json( const nlohmann::json& j, AardvarkConfig_t& config )
	{
		j.at( "showWindow" ).get_to( config.showWindow );
	}

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
			{ "initialInterfaces", params.initialInterfaces },
			{ "epToNotify", params.epToNotify },
		};
	}

	void from_json( const nlohmann::json& j, GadgetParams_t& params )
	{
		j.at( "uri" ).get_to( params.uri );
		if(params.uri.back() == '/') params.uri.pop_back();
		try
		{
			j.at( "initialInterfaces" ).get_to( params.initialInterfaces );
		}
		catch ( nlohmann::json::exception & e )
		{
			(void)e;
			params.initialInterfaces.clear();
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
	}

}


