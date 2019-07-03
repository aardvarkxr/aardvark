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

CAardvarkCefHandler::CAardvarkCefHandler(bool use_views, IApplication *application, const std::vector<std::string> & permissions )
    : m_useViews(use_views), m_isClosing(false) 
{
	m_application = application;
	m_client = std::make_unique<aardvark::CAardvarkClient>();
	m_client->Start();

	m_permissions = permissions;

	CefPostDelayedTask( TID_UI, base::Bind( &CAardvarkCefHandler::RunFrame, this ), 0 );
}

CAardvarkCefHandler::~CAardvarkCefHandler() 
{
	m_client->Stop();
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

	m_browser = browser;

	size_t listIndex = 0;
	CefRefPtr< CefListValue> permissionList = CefListValue::Create();
	for ( auto & permission : m_permissions )
	{
		permissionList->SetString( listIndex++, permission );
	}

	CefRefPtr<CefProcessMessage> msg = CefProcessMessage::Create( "set_browser_permissions" );

	msg->GetArgumentList()->SetList( 0, permissionList );
	m_browser->SendProcessMessage( PID_RENDERER, msg );
}


bool CAardvarkCefHandler::DoClose(CefRefPtr<CefBrowser> browser) 
{
	CEF_REQUIRE_UI_THREAD();

	// Closing the main window requires special handling. See the DoClose()
	// documentation in the CEF header for a detailed destription of this
	// process.

	// Set a flag to indicate that the window close should be allowed.
	m_isClosing = true;

	// Allow the close. For windowed browsers this will result in the OS close
	// event being sent.
	return false;
}

void CAardvarkCefHandler::OnBeforeClose(CefRefPtr<CefBrowser> browser) 
{
	CEF_REQUIRE_UI_THREAD();
	m_browser = nullptr;
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
	m_sharedTexture = shared_handle;
	updateSceneGraphTextures();
}


bool CAardvarkCefHandler::OnProcessMessageReceived( CefRefPtr<CefBrowser> browser,
	CefProcessId source_process,
	CefRefPtr<CefProcessMessage> message )
{
	if ( message->GetName() == "update_browser_app_names" )
	{
		m_apps.clear();
		auto nameList = message->GetArgumentList()->GetList( 0 );
		for ( size_t n = 0; n < nameList->GetSize(); n++ )
		{
			m_apps.push_back( nameList->GetString( n ).ToString() );
		}
		updateSceneGraphTextures();
		return true;
	}
	else if ( message->GetName() == "start_app" )
	{
		std::string uri( message->GetArgumentList()->GetString( 0 ) );
		std::vector<std::string> permissions;
		auto permissionList = message->GetArgumentList()->GetList( 1 );
		for ( size_t n = 0; n < permissionList->GetSize(); n++ )
		{
			permissions.push_back( permissionList->GetString( n ).ToString() );
		}

		CAardvarkCefApp::instance()->startApp( uri, permissions );

	}
	else if ( message->GetName() == "mouse_event" )
	{
		CefMouseEvent cefEvent;
		cefEvent.x = (int)(message->GetArgumentList()->GetDouble( 1 ) * (double)m_width );
		cefEvent.y = (int)( message->GetArgumentList()->GetDouble( 2 ) * (double)m_height );
		cefEvent.modifiers = 0;

		switch ( (aardvark::EPanelMouseEventType)message->GetArgumentList()->GetInt( 0 ) )
		{
		case aardvark::EPanelMouseEventType::Enter:
		{
			browser->GetHost()->SendMouseMoveEvent( cefEvent, false );
		}
		break;

		case aardvark::EPanelMouseEventType::Leave:
		{
			browser->GetHost()->SendMouseMoveEvent( cefEvent, true );
		}
		break;

		case aardvark::EPanelMouseEventType::Move:
		{
			browser->GetHost()->SendMouseMoveEvent( cefEvent, false );
		}
		break;

		case aardvark::EPanelMouseEventType::Down:
		{
			browser->GetHost()->SendMouseClickEvent( cefEvent, MBT_LEFT, false, 1 );
		}
		break;

		case aardvark::EPanelMouseEventType::Up:
		{
			browser->GetHost()->SendMouseClickEvent( cefEvent, MBT_LEFT, true, 1 );
		}
		break;

		}
	}

	return false;
}


void CAardvarkCefHandler::updateSceneGraphTextures()
{
	if ( !m_sharedTexture )
	{
		// if we don't have a shared texture yet, there's nothing to update
		return;
	}

	std::vector< const char *> namePointers;
	for ( auto & appName : m_apps )
	{
		namePointers.push_back( appName.c_str() );
	}

	if ( namePointers.empty() )
	{
		aardvark::avUpdateDxgiTextureForApps( &*m_client, nullptr, 0, m_width, m_height, m_sharedTexture, true );
	}
	else
	{
		aardvark::avUpdateDxgiTextureForApps( &*m_client, &namePointers[0], (uint32_t)namePointers.size(), m_width, m_height, m_sharedTexture, true );
	}
}

void CAardvarkCefHandler::RunFrame()
{
	m_client->WaitScope().poll();

	CefPostDelayedTask( TID_UI, base::Bind( &CAardvarkCefHandler::RunFrame, this ), 11 );
}


void CAardvarkCefHandler::triggerClose( bool forceClose )
{
	if ( !CefCurrentlyOn( TID_UI ) )
	{
		// Execute on the UI thread.
		CefPostTask( TID_UI, base::Bind( &CAardvarkCefHandler::triggerClose, this,
			forceClose ) );
		return;
	}

	m_browser->GetHost()->CloseBrowser( forceClose );
}
