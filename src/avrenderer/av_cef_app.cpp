// Copyright (c) 2013 The Chromium Embedded Framework Authors. All rights
// reserved. Use of this source code is governed by a BSD-style license that
// can be found in the LICENSE file.

#include "av_cef_app.h"

#include <string>
#include <algorithm>

#include "include/cef_browser.h"
#include "include/cef_command_line.h"
#include "include/views/cef_browser_view.h"
#include "include/views/cef_window.h"
#include "include/wrapper/cef_helpers.h"
#include "av_cef_handler.h"
#include "av_cef_javascript.h"
#include <aardvark/aardvark_gadget_manifest.h>
#include <tools/logging.h>
#include <tools/stringtools.h>

#include <sdkddkver.h>

#include <openvr.h>
#include <processthreadsapi.h>
#include <windows.h>
#include <dwmapi.h>

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

CAardvarkCefApp::CAardvarkCefApp( const aardvark::AardvarkConfig_t& config )
{
	g_instance = this;
	m_config = config;
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

	vr::EVRInitError err;
	vr::VR_Init( &err, vr::VRApplication_Overlay );
	IDXGIAdapter* pAdapter = nullptr;
	if (err != vr::VRInitError_None)
	{
		IDXGIFactory1* pIDXGIFactory;
		if ( !FAILED(CreateDXGIFactory1( __uuidof(IDXGIFactory1), (void**)&pIDXGIFactory ) ) )
		{
			int32_t nAdapterIndex;
			vr::VRSystem()->GetDXGIOutputInfo(&nAdapterIndex);

			if ( !FAILED( pIDXGIFactory->EnumAdapters( nAdapterIndex, &pAdapter ) ) )
			{
				LOG(INFO) << "Using adapter " << nAdapterIndex << " for graphics device" << std::endl;
			}

		}

		if (pIDXGIFactory)
		{
			pIDXGIFactory->Release();
			pIDXGIFactory = nullptr;
		}
	}
	vr::VR_Shutdown();

	D3D_FEATURE_LEVEL featureLevel[] = { D3D_FEATURE_LEVEL_11_1 };
	D3D_FEATURE_LEVEL createdFeatureLevel;
	
	UINT flags = D3D11_CREATE_DEVICE_BGRA_SUPPORT;
#if defined( _DEBUG )
	flags |= D3D11_CREATE_DEVICE_DEBUG;
#endif

	HRESULT hres = D3D11CreateDevice( pAdapter, D3D_DRIVER_TYPE_HARDWARE, nullptr, 
		flags, featureLevel, 1, D3D11_SDK_VERSION,
		&m_pD3D11Device, &createdFeatureLevel, &m_pD3D11ImmediateContext );

	if ( pAdapter )
	{
		pAdapter->Release();
		pAdapter = nullptr;
	}

	if ( !SUCCEEDED( hres ) )
	{
		LOG( FATAL ) << "Failed to create D3D device" << std::hex << hres;
		return;
	}

	aardvark::GadgetParams_t params = { "http://localhost:23842/gadgets/aardvark_renderer", "", aardvark::EndpointAddr_t() };
	startGadget( params );
}


