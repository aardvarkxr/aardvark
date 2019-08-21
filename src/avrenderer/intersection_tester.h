#pragma once

#define GLM_FORCE_RADIANS
#define GLM_FORCE_DEPTH_ZERO_TO_ONE
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>

#include <aardvark/ivrmanager.h>
#include <aardvark/aardvark_scene_graph.h>

#include <vector>

struct PokerState_t
{
	aardvark::EndpointAddr_t pokerId;
	std::vector<aardvark::PokerProximity_t> panels;
};

class CIntersectionTester
{
public:
	CIntersectionTester( );

	void addActivePanel( const aardvark::EndpointAddr_t & globalPanelId, const glm::mat4 & matPanelFromUniverse, float zScale, EHand hand );
	void addActivePoker( const aardvark::EndpointAddr_t & globalPokerId, const glm::vec3 & posPokerInUniverse, EHand hand );

	void reset();
	std::vector<PokerState_t> updatePokerProximity();

private:
	struct ActivePanel_t
	{
		aardvark::EndpointAddr_t globalPanelId;
		EHand hand;
		glm::mat4 matPanelFromUniverse;
		float zScale;
	};
	std::vector<ActivePanel_t> m_activePanels;

	struct ActivePoker_t
	{
		aardvark::EndpointAddr_t globalPokerId;
		EHand hand;
		glm::vec3 pokerPosInUniverse;
	};
	std::vector<ActivePoker_t> m_activePokers;

};