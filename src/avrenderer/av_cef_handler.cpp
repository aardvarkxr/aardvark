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
#include <tools/pathtools.h>
#include <tools/logging.h>
#include <tools/stringtools.h>

#include <json/json.hpp>


CAardvarkCefHandler::CAardvarkCefHandler( IApplication *application, const aardvark::GadgetParams_t& params )
    : m_useViews( false ), m_isClosing(false) 
{
	m_params = params;

	m_application = application;
}


CAardvarkCefHandler::~CAardvarkCefHandler() 
{
}

// Called after creation to kick off the gadget
void CAardvarkCefHandler::start()
{
	m_uriRequestHandler.requestUri( m_params.uri + "/manifest.webmanifest",
		[this]( CUriRequestHandler::Result_t & result )
	{
		this->onGadgetManifestReceived( result.success, result.data );
	} );

	CefPostDelayedTask( TID_UI, base::Bind( &CAardvarkCefHandler::RunFrame, this ), 0 );
}


// Called when the manifest load is completed
void CAardvarkCefHandler::onGadgetManifestReceived( bool success, const std::vector< uint8_t > & manifestData )
{
	if ( !success )
	{
		LOG( ERROR ) << "Failed to load manifest for " << this->m_params.uri << ".";
		return;
	}

	try
	{
		nlohmann::json j = nlohmann::json::parse( manifestData.begin(), manifestData.end() );
		m_gadgetManifest = j.get<CWebAppManifest>();
	}
	catch ( nlohmann::json::exception &  )
	{
		// manifest parse failed
		LOG( ERROR ) << "Failed to parse manifest for " << this->m_params.uri << ".";
		return;
	}

	m_gadgetManifestString = std::string( manifestData.begin(), manifestData.end() );

	// Specify CEF browser settings here.
	CefBrowserSettings browser_settings;

	CefWindowInfo window_info;

	// On Windows we need to specify certain flags that will be passed to
	// CreateWindowEx().
	window_info.SetAsPopup( NULL, m_gadgetManifest.m_name );

	window_info.windowless_rendering_enabled = true;
	//window_info.shared_texture_enabled = true;

	window_info.width = m_gadgetManifest.m_aardvark.m_width;
	window_info.height = m_gadgetManifest.m_aardvark.m_height;
	window_info.x = window_info.y = 0;

	browser_settings.windowless_frame_rate = 90;

	std::string fullUri = m_params.uri + "/index.html";

	std::map<std::string, std::string> mapArgs;

	if ( !m_params.initialInterfaces.empty() )
	{
		mapArgs["initialInterfaces"] = m_params.initialInterfaces;
	}
	if ( m_params.epToNotify.type != aardvark::EEndpointType::Unknown )
	{
		mapArgs["epToNotify"] = aardvark::endpointAddrToString( this->m_params.epToNotify );
	}

	std::string sArgs;
	for ( auto & i : mapArgs )
	{
		sArgs += sArgs.empty() ? "?" : "&";
		sArgs += i.first +  "=" + i.second;
	}
	fullUri += sArgs;

	// create the texture to copy the rendered image into
	m_application->createTextureForBrowser( &m_sharedTexture,
		window_info.width, window_info.height );

	// Create the first browser window.
	CefBrowserHost::CreateBrowser( window_info, this, fullUri, browser_settings, nullptr,
		NULL );
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
	m_resourceRequestHandler = new CAardvarkResourceRequestHandler;

	CefRefPtr<CefProcessMessage> msg = CefProcessMessage::Create( "gadget_info" );
	msg->GetArgumentList()->SetString( 0, nlohmann::json( m_params ).dump() );
	msg->GetArgumentList()->SetString( 1, m_gadgetManifestString );
	msg->GetArgumentList()->SetString( 2, nlohmann::json( m_application->getConfig() ).dump() );

	m_browser->GetFocusedFrame()->SendProcessMessage( PID_RENDERER, msg );
	
	updateSceneGraphTextures();
}


bool CAardvarkCefHandler::DoClose(CefRefPtr<CefBrowser> browser) 
{
	CEF_REQUIRE_UI_THREAD();

	// Set a flag to indicate that the window close should be allowed.
	m_isClosing = true;

	m_application->browserClosed( this );

	// Allow the close. For windowed browsers this will result in the OS close
	// event being sent.
	return false;
}

