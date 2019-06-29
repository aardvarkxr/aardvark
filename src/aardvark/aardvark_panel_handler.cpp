#include "aardvark_panel_handler.h"

#include <cassert>

namespace aardvark
{
	void ProtoToLocalEvent( AvPanelMouseEvent::Reader inEvent, PanelMouseEvent_t *outEvent )
	{
		outEvent->panelId = inEvent.getPanelId();
		outEvent->pokerId = inEvent.getPokerId();
		outEvent->x = inEvent.getX();
		outEvent->y = inEvent.getY();
		switch ( inEvent.getType() )
		{
		case AvPanelMouseEvent::Type::DOWN:
			outEvent->type = EPanelMouseEventType::Down;
			break;
		case AvPanelMouseEvent::Type::UP:
			outEvent->type = EPanelMouseEventType::Up;
			break;
		case AvPanelMouseEvent::Type::ENTER:
			outEvent->type = EPanelMouseEventType::Enter;
			break;
		case AvPanelMouseEvent::Type::LEAVE:
			outEvent->type = EPanelMouseEventType::Leave;
			break;
		case AvPanelMouseEvent::Type::MOVE:
			outEvent->type = EPanelMouseEventType::Move;
			break;

		default:
			outEvent->type = EPanelMouseEventType::Unknown;
		}
	}


	::kj::Promise<void> AvPanelProcessorImpl::mouseEvent( MouseEventContext context )
	{
		uint32_t panelId = context.getParams().getPanelId();
		PanelMouseEvent_t evt;
		ProtoToLocalEvent( context.getParams().getEvent(), &evt );
		assert( evt.type != EPanelMouseEventType::Unknown );

		auto i = m_events.find( panelId );
		if ( i == m_events.end() )
		{
			m_events.insert( std::make_pair( panelId, EventList{} ) );
			i = m_events.find( panelId );
		}

		m_lastPoker = evt.pokerId;

		i->second.push_back( evt );
		return kj::READY_NOW;
	}

	EAvSceneGraphResult AvPanelProcessorImpl::avGetNextMouseEvent( uint32_t panelId, PanelMouseEvent_t *mouseEvent )
	{
		if ( !mouseEvent )
		{
			return EAvSceneGraphResult::InvalidParameter;
		}

		auto i = m_events.find( panelId );
		if ( i == m_events.end() || i->second.empty() )
		{
			return EAvSceneGraphResult::NoEvents;
		}

		*mouseEvent = i->second.front();
		i->second.pop_front();

		return EAvSceneGraphResult::Success;
	}

}