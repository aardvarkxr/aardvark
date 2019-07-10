#include "javascript_renderer.h"
#include "av_cef_javascript.h"
#include "aardvark_renderer.h"
#include "vrmanager.h"

CJavascriptRenderer::CJavascriptRenderer( CAardvarkRenderProcessHandler *renderProcessHandler )
{
	m_handler = renderProcessHandler;
	m_renderer = std::make_unique<VulkanExample>();
	m_vrManager = std::make_unique<CVRManager>();

}

bool CJavascriptRenderer::hasPermission( const std::string & permission )
{
	return m_handler->hasPermission( permission );
}

void CJavascriptRenderer::runFrame()
{
	if ( m_quitting )
		return;

	auto tStart = std::chrono::high_resolution_clock::now();

	m_vrManager->updateOpenVrPoses();
	m_traverser.TraverseSceneGraphs();
	m_renderer->processRenderList();

	auto tEnd = std::chrono::high_resolution_clock::now();
	auto tDiff = std::chrono::duration<double, std::milli>( tEnd - tStart ).count();

	m_vrManager->doInputWork();

	bool shouldQuit = false;
	m_renderer->runFrame( &shouldQuit, tDiff / 1000.0f );

	if ( shouldQuit )
	{
		m_quitting = true;
		CefRefPtr<CefProcessMessage> msg = CefProcessMessage::Create( "quit" );
		m_handler->getBrowser()->SendProcessMessage( PID_BROWSER, msg );
	}
}


bool CJavascriptRenderer::init()
{
	m_frameListener = kj::heap<AvFrameListenerImpl>();
	m_frameListener->m_renderer = this;

	auto reqListen = m_handler->getClient()->Server().listenForFramesRequest();
	AvFrameListener::Client listenerClient = std::move( m_frameListener );
	reqListen.setListener( listenerClient );
	reqListen.send().wait( m_handler->getClient()->WaitScope() );

	m_vrManager->init();
	m_renderer->init( nullptr, m_vrManager.get(), m_handler->getClient() );
	m_traverser.init( m_renderer.get(), m_vrManager.get(), m_handler->getClient() );

	return true;
}

void CJavascriptRenderer::cleanup()
{
	m_traverser.cleanup();
	m_renderer = nullptr;
}

::kj::Promise<void> AvFrameListenerImpl::newFrame( NewFrameContext context )
{
	m_renderer->m_traverser.newSceneGraph( context.getParams().getFrame() );
	return kj::READY_NOW;
}

::kj::Promise<void> AvFrameListenerImpl::sendHapticEvent( SendHapticEventContext context )
{
	m_renderer->m_traverser.sendHapticEvent( context.getParams().getTargetGlobalId(),
		context.getParams().getAmplitude(),
		context.getParams().getFrequency(),
		context.getParams().getDuration() );
	return kj::READY_NOW;
}

::kj::Promise<void> AvFrameListenerImpl::startGrab( StartGrabContext context )
{
	uint64_t grabberGlobalId = context.getParams().getGrabberGlobalId();
	uint64_t grabbableGlobalId = context.getParams().getGrabbableGlobalId();

	m_renderer->m_traverser.startGrabImpl( grabberGlobalId, grabbableGlobalId );
	return kj::READY_NOW;
}


::kj::Promise<void> AvFrameListenerImpl::endGrab( EndGrabContext context )
{
	uint64_t grabberGlobalId = context.getParams().getGrabberGlobalId();
	uint64_t grabbableGlobalId = context.getParams().getGrabbableGlobalId();
	m_renderer->m_traverser.endGrabImpl( grabberGlobalId, grabbableGlobalId );
	return kj::READY_NOW;
}