void CAardvarkCefHandler::OnBeforeClose(CefRefPtr<CefBrowser> browser) 
{
	CEF_REQUIRE_UI_THREAD();
	m_browser = nullptr;
	m_resourceRequestHandler = nullptr;
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
	//frame->LoadString(ss.str(), failedUrl);
}


void CAardvarkCefHandler::GetViewRect( CefRefPtr<CefBrowser> browser, CefRect& rect )
{
	rect.x = 0;
	rect.y = 0;
	rect.width = m_gadgetManifest.m_aardvark.m_width;
	rect.height = m_gadgetManifest.m_aardvark.m_height;
}

void CAardvarkCefHandler::OnPaint( CefRefPtr<CefBrowser> browser,
	PaintElementType type,
	const RectList& dirtyRects,
	const void* buffer,
	int width,
	int height )
{
	// we don't care about the slow paint, just the GPU paint in OnAcceleratedPaint
	assert( m_gadgetManifest.m_aardvark.m_width == width );
	assert( m_gadgetManifest.m_aardvark.m_height == height );

	m_application->updateTexture( m_sharedTexture, buffer, width, height );

	if ( m_firstPaint )
	{
		updateSceneGraphTextures();
		m_firstPaint = false;
	}
}


void CAardvarkCefHandler::OnAcceleratedPaint( CefRefPtr<CefBrowser> browser,
	PaintElementType type,
	const RectList& dirtyRects,
	void* shared_handle )
{
	//if ( m_sharedTexture != shared_handle )
	//{
	//	m_sharedTexture = shared_handle;
	//	if ( m_wantsTexture )
	//	{
	//		updateSceneGraphTextures();
	//	}
	//}
}


bool CAardvarkCefHandler::OnProcessMessageReceived( CefRefPtr<CefBrowser> browser,
	CefRefPtr<CefFrame> frame,
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
	else if ( message->GetName() == "quit" )
	{
		m_application->quitRequested();
	}
	else if ( message->GetName() == "start_gadget" )
	{
		std::string jsonString( message->GetArgumentList()->GetString( 0 ) );

		try
		{
			nlohmann::json j = nlohmann::json::parse( jsonString );
			aardvark::GadgetParams_t params = j.get<aardvark::GadgetParams_t>();

			CAardvarkCefApp::instance()->startGadget( params );
		}
		catch ( nlohmann::json::exception & e )
		{
			LOG( ERROR ) << "Failed to parse gadget params from " << jsonString << ".";
			(void)e;
		}
	}
	else if ( message->GetName() == "request_texture_info" )
	{
		m_wantsTexture = true;
		updateSceneGraphTextures();
	}
	else if ( message->GetName() == "request_close" )
	{
		browser->GetHost()->CloseBrowser( true );
	}
	else if ( message->GetName() == "mouse_event" )
	{
		CefMouseEvent cefEvent;
		cefEvent.x = (int)(message->GetArgumentList()->GetDouble( 1 ) * (double)m_gadgetManifest.m_aardvark.m_width );
		cefEvent.y = (int)( message->GetArgumentList()->GetDouble( 2 ) * (double)m_gadgetManifest.m_aardvark.m_height );
		cefEvent.modifiers = 0;

		CefKeyEvent cefKeyEvent;
		cefKeyEvent.type = KEYEVENT_KEYDOWN;
		cefKeyEvent.native_key_code = 38;


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
			//Testing Keyboard Iput being sent to panel
			browser->GetHost()->SendKeyEvent(cefKeyEvent);
		}
		break;

		case aardvark::EPanelMouseEventType::Up:
		{
			browser->GetHost()->SendMouseClickEvent( cefEvent, MBT_LEFT, true, 1 );
		}
		break;

		}
	}
	else if (message->GetName() == "keyboard_event")
	{
		CefKeyEvent cefEvent;
		//hardcoding to the up button while I just get this input stuff plumbed in
		cefEvent.windows_key_code = 38;
		cefEvent.type = KEYEVENT_KEYDOWN;
		browser->GetHost()->SendKeyEvent(cefEvent);

		//cefEvent.windows_key_code = (int)(message->GetArgumentList()->GetInt( 1 ) );
		/*
		vbKeyLeft   37  LEFT ARROW key
		vbKeyUp     38  UP ARROW key
		vbKeyRight  39  RIGHT ARROW key
		vbKeyDown   40  DOWN ARROW key
		
		*/

	}
	else if ( message->GetName() == "subscribe_window_list" )
	{
		auto pList = m_application->subscribeToWindowList( this );

		CefRefPtr<CefProcessMessage> msg = CefProcessMessage::Create( "window_list" );

		if ( pList )
		{
			msg->GetArgumentList()->SetList( 0, pList );
		}
		m_browser->GetFocusedFrame()->SendProcessMessage( PID_RENDERER, msg );
	}
	else if ( message->GetName() == "unsubscribe_window_list" )
	{
		m_application->unsubscribeFromWindowList( this );
	}
	else if ( message->GetName() == "subscribe_window" )
	{
		m_application->subscribeToWindow( this, message->GetArgumentList()->GetString( 0 ) );
	}
	else if ( message->GetName() == "unsubscribe_window" )
	{
		m_application->unsubscribeFromWindow( this, message->GetArgumentList()->GetString( 0 ) );
	}

	return false;
}


