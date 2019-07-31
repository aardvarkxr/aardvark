#include "aardvark_gadget_impl.h"
#include "aardvark/aardvark_server.h"
#include "framestructs.h"

#include <algorithm>
#include <assert.h>

using namespace aardvark;

CAardvarkGadget::CAardvarkGadget( uint32_t clientId, const std::string & sName, AvServerImpl *pParentServer )
{
	m_clientId = clientId;

	static uint32_t s_uniqueId = 1;
	m_id = s_uniqueId++;

	m_sName = sName;
	m_pParentServer = pParentServer;
}


::kj::Promise<void> CAardvarkGadget::destroy( DestroyContext context )
{
	m_pParentServer->removeGadget( this );
	context.getResults().setSuccess( true );
	return kj::READY_NOW;
}

::kj::Promise<void> CAardvarkGadget::name( NameContext context )
{
	context.getResults().setName( m_sName );
	return kj::READY_NOW;
}


::kj::Promise<void> CAardvarkGadget::mainGrabbableId( MainGrabbableIdContext context )
{
	uint64_t globalId = 0;
	for ( auto & node : this->m_sceneGraph.getNodes() )
	{
		if ( node.getNode().getType() == AvNode::Type::GRABBABLE )
		{
			globalId = ( (uint64_t)this->m_id << 32 ) | (uint64_t)node.getNode().getId();
		}
	}

	context.getResults().setGlobalId( globalId );
	return kj::READY_NOW;
}


::kj::Promise<void> CAardvarkGadget::updateSceneGraph( UpdateSceneGraphContext context )
{
	auto root = context.getParams().getRoot();
	m_panelProcessors.clear();
	m_pokerProcessors.clear();
	m_grabberProcessors.clear();
	m_grabbableProcessors.clear();
	for ( auto node : root.getNodes() )
	{
		auto realNode = node.getNode();
		switch ( realNode.getType() )
		{
		case AvNode::Type::PANEL:
			m_panelProcessors.insert_or_assign( realNode.getId(), root.getPanelProcessor() );
			break;

		case AvNode::Type::POKER:
			m_pokerProcessors.insert_or_assign( realNode.getId(), root.getPokerProcessor() );
			break;

		case AvNode::Type::GRABBER:
			m_grabberProcessors.insert_or_assign( realNode.getId(), root.getGrabberProcessor() );
			break;

		case AvNode::Type::GRABBABLE:
			m_grabbableProcessors.insert_or_assign( realNode.getId(), root.getGrabbableProcessor() );
			break;
		}
	}

	m_sceneGraph = tools::newOwnCapnp( context.getParams().getRoot() );

	context.getResults().setSuccess( true );
	m_pParentServer->markFrameDirty();
	return kj::READY_NOW;
}


::kj::Promise<void> CAardvarkGadget::pushMouseEvent( PushMouseEventContext context )
{
	auto & inMouseEvent = context.getParams().getEvent();
	uint64_t globalPanelId = inMouseEvent.getPanelId();
	uint32_t gadgetId = (uint32_t)( globalPanelId >> 32 );
	uint32_t localPanelId = (uint32_t)( 0xFFFFFFFF & globalPanelId );

	KJ_IF_MAYBE( panelProcessor, m_pParentServer->findPanelProcessor( globalPanelId ) )
	{
		auto req = panelProcessor->mouseEventRequest();
		req.setPanelId( localPanelId );
		auto outMouseEvent = req.initEvent( );
		outMouseEvent.setPanelId( globalPanelId );
		outMouseEvent.setPokerId( (uint64_t)m_id << 32 | (uint64_t)context.getParams().getPokerNodeId() );
		outMouseEvent.setType( inMouseEvent.getType() );
		outMouseEvent.setX( inMouseEvent.getX() );
		outMouseEvent.setY( inMouseEvent.getY() );
		m_pParentServer->addRequestToTasks( std::move( req ) );
	}
	return kj::READY_NOW;
}