void CAardvarkCefApp::startGadget( const aardvark::GadgetParams_t& params )
{
	CEF_REQUIRE_UI_THREAD();

	// CAardvarkCefHandler implements browser-level callbacks.
	CefRefPtr<CAardvarkCefHandler> handler( new CAardvarkCefHandler( this, params ) );
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

void CAardvarkCefApp::runFrame()
{
	{
		std::lock_guard<std::mutex> autolock( m_graphicsMutex );
		m_pD3D11ImmediateContext->Flush();
	}

	if ( m_quitRequested && !m_quitHandled )
	{
		m_quitHandled = true;
		m_quitTime = std::chrono::steady_clock::now();
		CloseAllBrowsers( true );
	}

	for ( auto & sub : m_windowSubscriptions )
	{
		switch ( createWindowCapture( &sub.second.capture, sub.second.capture.hwnd, sub.second.imageBuffer ) )
		{
		case WindowCaptureResult::Failed:
			// TODO: Remove from the list?
			break;

		case WindowCaptureResult::UpdatedInfo:
			for ( auto handler : sub.second.handlers )
			{
				sendWindowUpdate( handler, sub.second.capture );
			}
			break;

		case WindowCaptureResult::UpdatedTexture:
			// Nothing to do here. Any gadgets using this window's texture will update next frame
			break;
		}
	}
}

bool CAardvarkCefApp::wantsToQuit()
{
	if ( m_quitHandled )
	{
		// if we've blocked waiting for browsers to exit for more than five seconds, just exit the main
		// aardvarkxr process. CEF will clean up the other processes.
		auto end = std::chrono::steady_clock::now();
		std::chrono::duration<double> elapsed_seconds = end - m_quitTime;
		if ( elapsed_seconds.count() > 5 )
		{
			return true;
		}
	}

	return m_browsers.empty() && m_quitRequested;
}

void CAardvarkCefApp::quitRequested()
{
	m_quitRequested = true;
}


void CAardvarkCefApp::browserClosed( CAardvarkCefHandler *handler )
{
	auto i = std::find( m_browsers.begin(), m_browsers.end(), handler );
	if ( i != m_browsers.end() )
	{
		m_browsers.erase( i );
	}

	for ( auto i = m_windowListSubscriptions.begin(); i != m_windowListSubscriptions.end(); i++ )
	{
		if ( i->get()->handler == handler )
		{
			m_windowListSubscriptions.erase( i );
			break;
		}
	}
}



bool CAardvarkCefApp::createTextureForBrowser( void **sharedHandle, 
	int width, int height )
{
	ID3D11Texture2D* texture = nullptr;
	if ( !createTextureInternal( sharedHandle, &texture, width, height ) )
	{
		return false;
	}

	m_browserTextures.insert( std::make_pair( *sharedHandle, texture ) );

	return true;
}

bool CAardvarkCefApp::createTextureInternal( void **sharedHandle, ID3D11Texture2D** texture, int width, int height )
{
	if ( !m_pD3D11Device )
	{
		return false;
	}

	std::lock_guard<std::mutex> autolock( m_graphicsMutex );
	D3D11_TEXTURE2D_DESC sharedDesc;
	sharedDesc.Width = width;
	sharedDesc.Height = height;
	sharedDesc.MipLevels = sharedDesc.ArraySize = 1;
	sharedDesc.Format = DXGI_FORMAT_R8G8B8A8_UNORM;
	sharedDesc.SampleDesc.Count = 1;
	sharedDesc.SampleDesc.Quality = 0;
	sharedDesc.Usage = D3D11_USAGE_DEFAULT;
	sharedDesc.BindFlags = D3D11_BIND_SHADER_RESOURCE;
	sharedDesc.CPUAccessFlags = 0;
	sharedDesc.MiscFlags = D3D11_RESOURCE_MISC_SHARED;

	HRESULT result = m_pD3D11Device->CreateTexture2D( &sharedDesc, nullptr, texture );
	if ( result != S_OK )
		return false;

	IDXGIResource* dxgiResource = nullptr;
	(*texture)->QueryInterface( __uuidof( IDXGIResource ), (LPVOID*)&dxgiResource );

	void* handle = nullptr;
	dxgiResource->GetSharedHandle( &handle );
	dxgiResource->Release();

	if ( !handle )
	{
		return false;
	}

	*sharedHandle = handle;
	return true;
}

void CAardvarkCefApp::updateTexture( void *sharedHandle, const void *buffer, int width, int height )
{
	std::lock_guard<std::mutex> autolock( m_graphicsMutex );
	auto i = m_browserTextures.find( sharedHandle );
	if ( i == m_browserTextures.end() )
		return;

	D3D11_BOX box;
	box.left = 0;
	box.right = width;
	box.top = 0;
	box.bottom = height;
	box.front = 0;
	box.back = 1;
	m_pD3D11ImmediateContext->UpdateSubresource( i->second, 0, &box, buffer, width * 4, width * height * 4 );
}

void CAardvarkCefApp::resizeTextureForBrowser( void** sharedHandle, int width, int height )
{
	std::lock_guard<std::mutex> autolock( m_graphicsMutex );
	auto i = m_browserTextures.find( sharedHandle );
	if ( i == m_browserTextures.end() )
		return;

	i->second->Release();
	m_browserTextures.erase( i );

	createTextureForBrowser( sharedHandle, width, height );
}


CefRefPtr<CefListValue> CAardvarkCefApp::subscribeToWindowList( CAardvarkCefHandler* handler )
{
	for ( auto& sub : m_windowListSubscriptions )
	{
		// only one subscription is allowed per handler
		if ( sub->handler == handler )
			return getWindowListForSubscription( *sub );
	}

	ANIMATIONINFO str;
	str.cbSize = sizeof( str );
	str.iMinAnimate = 0;
	SystemParametersInfo( SPI_SETANIMATION, sizeof( str ), (void*)&str, SPIF_UPDATEINIFILE | SPIF_SENDCHANGE );

	// get the new list
	std::vector<HWND> windows;
	auto fnTopLevelCallback = [ &windows ]( HWND hwnd, LPARAM unused ) {
		(void)unused;

		if ( !IsWindowVisible( hwnd ) )
			return TRUE;

		if ( !IsWindowEnabled( hwnd ) )
			return TRUE;

		long lstyle = GetWindowLong( hwnd, GWL_STYLE );
		if ( ( lstyle & WS_CHILDWINDOW ) )
			return TRUE;

		windows.push_back( hwnd );

		return TRUE;
	};
	EnumWindows( []( HWND hwnd, LPARAM callbackParam ) { return ( *static_cast<decltype( fnTopLevelCallback )*>( (void*)callbackParam ) )( hwnd, 0 ); },
		(LPARAM)&fnTopLevelCallback );

	CefRefPtr<CefListValue> pWindowList = CefListValue::Create();
	pWindowList->SetSize( windows.size() );

	std::vector<uint8_t> imageBuffer;

	std::unique_ptr<WindowListSubscription> sub = std::make_unique<WindowListSubscription>();
	sub->handler = handler;
	for ( HWND newWindow : windows )
	{
		WindowCapture cap;
		if ( WindowCaptureResult::Failed != createWindowCapture( &cap, newWindow, imageBuffer ) )
		{
			sub->captures.push_back( std::move( cap ) );
		}
	}

	auto pList = getWindowListForSubscription( *sub );
	m_windowListSubscriptions.push_back( std::move( sub ) );
	return pList;
}


CAardvarkCefApp::WindowCaptureResult CAardvarkCefApp::createWindowCapture( CAardvarkCefApp::WindowCapture *cap, HWND hwnd, std::vector<uint8_t> & imageBuffer )
{
	int nTitleLength = GetWindowTextLengthW( hwnd );
	if ( !nTitleLength )
		return WindowCaptureResult::Failed;

	std::vector<wchar_t> title( nTitleLength + 1 );

	int nReadLength = GetWindowTextW( hwnd, &title[ 0 ], nTitleLength + 1 );
	if ( !nReadLength )
	{
		// just skip windows with no title
		return WindowCaptureResult::Failed;
	}

	RECT rect = { 0 };
	if ( !SUCCEEDED( DwmGetWindowAttribute( hwnd, DWMWA_EXTENDED_FRAME_BOUNDS, &rect, sizeof( rect ) ) ) )
		return WindowCaptureResult::Failed;

	size_t width = rect.right - rect.left;
	size_t height = rect.bottom - rect.top;

	bool bNeedToRecreateTexture = cap->sharedhandle == nullptr || width != cap->width || height != cap->height;

	std::string newName = tools::WStringToUtf8( std::wstring( &title[ 0 ] ) );
	bool bNeedInfoUpdate = bNeedToRecreateTexture || newName != cap->windowName;

	HDC windowDC = GetWindowDC( hwnd );
	HDC captureDC = CreateCompatibleDC( windowDC );
	HBITMAP captureBitmap = CreateCompatibleBitmap( windowDC, (int)width, (int)height );

	HGDIOBJ origObject = SelectObject( captureDC, captureBitmap );

	BOOL result = PrintWindow( hwnd, captureDC, PW_RENDERFULLCONTENT );

	if ( !result )
	{
		result = BitBlt( captureDC, rect.left, rect.top,
			(int)width, (int)height,
			windowDC, 0, 0, SRCCOPY | CAPTUREBLT );
	}

	bool failed = true;
	if ( result )
	{
		BITMAPINFOHEADER bi = { 0 };

		size_t bufferSize = width * height * 4;
		if ( bufferSize > imageBuffer.size() )
		{
			imageBuffer.resize( bufferSize );
		}

		bi.biSize = sizeof( BITMAPINFOHEADER );

		bi.biWidth = (int)width;
		bi.biHeight = -(int)height;
		bi.biPlanes = 1;
		bi.biBitCount = 32;
		bi.biCompression = BI_RGB;
		bi.biSizeImage = (int)bufferSize;
		int res = GetDIBits( windowDC, captureBitmap, 0, (UINT)height, &imageBuffer[ 0 ], (BITMAPINFO*)&bi, DIB_RGB_COLORS );
		if ( res <= 0 )
		{
			tools::LogDefault()->warn( "Failed to read bits from window bitmap: %d", res );
		}

		if ( bNeedToRecreateTexture )
		{
			if ( cap->sharedhandle )
			{
				// TODO: destroy shared texture
			}
			cap->sharedhandle = nullptr;
			createTextureForBrowser( &cap->sharedhandle, (int)width, (int)height );
		}

		if ( cap->sharedhandle )
		{
			// GetDIBits always passes back zero alpha
			for ( size_t pixel = 0; pixel < width * height; pixel++ )
			{
				imageBuffer[ pixel * 4 + 3 ] = 0xFF;
			}

			updateTexture( cap->sharedhandle, &imageBuffer[ 0 ], (int)width, (int)height );
			cap->width = (int32_t)width;
			cap->height = (int32_t)height;
			cap->hwnd = hwnd;
			cap->windowName = newName;

			failed = false;
		}
	}

	SelectObject( captureDC, origObject );
	ReleaseDC( hwnd, windowDC );
	DeleteObject( captureBitmap );
	DeleteDC( captureDC );

	if ( failed )
	{
		return WindowCaptureResult::Failed;
	}
	else if ( bNeedInfoUpdate )
	{
		return WindowCaptureResult::UpdatedInfo;
	}
	else
	{
		return WindowCaptureResult::UpdatedTexture;
	}
}


CefRefPtr<CefListValue> CAardvarkCefApp::getWindowListForSubscription( const WindowListSubscription& sub )
{
	CefRefPtr<CefListValue> pWindowList = CefListValue::Create();
	pWindowList->SetSize( sub.captures.size() );
	int nWindowIndex = 0;

	for ( auto& capture : sub.captures )
	{
		pWindowList->SetList( nWindowIndex++, createCaptureMessage( capture ) );
	}

	return pWindowList;
}


CefRefPtr<CefListValue> CAardvarkCefApp::createCaptureMessage( const WindowCapture& capture )
{
	CefRefPtr<CefListValue> pWindowInfo = CefListValue::Create();
	pWindowInfo->SetString( 0, capture.windowName );
	pWindowInfo->SetString( 1, std::to_string( (uint64_t)capture.hwnd ) );
	pWindowInfo->SetString( 2, std::to_string( (uint64_t)capture.sharedhandle ) );
	pWindowInfo->SetInt( 3, capture.width );
	pWindowInfo->SetInt( 4, capture.height );
	pWindowInfo->SetBool( 5, false );
	return pWindowInfo;
}


void CAardvarkCefApp::unsubscribeFromWindowList( CAardvarkCefHandler* handler )
{
	for ( WindowListSubscriptionVector::iterator i = m_windowListSubscriptions.begin(); i != m_windowListSubscriptions.end(); i++ )
	{
		// only one subscription is allowed per handler
		if ( (*i)->handler == handler )
		{
			m_windowListSubscriptions.erase( i );
			break;
		}
	}
}


void CAardvarkCefApp::sendWindowUpdate( CAardvarkCefHandler* handler, const CAardvarkCefApp::WindowCapture& capture )
{
	handler->windowUpdate( createCaptureMessage( capture ) );
}


void CAardvarkCefApp::subscribeToWindow( CAardvarkCefHandler* handler, const std::string& windowHandle )
{
	HWND hwnd = (HWND)std::stoull( windowHandle );

	auto i = m_windowSubscriptions.find( hwnd );
	if ( i != m_windowSubscriptions.end() )
	{
		i->second.handlers.push_back( handler );
		sendWindowUpdate( handler, i->second.capture );
	}

	WindowSubscription sub;
	if ( WindowCaptureResult::Failed != createWindowCapture( &sub.capture, hwnd, sub.imageBuffer ) )
	{
		sub.handlers.push_back( handler );
		auto insert = m_windowSubscriptions.insert( 
			std::make_pair< HWND, WindowSubscription>( std::move( hwnd ), std::move( sub ) ) );
		sendWindowUpdate( handler, insert.first->second.capture );
	}
}


void CAardvarkCefApp::unsubscribeFromWindow( CAardvarkCefHandler* handler, const std::string& windowHandle )
{
	HWND hwnd = (HWND)std::stoull( windowHandle );

	auto i = m_windowSubscriptions.find( hwnd );
	if ( i == m_windowSubscriptions.end() )
	{
		return;
	}

	i->second.handlers.erase( std::remove_if( i->second.handlers.begin(), i->second.handlers.end(), [ handler ]( CAardvarkCefHandler* entry )
		{
			return entry == handler;
		} ), i->second.handlers.end() );

	if ( i->second.handlers.empty() )
	{
		//TODO: free the DXGI texture
		m_windowSubscriptions.erase( i );
	}
}

