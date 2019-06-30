#pragma once

#include "aardvark.capnp.h"
#include "aardvark/aardvark_scene_graph.h"

#include <tools/capnprototools.h>

#include <unordered_map>
#include <vector>

namespace aardvark
{

	class AvGrabberProcessorImpl final : public AvGrabberProcessor::Server
	{
	public:
		virtual ~AvGrabberProcessorImpl() {}

		virtual ::kj::Promise<void> updateGrabberIntersections( UpdateGrabberIntersectionsContext context ) override;

		EAvSceneGraphResult avGetNextGrabberIntersection( uint32_t grabberNodeId,
			bool *isGrabberPressed,
			uint64_t *grabberIntersections, uint32_t intersectionArraySize,
			uint32_t *usedIntersectionCount );
		
	protected:

	private:
		struct GrabberIntersections_t
		{
			bool isPressed = false;
			std::vector<uint64_t> intersectingGrabbables;
		};

		std::unordered_map<uint32_t, GrabberIntersections_t> m_intersections;
	};
}
