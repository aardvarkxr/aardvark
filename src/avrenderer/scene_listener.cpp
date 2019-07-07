#include "scene_listener.h"
#include "aardvark_renderer.h"





CSceneListener::CSceneListener( )
{
	m_renderer = std::make_unique<VulkanExample>();
}

void CSceneListener::earlyInit( CefRefPtr<CAardvarkCefApp> app )
{
	m_app = app;
	m_app->setApplication( m_renderer.get() );
}

void CSceneListener::init( HINSTANCE hinstance )
{
	m_pClient = kj::heap<aardvark::CAardvarkClient>();
	m_pClient->Start();
	m_renderer->m_pClient = m_pClient;

	m_frameListener = kj::heap<AvFrameListenerImpl>();
	m_frameListener->m_listener = this;

	auto reqListen = m_pClient->Server().listenForFramesRequest();
	AvFrameListener::Client listenerClient = std::move( m_frameListener );
	reqListen.setListener( listenerClient );
	reqListen.send().wait( m_pClient->WaitScope() );

	m_renderer->initOpenVR();
	m_renderer->initVulkan();
	m_renderer->setupWindow( hinstance );
	m_renderer->prepare();

	m_traverser.init( m_renderer.get(), m_pClient );
}

void CSceneListener::cleanup()
{
	m_pClient->Stop();
	m_pClient = nullptr;


	m_renderer = nullptr;
}

void CSceneListener::run()
{
	bool shouldQuit = false;
	while ( !shouldQuit )
	{
		bool shouldRender = false;
		m_renderer->runFrame( &shouldQuit, &shouldRender );
		if ( shouldRender )
		{
			m_renderer->renderFrame( [this]() 
			{ 
				if ( m_nextRoots )
				{
					m_roots = std::move( m_nextRoots );
				}
				if ( m_nextSharedTextureInfo )
				{
					m_sharedTextureInfo = std::move( m_nextSharedTextureInfo );
				}

				if ( m_roots && m_sharedTextureInfo )
				{
					m_renderer->updateOpenVrPoses();
					m_traverser.TraverseSceneGraphs( *m_roots, *m_sharedTextureInfo );
					m_renderer->processRenderList();
				}
			} );
		}

		m_pClient->WaitScope().poll();
	}
}


void CSceneListener::applyFrame( AvVisualFrame::Reader & newFrame )
{
	m_renderer->camera.setPosition( { 0.0f, 0.0f, 1.0f } );
	m_renderer->camera.setRotation( { 0.0f, 0.0f, 0.0f } );

	auto nextRoots = std::make_unique < std::vector<std::unique_ptr<SgRoot_t>>>();
	for ( auto & root : newFrame.getRoots() )
	{
		std::unique_ptr<SgRoot_t> rootStruct = std::make_unique<SgRoot_t>();
		rootStruct->root = tools::newOwnCapnp( root );
		rootStruct->nodes.reserve( root.getNodes().size() );
		rootStruct->gadgetId = root.getSourceId();
		rootStruct->hook = root.getHook();

		for ( auto & nodeWrapper : rootStruct->root.getNodes() )
		{
			auto node = nodeWrapper.getNode();
			rootStruct->mapIdToIndex[node.getId()] = rootStruct->nodes.size();
			rootStruct->nodes.push_back( node );
		}

		nextRoots->push_back( std::move( rootStruct ) );
	}

	auto nextTextures = std::make_unique < std::map<uint32_t, tools::OwnCapnp< AvSharedTextureInfo > > >();
	for ( auto & texture : newFrame.getGadgetTextures() )
	{
		nextTextures->insert_or_assign( texture.getGadgetId(), tools::newOwnCapnp( texture.getSharedTextureInfo() ) );
	}

	m_nextRoots = std::move( nextRoots );
	m_nextSharedTextureInfo = std::move( nextTextures );
}


::kj::Promise<void> AvFrameListenerImpl::newFrame( NewFrameContext context )
{
	m_listener->applyFrame( context.getParams().getFrame() );
	return kj::READY_NOW;
}

::kj::Promise<void> AvFrameListenerImpl::sendHapticEvent( SendHapticEventContext context )
{
	m_listener->m_traverser.sendHapticEvent( context.getParams().getTargetGlobalId(),
		context.getParams().getAmplitude(),
		context.getParams().getFrequency(),
		context.getParams().getDuration() );
	return kj::READY_NOW;
}

::kj::Promise<void> AvFrameListenerImpl::startGrab( StartGrabContext context )
{
	uint64_t grabberGlobalId = context.getParams().getGrabberGlobalId();
	uint64_t grabbableGlobalId = context.getParams().getGrabbableGlobalId();

	m_listener->m_traverser.startGrabImpl( grabberGlobalId, grabbableGlobalId );
	return kj::READY_NOW;
}


::kj::Promise<void> AvFrameListenerImpl::endGrab( EndGrabContext context )
{
	uint64_t grabberGlobalId = context.getParams().getGrabberGlobalId();
	uint64_t grabbableGlobalId = context.getParams().getGrabbableGlobalId();
	m_listener->m_traverser.endGrabImpl( grabberGlobalId, grabbableGlobalId );
	return kj::READY_NOW;
}

