#pragma once

#include <aardvark/ivrmanager.h>

#define GLM_FORCE_RADIANS
#define GLM_FORCE_DEPTH_ZERO_TO_ONE
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>

#include <vector>
#include <unordered_map>
#include <openvr.h>
#include <aardvark/aardvark_scene_graph.h>
#include <aardvark/irenderer.h>

struct GrabbableCollision_t
{
	aardvark::EndpointAddr_t grabbableId;
	aardvark::EndpointAddr_t handleId;
};

enum class EHookVolume
{
	Inner = 0,
	Outer = 1,
};

struct GrabberHookState_t
{
	aardvark::EndpointAddr_t hookId;
	EHookVolume whichVolume;
};

struct GrabberCollisionState_t
{
	aardvark::EndpointAddr_t grabberGlobalId;
	EHand hand;
	std::vector<GrabbableCollision_t> grabbables;
	std::vector< GrabberHookState_t > hooks;
};

class CCollisionTester
{
public:
	CCollisionTester( );

	enum class VolumeType
	{
		Sphere,
		Box
	};
	struct Volume_t
	{
		static Volume_t createSphere( const glm::mat4 & universeFromVolume, float radius );
		static Volume_t createBox( const glm::mat4 & universeFromVolume, const AABB_t & box );
		VolumeType type;
		glm::mat4 universeFromVolume;
		AABB_t box;
		float radius;
	};

	void addGrabber_Sphere( const aardvark::EndpointAddr_t & globalGrabberId, const glm::mat4 & universeFromGrabber,
		float radius, EHand hand );
	void addGrabbableHandle_Sphere( const aardvark::EndpointAddr_t & globalGrabbableId, 
		const aardvark::EndpointAddr_t & globalHandleId, 
		const glm::mat4 & universeFromHandle,
		float radius, EHand hand );

	void addGrabbableHandle( const aardvark::EndpointAddr_t & globalGrabbableId, 
		const aardvark::EndpointAddr_t & globalHandleId, 
		Volume_t volume, EHand hand );

	void addGrabbableHandle_Box( const aardvark::EndpointAddr_t & globalGrabbableId,
		const aardvark::EndpointAddr_t & globalHandleId,
		const glm::mat4 & universeFromHandle,
		const AABB_t & box, EHand hand );

	void addHook_Sphere( const aardvark::EndpointAddr_t & globalHookId, const glm::mat4 & universeFromHook,
		float radius, EHand hand, float outerVolumeScale );
	void addHook_Aabb( const aardvark::EndpointAddr_t & globalHookId, const glm::mat4 & universeFromHook,
		const AABB_t & aabb, EHand hand, float outerVolumeScale );

	void startGrab( const aardvark::EndpointAddr_t & globalGrabberId, const aardvark::EndpointAddr_t & globalGrabbableId );
	void endGrab( const aardvark::EndpointAddr_t & globalGrabberId, const aardvark::EndpointAddr_t & globalGrabbableId );

	void reset();
	std::vector< GrabberCollisionState_t > updateGrabberIntersections();

private:

	struct ActiveGrabber_t
	{
		aardvark::EndpointAddr_t globalGrabberId;
		EHand hand;
		Volume_t volume;
	};
	std::vector<ActiveGrabber_t> m_activeGrabbers;

	struct Handle_t
	{
		aardvark::EndpointAddr_t globalHandleId;
		Volume_t volume;
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
		Volume_t volume;
		double outerVolumeScale;
	};
	std::vector<ActiveHook_t> m_activeHooks;

	std::unordered_map<aardvark::EndpointAddr_t, aardvark::EndpointAddr_t> m_activeGrabs;

};