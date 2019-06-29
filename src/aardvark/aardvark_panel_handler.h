#pragma once

#include "aardvark.capnp.h"
#include "aardvark/aardvark_scene_graph.h"

#include <unordered_map>
#include <list>

namespace aardvark
{

	class AvPanelProcessorImpl final : public AvPanelProcessor::Server
	{
		typedef std::list< PanelMouseEvent_t > EventList;
	public:
		virtual ::kj::Promise<void> mouseEvent( MouseEventContext context ) override;

		EAvSceneGraphResult avGetNextMouseEvent( uint32_t panelNodeId, PanelMouseEvent_t *mouseEvent );
		
		uint64_t getLastPoker() { return m_lastPoker; }

	protected:

	private:
		std::unordered_map<uint32_t, EventList> m_events;
		uint64_t m_lastPoker = 0;
	};
}
