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

}


