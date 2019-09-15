
#include "collision_tester.h"

CCollisionTester::CCollisionTester()
{
}

void CCollisionTester::addGrabber_Sphere( const aardvark::EndpointAddr_t & globalGrabberId, const glm::mat4 & grabberFromUniverse,
	float radius, EHand hand, bool isPressed )
{
	m_activeGrabbers.push_back( { globalGrabberId, hand, isPressed, grabberFromUniverse, radius } );
}

void CCollisionTester::addGrabbableHandle_Sphere( const aardvark::EndpointAddr_t & globalGrabbableId, 
	const aardvark::EndpointAddr_t & globalHandleId,
	const glm::mat4 & universeFromHandle,
	float radius, EHand hand )
{
	for ( auto & grabbable : m_activeGrabbables )
	{
		if ( grabbable.globalGrabbableId == globalGrabbableId )
		{
			grabbable.handles.push_back( { globalHandleId, universeFromHandle, radius } );
			return;
		}
	}

	m_activeGrabbables.push_back(
		{
			globalGrabbableId, 
			hand,
			{
				{ globalHandleId, universeFromHandle, radius }
			}
		} );
}

void CCollisionTester::addHook_Sphere( const aardvark::EndpointAddr_t & globalHookId, const glm::mat4 & universeFromHook,
	float radius, EHand hand )
{
	m_activeHooks.push_back( { globalHookId, hand, universeFromHook, radius } );
}


void CCollisionTester::reset()
{
	m_activeGrabbers.clear();
	m_activeGrabbables.clear();
	m_activeHooks.clear();
}

bool SpheresIntersect( const glm::mat4 & grabberFromUniverse, float grabberRadius,
	const glm::mat4 & universeFromHandle, float handleRadius )
{
	glm::mat grabberFromHandle = grabberFromUniverse * universeFromHandle;
	glm::vec4 zero( 0, 0, 0, 1.f );
	glm::vec4 offset = grabberFromHandle * zero;
	float dist = glm::length( glm::vec3( offset ) );
	return dist < ( grabberRadius + handleRadius );
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
				if ( SpheresIntersect( grabber.matGrabberFromUniverse, grabber.radius,
					handle.universeFromHandle, handle.radius ) )
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

			if ( SpheresIntersect( grabber.matGrabberFromUniverse, grabber.radius,
				hook.universeFromHook, hook.radius ) )
			{
				grabberState.hooks.push_back( hook.globalHookId );
				break;
			}
		}

		results.push_back( std::move( grabberState ) );
	}

	return results;
}


