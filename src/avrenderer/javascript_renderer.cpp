#include "javascript_renderer.h"
#include "av_cef_javascript.h"

CJavascriptRenderer::CJavascriptRenderer( CAardvarkRenderProcessHandler *renderProcessHandler )
{
	m_handler = renderProcessHandler;
}

bool CJavascriptRenderer::hasPermission( const std::string & permission )
{
	return m_handler->hasPermission( permission );
}

void CJavascriptRenderer::runFrame()
{
	if ( m_quitting )
		return;

	m_listener->runFrame();
	if ( m_listener->wantsQuit() )
	{
		m_quitting = true;
		CefRefPtr<CefProcessMessage> msg = CefProcessMessage::Create( "quit" );
		m_handler->getBrowser()->SendProcessMessage( PID_BROWSER, msg );
	}
}


bool CJavascriptRenderer::init()
{
	m_listener = std::make_unique<CSceneListener>();
	m_listener->init( nullptr, m_handler->getClient() );

	return true;
}

void CJavascriptRenderer::cleanup()
{
	m_listener->cleanup();
}

