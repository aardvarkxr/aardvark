#pragma once

#include "aardvark.capnp.h"
#include <aardvark/ivrmanager.h>

#define GLM_FORCE_RADIANS
#define GLM_FORCE_DEPTH_ZERO_TO_ONE
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>

#include <vector>
#include <unordered_map>
#include <openvr.h>
#include <aardvark/aardvark_scene_graph.h>

namespace aardvark
{
	class CAardvarkClient;
}

struct GrabberCollisionState_t
{
	aardvark::EndpointAddr_t grabberGlobalId;
	bool isPressed;
	std::vector<aardvark::EndpointAddr_t> grabbables;
	std::vector<aardvark::EndpointAddr_t> hooks;
};

class CCollisionTester
{
public:
	CCollisionTester( );

	void addGrabber_Sphere( const aardvark::EndpointAddr_t & globalGrabberId, const glm::mat4 & grabberFromUniverse,
		float radius, EHand hand, bool isPressed );
	void addGrabbableHandle_Sphere( const aardvark::EndpointAddr_t & globalGrabbableId, const glm::mat4 & universeFromHandle,
		float radius, EHand hand );

	void addHook_Sphere( const aardvark::EndpointAddr_t & globalHookId, const glm::mat4 & universeFromHook,
		float radius, EHand hand );

	void startGrab( const aardvark::EndpointAddr_t & globalGrabberId, const aardvark::EndpointAddr_t & globalGrabbableId );
	void endGrab( const aardvark::EndpointAddr_t & globalGrabberId, const aardvark::EndpointAddr_t & globalGrabbableId );

	void reset();
	std::vector< GrabberCollisionState_t > updateGrabberIntersections();

private:
	struct ActiveGrabber_t
	{
		aardvark::EndpointAddr_t globalGrabberId;
		EHand hand;
		bool isPressed;
		glm::mat4 matGrabberFromUniverse;
		float radius;
	};
	std::vector<ActiveGrabber_t> m_activeGrabbers;

	struct Handle_t
	{
		glm::mat4 universeFromHandle;
		float radius;
	};

	struct ActiveGrabbable_t
	{
		aardvark::EndpointAddr_t globalGrabbableId;
		EHand hand;
		std::vector<Handle_t> handles;
	};
	std::vector<ActiveGrabbable_t> m_activeGrabbables;

	struct ActiveHook_t
	{
		aardvark::EndpointAddr_t globalHookId;
		EHand hand;
		glm::mat4 universeFromHook;
		float radius;
	};
	std::vector<ActiveHook_t> m_activeHooks;

	std::unordered_map<aardvark::EndpointAddr_t, aardvark::EndpointAddr_t> m_activeGrabs;

};