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

#include <json/json.hpp>

CStartGadgetRequestClient::CStartGadgetRequestClient( CAardvarkCefHandler *cefHandler )
{
	m_cefHandler = cefHandler;
}

void CStartGadgetRequestClient::OnRequestComplete( CefRefPtr<CefURLRequest> request ) 
{
	CefURLRequest::Status status = request->GetRequestStatus();
	CefURLRequest::ErrorCode error_code = request->GetRequestError();
	CefRefPtr<CefResponse> response = request->GetResponse();

	m_cefHandler->onGadgetManifestReceived( error_code == ERR_NONE, m_downloadData );
}

void CStartGadgetRequestClient::OnUploadProgress( CefRefPtr<CefURLRequest> request,
	int64 current,
	int64 total ) 
{
}

void CStartGadgetRequestClient::OnDownloadProgress( CefRefPtr<CefURLRequest> request,
	int64 current,
	int64 total ) 
{
}

void CStartGadgetRequestClient::OnDownloadData( CefRefPtr<CefURLRequest> request,
	const void* data,
	size_t data_length ) 
{
	m_downloadData += std::string( static_cast<const char*>( data ), data_length );
}

bool CStartGadgetRequestClient::GetAuthCredentials( bool isProxy,
	const CefString& host,
	int port,
	const CefString& realm,
	const CefString& scheme,
	CefRefPtr<CefAuthCallback> callback ) 
{
	return false;  // Not handled.
}

CAardvarkCefHandler::CAardvarkCefHandler( IApplication *application, const std::string & gadgetUri, const std::string & initialHook )
    : m_useViews( false ), m_isClosing(false) 
{
	m_application = application;
	m_client = std::make_unique<aardvark::CAardvarkClient>();
	m_client->Start();

	m_gadgetUri = gadgetUri;
	m_initialHook = initialHook;
}


CAardvarkCefHandler::~CAardvarkCefHandler() 
{
	m_client->Stop();
}

// Called after creation to kick off the gadget
void CAardvarkCefHandler::start()
{
	m_manifestRequestClient = new CStartGadgetRequestClient( this );

	CefRefPtr<CefRequest> request = CefRequest::Create();
	std::string gadgetManifestUri = m_gadgetUri + "/gadget_manifest.json";
	request->SetURL( gadgetManifestUri );
	request->SetMethod( "GET" );

	m_manifestRequest = CefURLRequest::Create( request, m_manifestRequestClient, nullptr );
}


// Called when the manifest load is completed
void CAardvarkCefHandler::onGadgetManifestReceived( bool success, const std::string & manifestData )
{
	if ( !success )
	{
		assert( false );
		return;
	}

	try
	{
		nlohmann::json j = nlohmann::json::parse( manifestData.begin(), manifestData.end() );
		m_gadgetManifest = j.get<CAardvarkGadgetManifest>();
	}
	catch ( nlohmann::json::exception &  )
	{
		// manifest parse failed
		assert( false );
		return;
	}

	m_gadgetManifestString = manifestData;

	// Specify CEF browser settings here.
	CefBrowserSettings browser_settings;

	CefWindowInfo window_info;

	// On Windows we need to specify certain flags that will be passed to
	// CreateWindowEx().
	window_info.SetAsPopup( NULL, m_gadgetManifest.m_name );

	window_info.windowless_rendering_enabled = true;
	window_info.shared_texture_enabled = true;

	window_info.width = m_gadgetManifest.m_width;
	window_info.height = m_gadgetManifest.m_height;
	window_info.x = window_info.y = 0;

	browser_settings.windowless_frame_rate = 90;

	std::string fullUri = m_gadgetUri + "/index.html?initialHook=" + m_initialHook;

	// Create the first browser window.
	CefBrowserHost::CreateBrowser( window_info, this, fullUri, browser_settings,
		NULL );

	CefPostDelayedTask( TID_UI, base::Bind( &CAardvarkCefHandler::RunFrame, this ), 0 );
	m_manifestRequest = nullptr;
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

	CefRefPtr<CefProcessMessage> msg = CefProcessMessage::Create( "gadget_info" );
	msg->GetArgumentList()->SetString( 0, m_gadgetUri );
	msg->GetArgumentList()->SetString( 1, m_initialHook );
	msg->GetArgumentList()->SetString( 2, m_gadgetManifestString );

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
	rect.width = m_gadgetManifest.m_width;
	rect.height = m_gadgetManifest.m_height;
}

void CAardvarkCefHandler::OnPaint( CefRefPtr<CefBrowser> browser,
	PaintElementType type,
	const RectList& dirtyRects,
	const void* buffer,
	int width,
	int height )
{
	// we don't care about the slow paint, just the GPU paint in OnAcceleratedPaint
	assert( m_gadgetManifest.m_width == width );
	assert( m_gadgetManifest.m_height == height );
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
	if ( message->GetName() == "update_browser_gadget_ids" )
	{
		m_gadgets.clear();
		auto idList = message->GetArgumentList()->GetList( 0 );
		for ( size_t n = 0; n < idList->GetSize(); n++ )
		{
			m_gadgets.push_back( (uint32_t)idList->GetInt( n ) );
		}
		updateSceneGraphTextures();
		return true;
	}
	else if ( message->GetName() == "start_gadget" )
	{
		std::string uri( message->GetArgumentList()->GetString( 0 ) );
		std::string initialHook( message->GetArgumentList()->GetString( 1 ) );

		CAardvarkCefApp::instance()->startGadget( uri, initialHook );
	}
	else if ( message->GetName() == "mouse_event" )
	{
		CefMouseEvent cefEvent;
		cefEvent.x = (int)(message->GetArgumentList()->GetDouble( 1 ) * (double)m_gadgetManifest.m_width );
		cefEvent.y = (int)( message->GetArgumentList()->GetDouble( 2 ) * (double)m_gadgetManifest.m_height );
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

	if ( m_gadgets.empty() )
	{
		aardvark::avUpdateDxgiTextureForGadgets( &*m_client, nullptr, 0, m_gadgetManifest.m_width, m_gadgetManifest.m_height, m_sharedTexture, true );
	}
	else
	{
		aardvark::avUpdateDxgiTextureForGadgets( &*m_client, &m_gadgets[0], (uint32_t)m_gadgets.size(), m_gadgetManifest.m_width, m_gadgetManifest.m_height, m_sharedTexture, true );
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
