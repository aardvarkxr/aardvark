
#include "intersection_tester.h"

CIntersectionTester::CIntersectionTester()
{
}

void CIntersectionTester::addActivePanel( const aardvark::EndpointAddr_t & globalPanelId, const glm::mat4 & matPanelFromUniverse,
	float zScale, EHand hand )
{
	assert( zScale > 0.f );
	m_activePanels.push_back( { globalPanelId, hand, matPanelFromUniverse, zScale } );
}

void CIntersectionTester::addActivePoker( const aardvark::EndpointAddr_t & globalPokerId, const glm::vec3 & posPokerInUniverse,
	EHand hand, bool isPressed )
{
	m_activePokers.push_back( { globalPokerId, hand, isPressed, posPokerInUniverse } );
}


void CIntersectionTester::reset()
{
	m_activePanels.clear();
	m_activePokers.clear();
}

std::vector<PokerState_t> CIntersectionTester::updatePokerProximity()
{
	std::vector<PokerState_t> proxToSend;
	for ( auto & poker : m_activePokers )
	{
		PokerState_t pokerState;
		pokerState.pokerId = poker.globalPokerId;
		pokerState.isPressed = poker.isPressed;

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

			pokerState.panels.push_back( { panel.globalPanelId, u, v, dist } );
		}

		proxToSend.push_back( std::move( pokerState ) );
	}

	return proxToSend;
}

