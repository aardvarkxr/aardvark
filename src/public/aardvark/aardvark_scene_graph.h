#pragma once

#include <stdint.h>
#include <string>
#include <json/json.hpp>

namespace aardvark
{
	enum class EAvSceneGraphResult
	{
		Success = 0,

		InvalidParameter = 1,
		IllegalProperty = 2,
		InvalidContext = 3,
		NodeMismatch = 4,
		IdInUse = 5,
		InvalidNodeType = 6,
		RequestFailed = 7,
		NoEvents = 8,
		InsufficientBufferSize = 9,
	};

	enum class EEndpointType
	{
		Unknown = -1,
		Hub = 0,
		Gadget = 1,
		Node = 2,
		Renderer = 3,
		Monitor = 4,
	};

	struct EndpointAddr_t
	{
		EEndpointType type = EEndpointType::Unknown;
		uint32_t endpointId = 0;
		uint32_t nodeId = 0;
	};

	inline bool operator==( const EndpointAddr_t & lhs, const EndpointAddr_t & rhs )
	{
		return lhs.type == rhs.type && lhs.endpointId == rhs.endpointId
			&& lhs.nodeId == rhs.nodeId;
	}

	std::string endpointAddrToString( const EndpointAddr_t & epa );

	struct GadgetParams_t
	{
		std::string uri;
		std::string initialHook;
		std::string persistenceUuid;
		EndpointAddr_t epToNotify;
		std::string remoteUniversePath;
		std::string ownerUuid;
		std::string remotePersistenceUuid;
	};

	void to_json( nlohmann::json& j, const GadgetParams_t& gm );
	void from_json( const nlohmann::json& j, GadgetParams_t& gm );

	// valid for poker nodes
	struct PokerProximity_t
	{
		EndpointAddr_t panelId; // used for uniquely identifying panels and generating mouse events
		float x, y; // 0..1 from upper left of panel
		float distance; // distance from the panel in meters
	};

	// THIS ENUM MUST BE KEPT IN SYNC WITH AvPanelMouseEventType in aardvark.ts
	enum class EPanelMouseEventType
	{
		Unknown = 0,
		Down = 1,
		Up = 2,
		Enter = 3,
		Leave = 4,
		Move = 5,
	};

	struct PanelMouseEvent_t
	{
		EPanelMouseEventType type;
		uint64_t panelId;
		uint64_t pokerId;
		float x, y;
	};

	enum class EGrabEventType
	{
		Unknown = 0,
		EnterRange = 1,
		LeaveRange = 2,
		StartGrab = 3,
		EndGrab = 4,
		EnterHookRange = 5,
		LeaveHookRange = 6,
		RequestGrab = 7,
		RequestGrabResponse = 8,
		CancelGrab = 9,
		GrabStarted = 10,
	};

	struct GrabEvent_t
	{
		EGrabEventType type;
		uint64_t grabbableId;
		uint64_t grabberId;
		uint64_t hookId;
		uint32_t requestId;
		bool allowed;
		bool useIdentityTransform;
	};
}

namespace std
{
	template<> struct hash<aardvark::EndpointAddr_t>
	{
		typedef aardvark::EndpointAddr_t argument_type;
		typedef std::size_t result_type;
		result_type operator()( argument_type const& s ) const noexcept
		{
			return ( (size_t)s.type << 50 ) ^ ( (size_t)s.endpointId << 32 ) ^ (size_t)s.nodeId;
		}
	};
}
