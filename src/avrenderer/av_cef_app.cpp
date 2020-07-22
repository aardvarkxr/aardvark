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

	D3D11CreateDevice( pAdapter, D3D_DRIVER_TYPE_HARDWARE, nullptr, 
		D3D11_CREATE_DEVICE_DEBUG | D3D11_CREATE_DEVICE_BGRA_SUPPORT, 
		featureLevel, 1, D3D11_SDK_VERSION,
		&m_pD3D11Device, &createdFeatureLevel, &m_pD3D11ImmediateContext );

	if ( pAdapter )
	{
		pAdapter->Release();
		pAdapter = nullptr;
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
		CloseAllBrowsers( true );
	}
}

bool CAardvarkCefApp::wantsToQuit()
{
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


using namespace SL::Screen_Capture;

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
		int nTitleLength = GetWindowTextLengthW( newWindow );
		if ( !nTitleLength )
			continue;

		std::vector<wchar_t> title( nTitleLength + 1 );

		int nReadLength = GetWindowTextW( newWindow, &title[ 0 ], nTitleLength + 1 );
		if ( !nReadLength )
		{
			// just skip windows with no title
			continue;
		}

		RECT rect = { 0 };
		if ( !SUCCEEDED( DwmGetWindowAttribute( newWindow, DWMWA_EXTENDED_FRAME_BOUNDS, &rect, sizeof( rect ) ) ) ) 
			continue;

		size_t width = rect.right - rect.left;
		size_t height = rect.bottom - rect.top;

		HDC windowDC = GetWindowDC( newWindow );
		HDC captureDC = CreateCompatibleDC( windowDC );
		HBITMAP captureBitmap = CreateCompatibleBitmap( windowDC, (int)width, (int)height );

		HGDIOBJ origObject = SelectObject( captureDC, captureBitmap );

		BOOL result = PrintWindow( newWindow, captureDC, PW_RENDERFULLCONTENT );

		if ( !result ) 
		{
			result = BitBlt( captureDC, rect.left, rect.top, 
				(int)width, (int)height,
				windowDC, 0, 0, SRCCOPY | CAPTUREBLT );
		}

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
			int res = GetDIBits( windowDC, captureBitmap, 0, (UINT)height, &imageBuffer[0], (BITMAPINFO*)&bi, DIB_RGB_COLORS );
			if ( res <= 0 )
			{
				tools::LogDefault()->warn( "Failed to read bits from window bitmap: %d", res );
			}

			void* sharedHandle = nullptr;
			if ( createTextureForBrowser( &sharedHandle, (int)width, (int)height ) )
			{
				// GetDIBits always passes back zero alpha
				for ( size_t pixel = 0; pixel < width * height; pixel++ )
				{
					imageBuffer[ pixel * 4 + 3 ] = 0xFF;
				}

				updateTexture( sharedHandle, &imageBuffer[ 0 ], (int)width, (int)height );

				WindowCapture cap;
				cap.width = (int32_t)width;
				cap.height = (int32_t)height;
				cap.sharedhandle = sharedHandle;
				cap.hwnd = newWindow;
				cap.windowName = tools::WStringToUtf8( std::wstring( &title[ 0 ] ) );
				sub->captures.push_back( std::move( cap ) );
			}
		}
		SelectObject( captureDC, origObject );
		DeleteDC( captureDC );
	}

	auto pList = getWindowListForSubscription( *sub );
	m_windowListSubscriptions.push_back( std::move( sub ) );
	return pList;
}


CefRefPtr<CefListValue> CAardvarkCefApp::getWindowListForSubscription( const WindowListSubscription& sub )
{
	CefRefPtr<CefListValue> pWindowList = CefListValue::Create();
	pWindowList->SetSize( sub.captures.size() );
	int nWindowIndex = 0;

	for ( auto& capture : sub.captures )
	{
		CefRefPtr<CefListValue> pWindowInfo = CefListValue::Create();
		pWindowInfo->SetString( 0, capture.windowName );
		pWindowInfo->SetString( 1, std::to_string( (uint64_t)capture.hwnd) );
		pWindowInfo->SetString( 2, std::to_string( (uint64_t)capture.sharedhandle ) );
		pWindowInfo->SetInt( 3, capture.width );
		pWindowInfo->SetInt( 4, capture.height );
		pWindowInfo->SetBool( 5, false );

		pWindowList->SetList( nWindowIndex++, pWindowInfo );
	}

	return pWindowList;
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

