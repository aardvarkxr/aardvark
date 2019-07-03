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

	std::vector<std::string> vecPermissions = { "master" };

	// CAardvarkCefHandler implements browser-level callbacks.
	CefRefPtr<CAardvarkCefHandler> handler(new CAardvarkCefHandler(use_views, m_application, vecPermissions ));
	m_browsers.push_back( handler );

	// Specify CEF browser settings here.
	CefBrowserSettings browser_settings;

	// Check if a "--url=" value was provided via the command-line. If so, use
	// that instead of the default URL.
	std::string url = "file:///E:/homedev/aardvark/build/apps/aardvark_master/index.html";

	if (use_views) 
	{
		// Create the BrowserView.
		CefRefPtr<CefBrowserView> browser_view = CefBrowserView::CreateBrowserView(
		handler, url, browser_settings, NULL, NULL);

		// Create the Window. It will show itself after creation.
		CefWindow::CreateTopLevelWindow(new SimpleWindowDelegate(browser_view));
	} 
	else 
	{
		// Information used when creating the native window.
		CefWindowInfo window_info;

#if defined(OS_WIN)
		// On Windows we need to specify certain flags that will be passed to
		// CreateWindowEx().
		window_info.SetAsPopup(NULL, "aardvark");
#endif

		window_info.windowless_rendering_enabled = true;
		window_info.shared_texture_enabled = true;

		window_info.width = 1024;
		window_info.height = 1024;
		window_info.x = window_info.y = 0;
		
		browser_settings.windowless_frame_rate = 90;

		// Create the first browser window.
		CefBrowserHost::CreateBrowser(window_info, handler, url, browser_settings,
									NULL);
	}
}


void CAardvarkCefApp::startApp( std::string & uri, const std::vector<std::string> & permissions )
{
	CEF_REQUIRE_UI_THREAD();

	// CAardvarkCefHandler implements browser-level callbacks.
	CefRefPtr<CAardvarkCefHandler> handler( new CAardvarkCefHandler( false, m_application, permissions ) );
	m_browsers.push_back( handler );

	// Specify CEF browser settings here.
	CefBrowserSettings browser_settings;

	CefWindowInfo window_info;

	// On Windows we need to specify certain flags that will be passed to
	// CreateWindowEx().
	window_info.SetAsPopup( NULL, "aardvark app" );

	window_info.windowless_rendering_enabled = true;
	window_info.shared_texture_enabled = true;

	window_info.width = 1024;
	window_info.height = 1024;
	window_info.x = window_info.y = 0;

	browser_settings.windowless_frame_rate = 90;

	// Create the first browser window.
	CefBrowserHost::CreateBrowser( window_info, handler, uri, browser_settings,
		NULL );
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
	for ( auto browser : m_browsers )
	{
		browser->triggerClose( forceClose );
	}
	m_browsers.clear();
}

CAardvarkCefApp* CAardvarkCefApp::instance()
{
	return g_instance;
}
