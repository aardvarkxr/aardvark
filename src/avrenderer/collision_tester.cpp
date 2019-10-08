
#include "collision_tester.h"

CCollisionTester::CCollisionTester()
{
}

void CCollisionTester::addGrabber_Sphere( const aardvark::EndpointAddr_t & globalGrabberId, const glm::mat4 & universeFromGrabber,
	float radius, EHand hand, bool isPressed )
{
	m_activeGrabbers.push_back( { globalGrabberId, hand, isPressed, Volume_t::createSphere( universeFromGrabber, radius ) } );
}

CCollisionTester::Volume_t CCollisionTester::Volume_t::createSphere( const glm::mat4 & universeFromVolume, float radius )
{
	Volume_t volume;
	volume.type = VolumeType::Sphere;
	volume.universeFromVolume = universeFromVolume;
	volume.radius = radius;
	return volume;
}

CCollisionTester::Volume_t CCollisionTester::Volume_t::createBox( const glm::mat4 & universeFromVolume, const AABB_t & box )
{
	Volume_t volume;
	volume.type = VolumeType::Box;
	volume.universeFromVolume = universeFromVolume;
	volume.box = box;
	return volume;
}

void CCollisionTester::addGrabbableHandle_Sphere( const aardvark::EndpointAddr_t & globalGrabbableId, 
	const aardvark::EndpointAddr_t & globalHandleId,
	const glm::mat4 & universeFromHandle,
	float radius, EHand hand )
{
	addGrabbableHandle( globalGrabbableId, globalHandleId, Volume_t::createSphere( universeFromHandle, radius ), hand );
}

void CCollisionTester::addGrabbableHandle( const aardvark::EndpointAddr_t & globalGrabbableId, 
	const aardvark::EndpointAddr_t & globalHandleId, 
	Volume_t volume, EHand hand )
{
	for ( auto & grabbable : m_activeGrabbables )
	{
		if ( grabbable.globalGrabbableId == globalGrabbableId )
		{
			grabbable.handles.push_back( { globalHandleId, volume } );
			return;
		}
	}

	m_activeGrabbables.push_back(
		{
			globalGrabbableId,
			hand,
			{
				{ globalHandleId, volume }
			}
		} );
}

void CCollisionTester::addGrabbableHandle_Box( const aardvark::EndpointAddr_t & globalGrabbableId,
	const aardvark::EndpointAddr_t & globalHandleId,
	const glm::mat4 & universeFromHandle,
	const AABB_t & box, EHand hand )
{
	addGrabbableHandle( globalGrabbableId, globalHandleId, Volume_t::createBox( universeFromHandle, box), hand );
}


void CCollisionTester::addHook_Sphere( const aardvark::EndpointAddr_t & globalHookId, const glm::mat4 & universeFromHook,
	float radius, EHand hand )
{
	m_activeHooks.push_back( { globalHookId, hand, Volume_t::createSphere( universeFromHook, radius ) } );
}


void CCollisionTester::reset()
{
	m_activeGrabbers.clear();
	m_activeGrabbables.clear();
	m_activeHooks.clear();
}

bool spheresIntersect( const CCollisionTester::Volume_t & v1, const CCollisionTester::Volume_t &v2 )
{
	glm::vec4 zero( 0, 0, 0, 1.f );
	glm::vec3 v1Center( v1.universeFromVolume * zero );
	glm::vec3 v2Center( v2.universeFromVolume * zero );
	float dist = glm::length( v1Center - v2Center );
	return dist < ( v1.radius + v2.radius );
}

template<typename T>
T Max( T v1, T v2 )
{
	if ( v1 > v2 )
		return v1;
	else
		return v2;
}

