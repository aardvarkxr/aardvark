#pragma once

#include "aardvark.capnp.h"
#include "aardvark/aardvark_scene_graph.h"

#include <tools/capnprototools.h>

#include <unordered_map>
#include <vector>

namespace aardvark
{

	class AvPokerProcessorImpl final : public AvPokerProcessor::Server
	{
		typedef std::vector< tools::OwnCapnp<AvPanelProximity> > ProximityList;
	public:
		virtual ~AvPokerProcessorImpl() {}

		virtual ::kj::Promise<void> updatePanelProximity( UpdatePanelProximityContext context ) override;

		EAvSceneGraphResult avGetNextPokerProximity( uint32_t pokerNodeId,
			PokerProximity_t *pokerProximities, uint32_t pokerProximityCount,
			uint32_t *usedPokerProximityCount );
		
	protected:

	private:
		std::unordered_map<uint32_t, ProximityList> m_proximities;
	};
}
