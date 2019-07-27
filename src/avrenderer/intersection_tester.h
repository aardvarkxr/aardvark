#pragma once

#define GLM_FORCE_RADIANS
#define GLM_FORCE_DEPTH_ZERO_TO_ONE
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>

#include "ivrmanager.h"

#include <vector>

namespace aardvark
{
	class CAardvarkClient;
}

class CIntersectionTester
{
public:
	CIntersectionTester( );

	void addActivePanel( uint64_t globalPanelId, const glm::mat4 & matPanelFromUniverse, float zScale, EHand hand );
	void addActivePoker( uint64_t globalPokerId, const glm::vec3 & posPokerInUniverse, EHand hand );

	void reset();
	void updatePokerProximity( aardvark::CAardvarkClient *client );

private:
	struct ActivePanel_t
	{
		uint64_t globalPanelId;
		EHand hand;
		glm::mat4 matPanelFromUniverse;
		float zScale;
	};
	std::vector<ActivePanel_t> m_activePanels;

	struct ActivePoker_t
	{
		uint64_t globalPokerId;
		EHand hand;
		glm::vec3 pokerPosInUniverse;
	};
	std::vector<ActivePoker_t> m_activePokers;

};