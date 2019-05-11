#include "aardvark_app_impl.h"
#include "aardvark/aardvark_server.h"
#include "framestructs.h"

#include <algorithm>
#include <assert.h>

using namespace aardvark;

CAardvarkApp::CAardvarkApp( const std::string & sName, AvServerImpl *pParentServer )
	: m_sceneGraph( nullptr )
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
	m_sceneGraph = tools::newOwnCapnp( context.getParams().getRoot() );
	context.getResults().setSuccess( true );
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

