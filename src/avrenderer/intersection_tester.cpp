
#include "intersection_tester.h"

#include <aardvark/aardvark_client.h>

CIntersectionTester::CIntersectionTester()
{
}

void CIntersectionTester::addActivePanel( uint64_t globalPanelId, const glm::mat3x4 & matPanelFromUniverse )
{
	m_activePanels.push_back( { globalPanelId, matPanelFromUniverse } );
}

void CIntersectionTester::addActivePoker( uint64_t globalPokerId, const glm::vec3 & posPokerInUniverse )
{
	m_activePokers.push_back( { globalPokerId, posPokerInUniverse } );
}


void CIntersectionTester::reset()
{
	m_activePanels.clear();
	m_activePokers.clear();
}


void CIntersectionTester::updatePokerProximity( aardvark::CAardvarkClient *client )
{
	for ( auto & poker : m_activePokers )
	{
		auto req = client->Server().pushPokerProximityRequest();
		req.setPokerId( poker.globalPokerId );

		auto prox = req.initProximity( (int) m_activePanels.size() );
		int n = 0;
		for ( auto & panel : m_activePanels )
		{
			glm::vec4 vecPointInUniverse( poker.pokerPosInUniverse, 1.f );
			glm::vec4 positionOnPanel = panel.matPanelFromUniverse * vecPointInUniverse;

			// TODO: Add some kind of filtering for proximity

			prox[n].setPanelId( panel.globalPanelId );
			prox[n].setX( positionOnPanel.x );
			prox[n].setY( positionOnPanel.y );
			prox[n].setDistance( positionOnPanel.z );

			//printf( "%llu vs %llu: %g, %g, %g\n", poker.globalPokerId, panel.globalPanelId, positionOnPanel.x, positionOnPanel.y, positionOnPanel.z );
			n++;
		}

		client->addRequestToTasks( std::move( req ) );
	}
}

