// Copyright (c) 2013 The Chromium Embedded Framework Authors. All rights
// reserved. Use of this source code is governed by a BSD-style license that
// can be found in the LICENSE file.

#include "av_cef_handler.h"
#include "av_cef_app.h"

#include <sstream>
#include <string>

#include <aardvark/aardvark_scene_graph.h>

#include "include/base/cef_bind.h"
#include "include/cef_app.h"
#include "include/views/cef_browser_view.h"
#include "include/views/cef_window.h"
#include "include/wrapper/cef_closure_task.h"
#include "include/wrapper/cef_helpers.h"

namespace {

	CAardvarkCefHandler* g_instance = NULL;

}  // namespace

CAardvarkCefHandler::CAardvarkCefHandler(bool use_views, IApplication *application )
    : m_useViews(use_views), m_isClosing(false) 
{
	DCHECK(!g_instance);
	g_instance = this;
	m_application = application;
	m_client = std::make_unique<aardvark::CAardvarkClient>();
	m_client->Start();

	CefPostDelayedTask( TID_UI, base::Bind( &CAardvarkCefHandler::RunFrame, this ), 0 );
}

CAardvarkCefHandler::~CAardvarkCefHandler() 
{
	m_client->Stop();
	g_instance = NULL;
}

// static
CAardvarkCefHandler* CAardvarkCefHandler::GetInstance() 
{
	return g_instance;
}

void CAardvarkCefHandler::OnTitleChange(CefRefPtr<CefBrowser> browser,
                                  const CefString& title) 
{
	CEF_REQUIRE_UI_THREAD();

	if (m_useViews) 
	{
		// Set the title of the window using the Views framework.
		CefRefPtr<CefBrowserView> browser_view =
		CefBrowserView::GetForBrowser(browser);
		if (browser_view) {
			CefRefPtr<CefWindow> window = browser_view->GetWindow();
			if ( window )
			{
				window->SetTitle( title );
			}
		}
	} 
	else 
	{
	// Set the title of the window using platform APIs.
	PlatformTitleChange(browser, title);
	}
}

void CAardvarkCefHandler::OnAfterCreated(CefRefPtr<CefBrowser> browser) 
{
	CEF_REQUIRE_UI_THREAD();

	// Add to the list of existing browsers.
	m_browserList.push_back(browser);

	m_browserInfo.insert( std::pair( browser->GetIdentifier(), std::make_unique<BrowserInfo_t>() ) );
}

bool CAardvarkCefHandler::DoClose(CefRefPtr<CefBrowser> browser) 
{
	CEF_REQUIRE_UI_THREAD();

	// Closing the main window requires special handling. See the DoClose()
	// documentation in the CEF header for a detailed destription of this
	// process.
	if (m_browserList.size() == 1) 
	{
		// Set a flag to indicate that the window close should be allowed.
		m_isClosing = true;
	}

	// Allow the close. For windowed browsers this will result in the OS close
	// event being sent.
	return false;
}

void CAardvarkCefHandler::OnBeforeClose(CefRefPtr<CefBrowser> browser) 
{
	CEF_REQUIRE_UI_THREAD();

	// Remove from the list of existing browsers.
	BrowserList::iterator bit = m_browserList.begin();
	for (; bit != m_browserList.end(); ++bit) 
	{
		if ((*bit)->IsSame(browser)) 
		{
			m_browserList.erase(bit);
			break;
		}
	}

	m_browserInfo.erase( browser->GetIdentifier() );

	if (m_browserList.empty()) 
	{
		if ( m_application )
		{
			m_application->allBrowsersClosed();
		}
	}
}

void CAardvarkCefHandler::OnLoadError(CefRefPtr<CefBrowser> browser,
                                CefRefPtr<CefFrame> frame,
                                ErrorCode errorCode,
                                const CefString& errorText,
                                const CefString& failedUrl) 
{
	CEF_REQUIRE_UI_THREAD();

	// Don't display an error for downloaded files.
	if (errorCode == ERR_ABORTED)
		return;

	// Display a load error message.
	std::stringstream ss;
	ss << "<html><body bgcolor=\"white\">"
		"<h2>Failed to load URL "
		<< std::string(failedUrl) << " with error " << std::string(errorText)
		<< " (" << errorCode << ").</h2></body></html>";
	frame->LoadString(ss.str(), failedUrl);
}

void CAardvarkCefHandler::CloseAllBrowsers(bool force_close) 
{
	if (!CefCurrentlyOn(TID_UI)) 
	{
		// Execute on the UI thread.
		CefPostTask(TID_UI, base::Bind(&CAardvarkCefHandler::CloseAllBrowsers, this,
									force_close));
		return;
	}

	if (m_browserList.empty())
		return;

	BrowserList::const_iterator it = m_browserList.begin();
	for ( ; it != m_browserList.end(); ++it )
	{
		( *it )->GetHost()->CloseBrowser( force_close );

	}
}


void CAardvarkCefHandler::GetViewRect( CefRefPtr<CefBrowser> browser, CefRect& rect )
{
	rect.x = 0;
	rect.y = 0;
	rect.width = m_width;
	rect.height = m_height;
}

void CAardvarkCefHandler::OnPaint( CefRefPtr<CefBrowser> browser,
	PaintElementType type,
	const RectList& dirtyRects,
	const void* buffer,
	int width,
	int height )
{
	// we don't care about the slow paint, just the GPU paint in OnAcceleratedPaint
	m_width = width;
	m_height = height;
}


void CAardvarkCefHandler::OnAcceleratedPaint( CefRefPtr<CefBrowser> browser,
	PaintElementType type,
	const RectList& dirtyRects,
	void* shared_handle )
{
	auto & browserInfo = *m_browserInfo[browser->GetIdentifier()];
	browserInfo.m_sharedTexture = shared_handle;
	updateSceneGraphTextures( browserInfo );
}


bool CAardvarkCefHandler::OnProcessMessageReceived( CefRefPtr<CefBrowser> browser,
	CefProcessId source_process,
	CefRefPtr<CefProcessMessage> message )
{
	if ( message->GetName() == "update_browser_app_names" )
	{
		BrowserInfo_t & browserInfo = *m_browserInfo[browser->GetIdentifier()];

		browserInfo.m_apps.clear();
		auto nameList = message->GetArgumentList()->GetList( 0 );
		for ( size_t n = 0; n < nameList->GetSize(); n++ )
		{
			browserInfo.m_apps.push_back( nameList->GetString( n ).ToString() );
		}
		updateSceneGraphTextures( browserInfo );
		return true;
	}

	return false;
}


void CAardvarkCefHandler::updateSceneGraphTextures( CAardvarkCefHandler::BrowserInfo_t & browserInfo )
{
	if ( !browserInfo.m_sharedTexture )
	{
		// if we don't have a shared texture yet, there's nothing to update
		return;
	}

	std::vector< const char *> namePointers;
	for ( auto & appName : browserInfo.m_apps )
	{
		namePointers.push_back( appName.c_str() );
	}

	if ( namePointers.empty() )
	{
		aardvark::avUpdateDxgiTextureForApps( &*m_client, nullptr, 0, m_width, m_height, browserInfo.m_sharedTexture );
	}
	else
	{
		aardvark::avUpdateDxgiTextureForApps( &*m_client, &namePointers[0], (uint32_t)namePointers.size(), m_width, m_height, browserInfo.m_sharedTexture );
	}
}

void CAardvarkCefHandler::RunFrame()
{
	m_client->WaitScope().poll();

	CefPostDelayedTask( TID_UI, base::Bind( &CAardvarkCefHandler::RunFrame, this ), 11 );
}