::kj::Promise<void> CAardvarkGadget::pushGrabEvent( PushGrabEventContext context )
{
	auto & inGrabEvent = context.getParams().getEvent();
	uint64_t globalGrabberId = (uint64_t)m_id << 32 | (uint64_t)context.getParams().getGrabberNodeId();
	uint64_t globalGrabbableId = inGrabEvent.getGrabbableId();

	KJ_IF_MAYBE( grabbableProcessor, m_pParentServer->findGrabbableProcessor( globalGrabbableId ) )
	{
		auto req = grabbableProcessor->grabEventRequest();

		uint32_t localGrabbableId = (uint32_t)( 0xFFFFFFFF & globalGrabbableId );
		req.setGrabbableId( localGrabbableId );
		auto outGrabEvent = req.initEvent();
		outGrabEvent.setGrabbableId( globalGrabbableId );
		outGrabEvent.setGrabberId( globalGrabberId );
		outGrabEvent.setType( inGrabEvent.getType() );
		m_pParentServer->addRequestToTasks( std::move( req ) );

		// we need to tell the renderer about some event types
		switch ( inGrabEvent.getType() )
		{
		case AvGrabEvent::Type::START_GRAB:
			m_pParentServer->startGrab( globalGrabberId, globalGrabbableId );
			break;

		case AvGrabEvent::Type::END_GRAB:
			m_pParentServer->endGrab( globalGrabberId, globalGrabbableId );
			break;
		}
	}
	return kj::READY_NOW;
}


void CAardvarkGadget::gatherVisuals( AvVisuals_t & visuals )
{
	if ( m_sceneGraph.hasNodes() )
	{
		AvSceneGraphRoot_t root;
		root.root = m_sceneGraph;
		root.gadgetId = m_id;
		root.hook = m_hook;
		visuals.vecSceneGraphs.push_back( root );
	}
}


void CAardvarkGadget::setSharedTextureInfo( AvSharedTextureInfo::Reader sharedTextureInfo )
{
	m_sharedTexture = tools::newOwnCapnp( sharedTextureInfo );
}

AvSharedTextureInfo::Reader CAardvarkGadget::getSharedTextureInfo()
{
	return m_sharedTexture;
}


kj::Maybe < AvPokerProcessor::Client > CAardvarkGadget::findPokerProcessor( uint32_t pokerLocalId )
{
	auto i = m_pokerProcessors.find( pokerLocalId );
	if ( i == m_pokerProcessors.end() )
	{
		return nullptr;
	}
	else
	{
		return i->second;
	}
}

kj::Maybe < AvPanelProcessor::Client > CAardvarkGadget::findPanelProcessor( uint32_t panelLocalId )
{
	auto i = m_panelProcessors.find( panelLocalId );
	if ( i == m_panelProcessors.end() )
	{
		return nullptr;
	}
	else
	{
		return i->second;
	}
}

kj::Maybe<AvGrabberProcessor::Client> CAardvarkGadget::findGrabberProcessor( uint32_t grabberLocalId )
{
	auto i = m_grabberProcessors.find( grabberLocalId );
	if ( i == m_grabberProcessors.end() )
	{
		return nullptr;
	}
	else
	{
		return i->second;
	}
}


kj::Maybe<AvGrabbableProcessor::Client> CAardvarkGadget::findGrabbableProcessor( uint32_t grabbableLocalId )
{
	auto i = m_grabbableProcessors.find( grabbableLocalId );
	if ( i == m_grabbableProcessors.end() )
	{
		return nullptr;
	}
	else
	{
		return i->second;
	}
}

::kj::Promise<void> CAardvarkGadget::sendHapticEvent( SendHapticEventContext context )
{
	uint64_t targetNodeGlobalId = context.getParams().getNodeGlobalId();
	m_pParentServer->sendHapticEvent( context.getParams().getNodeGlobalId(),
		context.getParams().getAmplitude(), context.getParams().getFrequency(), context.getParams().getDuration() );
	return kj::READY_NOW;
}