bool sphereBoxIntersect( const CCollisionTester::Volume_t & sphere, const CCollisionTester::Volume_t & box )
{
	glm::mat4 boxFromSphere = glm::inverse( box.universeFromVolume ) * sphere.universeFromVolume;
	glm::vec3 sphereCenter = glm::vec3( boxFromSphere * glm::vec4( 0, 0, 0, 1 ) );

	float xDist = Max( Max( box.box.xMin - sphereCenter.x, sphereCenter.x - box.box.xMax ), 0.f );
	float yDist = Max( Max( box.box.yMin - sphereCenter.y, sphereCenter.y - box.box.yMax ), 0.f );
	float zDist = Max( Max( box.box.zMin - sphereCenter.z, sphereCenter.z - box.box.zMax ), 0.f );
	return ( xDist * xDist + yDist * yDist + zDist * zDist ) <= sphere.radius;
}


bool volumesIntersect( const CCollisionTester::Volume_t & v1, const CCollisionTester::Volume_t &v2 )
{
	if ( v1.type == CCollisionTester::VolumeType::Sphere && v2.type == CCollisionTester::VolumeType::Sphere )
	{
		return spheresIntersect( v1, v2 );
	}
	if ( v1.type == CCollisionTester::VolumeType::Sphere && v2.type == CCollisionTester::VolumeType::Box )
	{
		return sphereBoxIntersect( v1, v2 );
	}
	if ( v2.type == CCollisionTester::VolumeType::Sphere && v1.type == CCollisionTester::VolumeType::Box )
	{
		return sphereBoxIntersect( v2, v1 );
	}

	// TODO: probably need box/box intersection eventually

	return false;
}

void CCollisionTester::startGrab( const aardvark::EndpointAddr_t & globalGrabberId, const aardvark::EndpointAddr_t & globalGrabbableId )
{
	m_activeGrabs.insert_or_assign( globalGrabberId, globalGrabbableId );
}


void CCollisionTester::endGrab( const aardvark::EndpointAddr_t & globalGrabberId, const aardvark::EndpointAddr_t & globalGrabbableId )
{
	auto i = m_activeGrabs.find( globalGrabberId );
	if ( m_activeGrabs.end() != i && i->second == globalGrabbableId )
	{
		m_activeGrabs.erase( i );
	}
}


std::vector<GrabberCollisionState_t> CCollisionTester::updateGrabberIntersections()
{
	std::vector<GrabberCollisionState_t> results;
	for ( auto & grabber : m_activeGrabbers )
	{
		GrabberCollisionState_t grabberState;
		grabberState.grabberGlobalId = grabber.globalGrabberId;
		grabberState.isPressed = grabber.isPressed;

		aardvark::EndpointAddr_t currentlyGrabbedGrabbableId = { aardvark::EEndpointType::Unknown, 0, 0 };
		auto activeGrab = m_activeGrabs.find( grabber.globalGrabberId );
		if ( activeGrab != m_activeGrabs.end() )
		{
			currentlyGrabbedGrabbableId = activeGrab->second;
		}

		for ( auto & grabbable : m_activeGrabbables )
		{
			if ( grabbable.globalGrabbableId == currentlyGrabbedGrabbableId )
			{
				grabberState.grabbables.push_back( 
					{
						grabbable.globalGrabbableId,
						grabbable.handles.front().globalHandleId,
					} );
				continue;
			}

			if ( isSameHand( grabber.hand, grabbable.hand ) )
				continue;

			for ( auto & handle : grabbable.handles )
			{
				if ( volumesIntersect( grabber.volume, handle.volume ) )
				{
					grabberState.grabbables.push_back( 
						{
							grabbable.globalGrabbableId,
							handle.globalHandleId
						} );
					break;
				}
			}
		}

		for ( auto & hook : m_activeHooks)
		{
			if ( isSameHand( grabber.hand, hook.hand ) )
				continue;

			if ( volumesIntersect( grabber.volume, hook.volume ) )
			{
				grabberState.hooks.push_back( hook.globalHookId );
				break;
			}
		}

		results.push_back( std::move( grabberState ) );
	}

	return results;
}


