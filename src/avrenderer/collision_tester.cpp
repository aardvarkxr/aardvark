
#include "collision_tester.h"

#include <aardvark/aardvark_client.h>

CCollisionTester::CCollisionTester()
{
}

void CCollisionTester::addGrabber( uint64_t globalGrabberId, const glm::mat4 & matGrabberFromUniverse,
	AvVolume::Reader & volume, bool isPressed )
{
	assert( volume.getType() == AvVolume::Type::SPHERE );
	m_activeGrabbers.push_back( { globalGrabberId, isPressed, matGrabberFromUniverse, volume.getRadius() } );
}

void CCollisionTester::addGrabbableHandle( uint64_t globalGrabbableId, const glm::mat4 & matUniverseFromHandle, 
	AvVolume::Reader & volume )
{
	assert( volume.getType() == AvVolume::Type::SPHERE );
	for ( auto & grabbable : m_activeGrabbables )
	{
		if ( grabbable.globalGrabbableId == globalGrabbableId )
		{
			grabbable.handles.push_back( { matUniverseFromHandle, volume.getRadius() } );
			return;
		}
	}

	m_activeGrabbables.push_back(
		{
			globalGrabbableId,
			{
				{ matUniverseFromHandle, volume.getRadius() }
			}
		} );
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


void CCollisionTester::updateGrabberIntersections( aardvark::CAardvarkClient *client )
{
	std::vector<uint64_t> grabbablesToSend;
	for ( auto & grabber : m_activeGrabbers )
	{
		auto req = client->Server().pushGrabIntersectionsRequest();
		req.setGrabberId( grabber.globalGrabberId );
		req.setIsGrabPressed( grabber.isPressed );

		grabbablesToSend.clear();
		for ( auto & grabbable : m_activeGrabbables )
		{
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

		auto intersections = req.initIntersections( (int)grabbablesToSend.size() );
		for( int n = 0; n < grabbablesToSend.size(); n++ )
		{
			intersections.set( n, grabbablesToSend[n] );
		}

		client->addRequestToTasks( std::move( req ) );
	}
}

