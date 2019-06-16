#include "aardvark_app_impl.h"
#include "aardvark/aardvark_server.h"
#include "framestructs.h"

#include <algorithm>
#include <assert.h>

using namespace aardvark;

CAardvarkApp::CAardvarkApp( const std::string & sName, AvServerImpl *pParentServer )
{
	static uint32_t s_uniqueId = 1;
	m_id = s_uniqueId++;

	m_sName = sName;
	m_pParentServer = pParentServer;
}


::kj::Promise<void> CAardvarkApp::destroy( DestroyContext context )
{
	m_pParentServer->removeApp( this );
	context.getResults().setSuccess( true );
	return kj::READY_NOW;
}

::kj::Promise<void> CAardvarkApp::name( NameContext context )
{
	context.getResults().setName( m_sName );
	return kj::READY_NOW;
}


::kj::Promise<void> CAardvarkApp::updateSceneGraph( UpdateSceneGraphContext context )
{
	auto root = context.getParams().getRoot();
	m_panelHandlers.clear();
	m_pokerHandlers.clear();
	for ( auto node : root.getNodes() )
	{
		auto realNode = node.getNode();
		switch ( realNode.getType() )
		{
		case AvNode::Type::PANEL:
			m_panelHandlers.insert_or_assign( realNode.getId(), root.getHandlerPanel() );
			break;

		case AvNode::Type::POKER:
			m_pokerHandlers.insert_or_assign( realNode.getId(), root.getHandlerPoker() );
			break;
		}
	}

	m_sceneGraph = tools::newOwnCapnp( context.getParams().getRoot() );

	context.getResults().setSuccess( true );
	m_pParentServer->markFrameDirty();
	return kj::READY_NOW;
}


::kj::Promise<void> CAardvarkApp::pushMouseEvent( PushMouseEventContext context )
{
	auto & mouseEvent = context.getParams().getEvent();
	uint64_t globalPanelId = mouseEvent.getPanelId();
	uint32_t appId = (uint32_t)( globalPanelId >> 32 );
	uint32_t localPanelId = (uint32_t)( 0xFFFFFFFF & globalPanelId );
	KJ_IF_MAYBE( panelHandler, m_pParentServer->findPanelHandler( globalPanelId ) )
	{
		auto req = panelHandler->mouseEventRequest();
		req.setPanelId( localPanelId );
		req.setEvent( mouseEvent );
		m_pParentServer->addRequestToTasks( std::move( req ) );
	}
	return kj::READY_NOW;
}

void CAardvarkApp::gatherVisuals( AvVisuals_t & visuals )
{
	if ( m_sceneGraph.hasNodes() )
	{
		AvSceneGraphRoot_t root;
		root.root = m_sceneGraph;
		root.appId = m_id;
		visuals.vecSceneGraphs.push_back( root );
	}
}


void CAardvarkApp::setSharedTextureInfo( AvSharedTextureInfo::Reader sharedTextureInfo )
{
	m_sharedTexture = tools::newOwnCapnp( sharedTextureInfo );
}

AvSharedTextureInfo::Reader CAardvarkApp::getSharedTextureInfo()
{
	return m_sharedTexture;
}


kj::Maybe < AvPokerHandler::Client > CAardvarkApp::findPokerHandler( uint32_t pokerLocalId )
{
	auto i = m_pokerHandlers.find( pokerLocalId );
	if ( i == m_pokerHandlers.end() )
	{
		return nullptr;
	}
	else
	{
		return i->second;
	}
}

kj::Maybe < AvPanelHandler::Client > CAardvarkApp::findPanelHandler( uint32_t panelLocalId )
{
	auto i = m_panelHandlers.find( panelLocalId );
	if ( i == m_panelHandlers.end() )
	{
		return nullptr;
	}
	else
	{
		return i->second;
	}
}
