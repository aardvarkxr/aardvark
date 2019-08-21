#pragma once

#include <stdint.h>
#include <string>
#include "aardvark.capnp.h"
#include "aardvark_client.h"

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
	enum class EAvSceneGraphNodeType
	{
		Invalid = -1,

		Container = 0,	// no properties. Only contains other nodes
		Origin = 1,		// Sets the origin path for its children
		Transform = 2,	// Sets the transform for its children
		Model = 3,		// Draws a model
		Panel = 4,		// Draws a quad in the world with some texture
		Poker = 5,		// Interacts with panels on touch
		Grabbable = 6,	// Thing that can be grabbed by its handles
		Handle = 7,		// Volume that a grabbable can be grabbed by
		Grabber = 8,	// Tool that can grab the handles of grabbables
		Custom = 9,		// A custom node type. Caller must call avSetCustomNodeType
	};

	struct AvSceneContextStruct;
	typedef AvSceneContextStruct *AvSceneContext;

	AvNode::Type ProtoTypeFromApiType( EAvSceneGraphNodeType apiType );
	EAvSceneGraphNodeType ApiTypeFromProtoType( AvNode::Type protoType );

	EAvSceneGraphResult avStartSceneContext( aardvark::CAardvarkClient *pClient, AvSceneContext *pContext );
	EAvSceneGraphResult avFinishSceneContext( AvSceneContext context, AvGadget::Client *gadget, uint64_t *mainGrabbableId );

	// Starts a node as a child of the current node
	EAvSceneGraphResult avStartNode( AvSceneContext context, uint32_t id, const char *pchName, EAvSceneGraphNodeType type );
	EAvSceneGraphResult avFinishNode( AvSceneContext context );

	// 
	// These property setters modify the current node and must be called between 
	// an avStartNode and avFinishNode pair.
	//

	// valid for Origin nodes.
	EAvSceneGraphResult avSetOriginPath( AvSceneContext context, const char *pchOriginPath );

	// valid for Transform nodes
	EAvSceneGraphResult avSetTranslation( AvSceneContext context, float x, float y, float z );
	EAvSceneGraphResult avSetScale( AvSceneContext context, float x, float y, float z );
	EAvSceneGraphResult avSetRotation( AvSceneContext context, float x, float y, float z, float w );

	// valid for Model nodes
	EAvSceneGraphResult avSetModelUri( AvSceneContext context, const char *pchModelUri );

	// valid for Panel nodes
	EAvSceneGraphResult avSetPanelTextureSource( AvSceneContext context, const char *pchSourceName );
	EAvSceneGraphResult avSetPanelInteractive( AvSceneContext context, bool interactive );

	// valid for Volume nodes
	EAvSceneGraphResult avSetSphereVolume( AvSceneContext context, float radius );

	// valid for Custom nodes
	EAvSceneGraphResult avSetCustomNodeType( AvSceneContext context, const char *pchCustomNodeType );

	// valid for poker nodes
	struct PokerProximity_t
	{
		EndpointAddr_t panelId; // used for uniquely identifying panels and generating mouse events
		float x, y; // 0..1 from upper left of panel
		float distance; // distance from the panel in meters
	};
	EAvSceneGraphResult avGetNextPokerProximity( aardvark::CAardvarkClient *pClient, uint32_t pokerNodeId, PokerProximity_t *pokerProximities, uint32_t pokerProximityCount, uint32_t *usedPokerProximityCount );

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

	EAvSceneGraphResult avGetNextMouseEvent( aardvark::CAardvarkClient *pClient, uint32_t panelNodeId, PanelMouseEvent_t *mouseEvent );
	EAvSceneGraphResult avPushMouseEventFromPoker( aardvark::CAardvarkClient *pClient,
		AvGadget::Client *gadget, uint32_t pokerNodeId,
		uint64_t panelId, EPanelMouseEventType type, float x, float y );
	EAvSceneGraphResult avSendHapticEventFromPanel( aardvark::CAardvarkClient *pClient, 
		AvGadget::Client *gadget, uint32_t panelNodeId,
		float amplitude, float frequency, float duration );

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

	EAvSceneGraphResult avGetNextGrabberIntersection( aardvark::CAardvarkClient *pClient,
		uint32_t grabberNodeId,
		bool *isGrabberPressed,
		uint64_t *grabberIntersections, uint32_t intersectionArraySize,
		uint32_t *usedIntersectionCount,
		uint64_t *hooks, uint32_t hookArraySize,
		uint32_t *usedHookCount );
	EAvSceneGraphResult avGetNextGrabEvent( aardvark::CAardvarkClient *pClient,
		uint32_t grabbableNodeId, GrabEvent_t *grabEvent );
	EAvSceneGraphResult avPushGrabEventFromGrabber( aardvark::CAardvarkClient *pClient,
		AvGadget::Client *gadget, uint32_t grabberNodeId,
		uint64_t grabbableId, uint64_t hookId, EGrabEventType type );

	// tells the renderer what DXGI to use for a scene graph gadget
	EAvSceneGraphResult avUpdateDxgiTextureForGadgets( aardvark::CAardvarkClient *pClient, uint32_t *gadgetIds, uint32_t unIdCount, uint32_t unWidth, uint32_t unHeight, void *pvSharedTextureHandle, bool bInvertY );

	AvGrabEvent::Type protoTypeFromGrabType( EGrabEventType type );
	EGrabEventType grabTypeFromProtoType( AvGrabEvent::Type type );
	void protoGrabEventToLocalEvent( AvGrabEvent::Reader inEvent, GrabEvent_t *outEvent );


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
