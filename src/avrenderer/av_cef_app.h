// Copyright (c) 2013 The Chromium Embedded Framework Authors. All rights
// reserved. Use of this source code is governed by a BSD-style license that
// can be found in the LICENSE file.

#pragma once

#include "include/cef_app.h"
#include "av_cef_handler.h"
#include "iapplication.h"
#include <screen_capture_lite/include/ScreenCapture.h>

#include <thread>
#include <d3d11.h>

// Implement application-level callbacks for the browser process.
class CAardvarkCefApp : public CefApp, public CefBrowserProcessHandler , IApplication
{
public:
	CAardvarkCefApp();
	virtual ~CAardvarkCefApp();

	static CAardvarkCefApp* instance();

	// CefApp methods:
	virtual CefRefPtr<CefBrowserProcessHandler> GetBrowserProcessHandler() override
	{
		return this;
	}
	virtual CefRefPtr<CefRenderProcessHandler> GetRenderProcessHandler() override;

	// CefBrowserProcessHandler methods:
	virtual void OnContextInitialized() override;
	virtual void OnBeforeCommandLineProcessing( const CefString& processType, CefRefPtr<CefCommandLine> commandLine ) override;

	// Request that all existing browser windows close.
	void CloseAllBrowsers( bool force_close );

	void startGadget( const aardvark::GadgetParams_t& params );

	virtual void quitRequested() override;
	virtual void browserClosed( CAardvarkCefHandler *handler ) override;
	virtual bool createTextureForBrowser( void **sharedHandle,
		int width, int height ) override;
	virtual void updateTexture( void* sharedHandle, const void* buffer, int width, int height ) override;
	virtual CefRefPtr<CefListValue> subscribeToWindowList( CAardvarkCefHandler* handler ) override;
	virtual void unsubscribeFromWindowList( CAardvarkCefHandler* handler ) override;


	bool wantsToQuit();
	void runFrame();
private:
	bool createTextureInternal( void** sharedHandle, ID3D11Texture2D** texture, int width, int height );
	void resizeTextureForBrowser( void** sharedHandle, int width, int height );

	CefRefPtr<CefRenderProcessHandler> m_renderProcessHandler;
	bool m_quitRequested = false;
	bool m_quitHandled = false;

	std::vector< CefRefPtr<CAardvarkCefHandler> > m_browsers;
	ID3D11Device *m_pD3D11Device = nullptr;
	ID3D11DeviceContext *m_pD3D11ImmediateContext = nullptr;
	std::mutex m_graphicsMutex;

	std::map<void *, ID3D11Texture2D *> m_browserTextures;

	struct WindowCapture
	{
		uint32_t width;
		uint32_t height;
		void* sharedhandle;
		std::string windowName;
		std::vector<uint8_t> buffer;
	};


	struct WindowListSubscription
	{
		CAardvarkCefHandler* handler = nullptr;
		std::map<size_t, WindowCapture> captures;
		std::shared_ptr< SL::Screen_Capture::ICaptureConfiguration<SL::Screen_Capture::WindowCaptureCallback> > captureHandler;
	};
	typedef std::vector< std::unique_ptr<WindowListSubscription> > WindowListSubscriptionVector;
	std::vector< std::unique_ptr<WindowListSubscription> > m_windowListSubscriptions;

	CefRefPtr<CefListValue> getWindowListForSubscription( const WindowListSubscription& sub );

	// Include the default reference counting implementation.
	IMPLEMENT_REFCOUNTING(CAardvarkCefApp);
};

