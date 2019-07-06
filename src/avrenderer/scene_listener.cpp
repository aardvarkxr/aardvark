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
			m_renderer->renderFrame();
		}

		m_pClient->WaitScope().poll();
	}
}


::kj::Promise<void> AvFrameListenerImpl::newFrame( NewFrameContext context )
{
	m_listener->m_renderer->applyFrame( context.getParams().getFrame() );
	return kj::READY_NOW;
}

::kj::Promise<void> AvFrameListenerImpl::sendHapticEvent( SendHapticEventContext context )
{
	m_listener->m_renderer->sendHapticEvent( context.getParams().getTargetGlobalId(),
		context.getParams().getAmplitude(),
		context.getParams().getFrequency(),
		context.getParams().getDuration() );
	return kj::READY_NOW;
}

::kj::Promise<void> AvFrameListenerImpl::startGrab( StartGrabContext context )
{
	uint64_t grabberGlobalId = context.getParams().getGrabberGlobalId();
	uint64_t grabbableGlobalId = context.getParams().getGrabbableGlobalId();

	m_listener->m_renderer->startGrabImpl( grabberGlobalId, grabbableGlobalId );
	return kj::READY_NOW;
}


::kj::Promise<void> AvFrameListenerImpl::endGrab( EndGrabContext context )
{
	uint64_t grabberGlobalId = context.getParams().getGrabberGlobalId();
	uint64_t grabbableGlobalId = context.getParams().getGrabbableGlobalId();
	m_listener->m_renderer->endGrabImpl( grabberGlobalId, grabbableGlobalId );
	return kj::READY_NOW;
}

