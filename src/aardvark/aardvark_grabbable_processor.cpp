#include "aardvark_grabbable_processor.h"

#include <cassert>

namespace aardvark
{
	static void ProtoToLocalEvent( AvGrabEvent::Reader inEvent, GrabEvent_t *outEvent )
	{
		outEvent->grabbableId = inEvent.getGrabbableId();
		outEvent->grabberId = inEvent.getGrabberId();
		outEvent->hookId = inEvent.getHookId();
		outEvent->requestId = inEvent.getRequestId();
		outEvent->allowed = inEvent.getAllowed();
		outEvent->type = grabTypeFromProtoType( inEvent.getType() );
	}


	::kj::Promise<void> AvGrabbableProcessorImpl::grabEvent( GrabEventContext context )
	{
		uint32_t grabbableId = context.getParams().getGrabbableId();
		GrabEvent_t evt;
		ProtoToLocalEvent( context.getParams().getEvent(), &evt );
		assert( evt.type != EGrabEventType::Unknown );

		auto i = m_events.find( grabbableId );
		if ( i == m_events.end() )
		{
			m_events.insert( std::make_pair( grabbableId, EventList{} ) );
			i = m_events.find( grabbableId );
		}

		m_lastGrabber = evt.grabberId;

		i->second.push_back( evt );
		return kj::READY_NOW;
	}

	EAvSceneGraphResult AvGrabbableProcessorImpl::avGetNextGrabEvent( uint32_t grabbableNodeId, GrabEvent_t *grabEvent )
	{
		if ( !grabEvent )
		{
			return EAvSceneGraphResult::InvalidParameter;
		}

		auto i = m_events.find( grabbableNodeId );
		if ( i == m_events.end() || i->second.empty() )
		{
			return EAvSceneGraphResult::NoEvents;
		}

		*grabEvent = i->second.front();
		i->second.pop_front();

		return EAvSceneGraphResult::Success;
	}

}