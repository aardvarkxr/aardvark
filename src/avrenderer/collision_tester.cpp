
#include "collision_tester.h"

#include <aardvark/aardvark_client.h>

CCollisionTester::CCollisionTester()
{
}

void CCollisionTester::addGrabber_Sphere( uint64_t globalGrabberId, const glm::mat4 & grabberFromUniverse,
	float radius, EHand hand, bool isPressed )
{
	m_activeGrabbers.push_back( { globalGrabberId, hand, isPressed, grabberFromUniverse, radius } );
}

void CCollisionTester::addGrabbableHandle_Sphere( uint64_t globalGrabbableId, const glm::mat4 & universeFromHandle,
	float radius, EHand hand )
{
	for ( auto & grabbable : m_activeGrabbables )
	{
		if ( grabbable.globalGrabbableId == globalGrabbableId )
		{
			grabbable.handles.push_back( { universeFromHandle, radius } );
			return;
		}
	}

	m_activeGrabbables.push_back(
		{
			globalGrabbableId, 
			hand,
			{
				{ universeFromHandle, radius }
			}
		} );
}

void CCollisionTester::addHook_Sphere( uint64_t globalHookId, const glm::mat4 & universeFromHook,
	float radius, EHand hand )
{
	m_activeHooks.push_back( { globalHookId, hand, universeFromHook, radius } );
}


void CCollisionTester::reset()
{
	m_activeGrabbers.clear();
	m_activeGrabbables.clear();
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


void CCollisionTester::startGrab( uint64_t globalGrabberId, uint64_t globalGrabbableId )
{
	m_activeGrabs.insert_or_assign( globalGrabberId, globalGrabbableId );
}


void CCollisionTester::endGrab( uint64_t globalGrabberId, uint64_t globalGrabbableId )
{
	auto i = m_activeGrabs.find( globalGrabberId );
	if ( m_activeGrabs.end() != i && i->second == globalGrabbableId )
	{
		m_activeGrabs.erase( i );
	}
}


void CCollisionTester::updateGrabberIntersections( aardvark::CAardvarkClient *client )
{
	std::vector<uint64_t> grabbablesToSend;
	std::vector<uint64_t> hooksToSend;
	for ( auto & grabber : m_activeGrabbers )
	{
		auto req = client->Server().pushGrabIntersectionsRequest();
		req.setGrabberId( grabber.globalGrabberId );
		req.setIsGrabPressed( grabber.isPressed );

		uint64_t currentlyGrabbedGrabbableId = 0;
		auto activeGrab = m_activeGrabs.find( grabber.globalGrabberId );
		if ( activeGrab != m_activeGrabs.end() )
		{
			currentlyGrabbedGrabbableId = activeGrab->second;
		}

		grabbablesToSend.clear();
		for ( auto & grabbable : m_activeGrabbables )
		{
			if ( isSameHand( grabber.hand, grabbable.hand ) )
				continue;

			if ( grabbable.globalGrabbableId == currentlyGrabbedGrabbableId )
			{
				grabbablesToSend.push_back( grabbable.globalGrabbableId );
				continue;
			}

			for ( auto & handle : grabbable.handles )
			{
				if ( SpheresIntersect( grabber.matGrabberFromUniverse, grabber.radius,
					handle.universeFromHandle, handle.radius ) )
				{
					grabbablesToSend.push_back( grabbable.globalGrabbableId );
					break;
				}
			}
		}


		hooksToSend.clear();
		for ( auto & hook : m_activeHooks)
		{
			if ( isSameHand( grabber.hand, hook.hand ) )
				continue;

			if ( SpheresIntersect( grabber.matGrabberFromUniverse, grabber.radius,
				hook.universeFromHook, hook.radius ) )
			{
				hooksToSend.push_back( hook.globalHookId );
				break;
			}
		}

		auto intersections = req.initIntersections( (int)grabbablesToSend.size() );
		for( int n = 0; n < grabbablesToSend.size(); n++ )
		{
			intersections.set( n, grabbablesToSend[n] );
		}
		auto hooks = req.initHooks( (int)hooksToSend.size() );
		for ( int n = 0; n < hooksToSend.size(); n++ )
		{
			hooks.set( n, hooksToSend[n] );
		}

		client->addRequestToTasks( std::move( req ) );
	}
}


