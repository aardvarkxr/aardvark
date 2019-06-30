#pragma once

#include "aardvark.capnp.h"
#include "aardvark/aardvark_scene_graph.h"

#include <unordered_map>
#include <list>

namespace aardvark
{

	class AvGrabbableProcessorImpl final : public AvGrabbableProcessor::Server
	{
		typedef std::list< GrabEvent_t > EventList;
	public:
		virtual ::kj::Promise<void> grabEvent( GrabEventContext context ) override;

		EAvSceneGraphResult avGetNextGrabEvent( uint32_t grabbableNodeId, GrabEvent_t *grabEvent );
		
		uint64_t getLastGrabber() { return m_lastGrabber; }

	protected:

	private:
		std::unordered_map<uint32_t, EventList> m_events;
		uint64_t m_lastGrabber = 0;
	};
}
