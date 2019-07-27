
#include "intersection_tester.h"

#include <aardvark/aardvark_client.h>

CIntersectionTester::CIntersectionTester()
{
}

void CIntersectionTester::addActivePanel( uint64_t globalPanelId, const glm::mat4 & matPanelFromUniverse, 
	float zScale, EHand hand )
{
	assert( zScale > 0.f );
	m_activePanels.push_back( { globalPanelId, hand, matPanelFromUniverse, zScale } );
}

void CIntersectionTester::addActivePoker( uint64_t globalPokerId, const glm::vec3 & posPokerInUniverse, 
	EHand hand )
{
	m_activePokers.push_back( { globalPokerId, hand, posPokerInUniverse } );
}


void CIntersectionTester::reset()
{
	m_activePanels.clear();
	m_activePokers.clear();
}

struct ProximityToSend_t
{
	uint64_t panelId;
	float u, v, distance;
};

void CIntersectionTester::updatePokerProximity( aardvark::CAardvarkClient *client )
{
	std::vector<ProximityToSend_t> proxToSend;
	for ( auto & poker : m_activePokers )
	{
		auto req = client->Server().pushPokerProximityRequest();
		req.setPokerId( poker.globalPokerId );

		proxToSend.clear();
		for ( auto & panel : m_activePanels )
		{
			if ( isSameHand( poker.hand, panel.hand ) )
				continue;

			glm::vec4 vecPointInUniverse( poker.pokerPosInUniverse, 1.f );
			glm::vec4 positionOnPanel = panel.matPanelFromUniverse * vecPointInUniverse;

			float u = positionOnPanel.x + 0.5f;
			float v = positionOnPanel.z + 0.5f;
			float dist = positionOnPanel.y * panel.zScale;

			if ( u < 0.1f || u > 1.1f || v < 0.1f || v > 1.1f
				|| dist < -0.1f || dist > 0.2f )
				continue;

			proxToSend.push_back( { panel.globalPanelId, u, v, dist } );
		}

		auto prox = req.initProximity( (int)proxToSend.size() );
		for( int n = 0; n < proxToSend.size(); n++ )
		{
			ProximityToSend_t & toSend = proxToSend[n];
			prox[n].setPanelId( toSend.panelId );
			prox[n].setX( toSend.u );
			prox[n].setY( toSend.v );
			prox[n].setDistance( toSend.distance );
		}

		client->addRequestToTasks( std::move( req ) );
	}
}

