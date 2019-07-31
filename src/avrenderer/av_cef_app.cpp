// Copyright (c) 2013 The Chromium Embedded Framework Authors. All rights
// reserved. Use of this source code is governed by a BSD-style license that
// can be found in the LICENSE file.

#include "av_cef_app.h"

#include <string>

#include "include/cef_browser.h"
#include "include/cef_command_line.h"
#include "include/views/cef_browser_view.h"
#include "include/views/cef_window.h"
#include "include/wrapper/cef_helpers.h"
#include "av_cef_handler.h"
#include "av_cef_javascript.h"
#include <aardvark/aardvark_gadget_manifest.h>

#include <processthreadsapi.h>

namespace 
{

	CAardvarkCefApp* g_instance = NULL;



// When using the Views framework this object provides the delegate
// implementation for the CefWindow that hosts the Views-based browser.
class SimpleWindowDelegate : public CefWindowDelegate 
{
public:
	explicit SimpleWindowDelegate(CefRefPtr<CefBrowserView> browser_view)
		: browser_view_(browser_view) {}

	void OnWindowCreated(CefRefPtr<CefWindow> window) OVERRIDE 
	{
		// Add the browser view and show the window.
		window->AddChildView(browser_view_);
		window->Show();

		// Give keyboard focus to the browser view.
		browser_view_->RequestFocus();
	}

	void OnWindowDestroyed(CefRefPtr<CefWindow> window) OVERRIDE 
	{
		browser_view_ = NULL;
	}

	bool CanClose(CefRefPtr<CefWindow> window) OVERRIDE 
	{
		// Allow the window to close if the browser says it's OK.
		CefRefPtr<CefBrowser> browser = browser_view_->GetBrowser();
		if (browser)
			return browser->GetHost()->TryCloseBrowser();
		return true;
	}

private:
	CefRefPtr<CefBrowserView> browser_view_;

	IMPLEMENT_REFCOUNTING(SimpleWindowDelegate);
	DISALLOW_COPY_AND_ASSIGN(SimpleWindowDelegate);
};

}  // namespace

CAardvarkCefApp::CAardvarkCefApp() 
{
	g_instance = this;
}

CAardvarkCefApp::~CAardvarkCefApp()
{
	g_instance = nullptr;
}

void CAardvarkCefApp::OnContextInitialized()
{
	CEF_REQUIRE_UI_THREAD();

	CefRefPtr<CefCommandLine> command_line =
	CefCommandLine::GetGlobalCommandLine();

#if defined(OS_WIN) || defined(OS_LINUX)
	// Create the browser using the Views framework if "--use-views" is specified
	// via the command-line. Otherwise, create the browser using the native
	// platform framework. The Views framework is currently only supported on
	// Windows and Linux.
	const bool use_views = command_line->HasSwitch("use-views");
#else
	const bool use_views = false;
#endif

	startGadget( "http://aardvark.install/gadgets/aardvark_master", "", 0, nullptr );
}


void CAardvarkCefApp::startGadget( const std::string & uri, const std::string & initialHook, int requestId, CefRefPtr<CefBrowser> browserToNotifyWhenCreated )
{
	CEF_REQUIRE_UI_THREAD();

	// CAardvarkCefHandler implements browser-level callbacks.
	CefRefPtr<CAardvarkCefHandler> handler( new CAardvarkCefHandler( this, uri, initialHook, requestId, browserToNotifyWhenCreated ) );
	m_browsers.push_back( handler );
	handler->start();
}


void CAardvarkCefApp::OnBeforeCommandLineProcessing( const CefString& processType, CefRefPtr<CefCommandLine> commandLine )
{
	// turn on chrome dev tools
	commandLine->AppendSwitchWithValue( "remote-debugging-port", std::to_string( 8042 ) );
}


CefRefPtr<CefRenderProcessHandler> CAardvarkCefApp::GetRenderProcessHandler()
{
	if ( !m_renderProcessHandler )
	{
		CefRefPtr<CefRenderProcessHandler> newHandler( new CAardvarkRenderProcessHandler() );
		m_renderProcessHandler = newHandler;
	}
	return m_renderProcessHandler;
}

void CAardvarkCefApp::CloseAllBrowsers( bool forceClose )
{
	std::vector< CefRefPtr< CAardvarkCefHandler > > browsers = m_browsers;
	for ( auto browser : browsers )
	{
		browser->triggerClose( forceClose );
	}
}

CAardvarkCefApp* CAardvarkCefApp::instance()
{
	return g_instance;
}

bool CAardvarkCefApp::wantsToQuit()
{
	return m_browsers.empty() && m_quitRequested;
}

void CAardvarkCefApp::quitRequested()
{
	CloseAllBrowsers( true );
	m_quitRequested = true;
}


void CAardvarkCefApp::browserClosed( CAardvarkCefHandler *handler )
{
	auto i = std::find( m_browsers.begin(), m_browsers.end(), handler );
	if ( i != m_browsers.end() )
	{
		m_browsers.erase( i );
	}
}