void CAardvarkCefHandler::updateSceneGraphTextures()
{
	if ( !m_sharedTexture || !m_wantsTexture )
	{
		// if we don't have a shared texture or gadget yet, there's nothing to update
		return;
	}

	CefRefPtr<CefProcessMessage> msg = CefProcessMessage::Create( "update_shared_texture" );
	msg->GetArgumentList()->SetString( 0, std::to_string( (uint64_t)m_sharedTexture ) );
	msg->GetArgumentList()->SetInt( 1, m_gadgetManifest.m_aardvark.m_width );
	msg->GetArgumentList()->SetInt( 2, m_gadgetManifest.m_aardvark.m_height );
	msg->GetArgumentList()->SetBool( 3, false );
	m_browser->GetFocusedFrame()->SendProcessMessage( PID_RENDERER, msg );
}


void CAardvarkCefHandler::RunFrame()
{
	if ( !m_isClosing )
	{
		CefPostDelayedTask( TID_UI, base::Bind( &CAardvarkCefHandler::RunFrame, this ), 11 );
	}

	m_uriRequestHandler.doCefRequestWork();
	m_uriRequestHandler.processResults();
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

	if( m_browser )
		m_browser->GetHost()->CloseBrowser( forceClose );
}


void CAardvarkResourceRequestHandler::OnProtocolExecution( CefRefPtr<CefBrowser> browser,
	CefRefPtr<CefFrame> frame,
	CefRefPtr<CefRequest> request,
	bool& allow_os_execution )
{
	std::string url = request->GetURL();
	allow_os_execution = tools::stringIsPrefix( "pluto://", url )
		|| tools::stringIsPrefix( "steam://", url )
		|| tools::stringIsPrefix( "aardvark://", url );

	// we never want to keep these dead windows around
	browser->GetHost()->CloseBrowser( true );
}


// -----------------------------------------------------------------------------------------------------
// Purpose: Called when a window info changes for a subscribed window
// -----------------------------------------------------------------------------------------------------
void CAardvarkCefHandler::windowUpdate( CefRefPtr<CefListValue> windowInfo )
{
	CefRefPtr<CefProcessMessage> msg = CefProcessMessage::Create( "window_update" );
	msg->GetArgumentList()->SetList( 0, windowInfo );
	m_browser->GetFocusedFrame()->SendProcessMessage( PID_RENDERER, msg );
}


// -----------------------------------------------------------------------------------------------------
// Purpose: Called when a window info changes for a subscribed window
// -----------------------------------------------------------------------------------------------------
void CAardvarkCefHandler::OnRenderProcessTerminated( CefRefPtr<CefBrowser> browser,
	TerminationStatus status )
{
	LOG( ERROR ) << "Exiting because process for " << this->m_params.uri << " crashed.";
	m_application->quitRequested();
}

