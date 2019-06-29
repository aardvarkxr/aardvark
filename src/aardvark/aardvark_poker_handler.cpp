#include "aardvark_poker_handler.h"


namespace aardvark
{
	::kj::Promise<void> AvPokerProcesserImpl::updatePanelProximity( UpdatePanelProximityContext context ) 
	{
		uint32_t pokerId = context.getParams().getPokerId();
		ProximityList prox;
		auto msgProx = context.getParams().getProximity();
		for ( auto & p : msgProx )
		{
			prox.push_back( tools::newOwnCapnp( p ) );
		}

		m_proximities.insert_or_assign( pokerId, std::move( prox ) );
		return kj::READY_NOW;
	}

	EAvSceneGraphResult AvPokerProcesserImpl::avGetNextPokerProximity( uint32_t pokerNodeId,
		PokerProximity_t *pokerProximities, uint32_t pokerProximityCount,
		uint32_t *usedPokerProximityCount )
	{
		if ( pokerNodeId == 0 || !usedPokerProximityCount )
		{
			return EAvSceneGraphResult::InvalidParameter;
		}

		auto pokerList = m_proximities.find( pokerNodeId );
		if ( pokerList == m_proximities.end() )
		{
			return EAvSceneGraphResult::NoEvents;
		}

		*usedPokerProximityCount = (uint32_t)pokerList->second.size();
		if ( pokerList->second.size() > pokerProximityCount )
		{
			return EAvSceneGraphResult::InsufficientBufferSize;
		}

		for ( size_t n = 0; n < pokerList->second.size(); n++ )
		{
			tools::OwnCapnp<AvPanelProximity> & proxIn = pokerList->second[n];
			PokerProximity_t & proxOut = pokerProximities[n];

			proxOut.panelId = proxIn.getPanelId();
			proxOut.x = proxIn.getX();
			proxOut.y = proxIn.getY();
			proxOut.distance = proxIn.getDistance();
		}
		return EAvSceneGraphResult::Success;
	}

}