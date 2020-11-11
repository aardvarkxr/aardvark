// Copyright (c) 2013 The Chromium Embedded Framework Authors. All rights
// reserved. Use of this source code is governed by a BSD-style license that
// can be found in the LICENSE file.

#pragma once

#include "include/cef_app.h"
#include "av_cef_handler.h"
#include "iapplication.h"

#include <thread>
#include <d3d11.h>

// Implement application-level callbacks for the browser process.
class CAardvarkCefApp : public CefApp, public CefBrowserProcessHandler , IApplication
{
public:
	CAardvarkCefApp( const aardvark::AardvarkConfig_t & config );
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

	bool IsInstanceOfGadgetRunning( const aardvark::GadgetParams_t& params );

	virtual void quitRequested() override;
	virtual void browserClosed( CAardvarkCefHandler *handler ) override;
	virtual bool createTextureForBrowser( void **sharedHandle,
		int width, int height ) override;
	virtual void updateTexture( void* sharedHandle, const void* buffer, int width, int height ) override;
	virtual CefRefPtr<CefListValue> subscribeToWindowList( CAardvarkCefHandler* handler ) override;
	virtual void unsubscribeFromWindowList( CAardvarkCefHandler* handler ) override;
	virtual void subscribeToWindow( CAardvarkCefHandler* handler, const std::string& windowHandle ) override;
	virtual void unsubscribeFromWindow( CAardvarkCefHandler* handler, const std::string& windowHandle ) override;
	virtual const aardvark::AardvarkConfig_t& getConfig() const override { return m_config; }


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
	aardvark::AardvarkConfig_t m_config;

	std::map<void *, ID3D11Texture2D *> m_browserTextures;

	struct WindowCapture
	{
		HWND hwnd = nullptr;
		void* sharedhandle = nullptr;
		uint32_t width = 0;
		uint32_t height = 0;
		std::string windowName;
	};

	enum class WindowCaptureResult
	{
		Failed, // capture could not be created or has stopped working
		UpdatedInfo, // something about the window has changed and subscribers should be updated
		UpdatedTexture, // The shared texture has been updated. No need to update subscribers
	};

	void sendWindowUpdate( CAardvarkCefHandler* handler, const WindowCapture& capture );
	WindowCaptureResult createWindowCapture( WindowCapture* cap, HWND hwnd, std::vector<uint8_t> & imageBuffer );

	struct WindowSubscription
	{
		std::vector<CAardvarkCefHandler*> handlers;
		WindowCapture capture;
		std::vector<uint8_t> imageBuffer;
	};
	std::map<HWND, WindowSubscription> m_windowSubscriptions;

	struct WindowListSubscription
	{
		CAardvarkCefHandler* handler = nullptr;
		std::vector<WindowCapture> captures;
	};
	typedef std::vector< std::unique_ptr<WindowListSubscription> > WindowListSubscriptionVector;
	std::vector< std::unique_ptr<WindowListSubscription> > m_windowListSubscriptions;

	CefRefPtr<CefListValue> getWindowListForSubscription( const WindowListSubscription& sub );

	CefRefPtr<CefListValue> createCaptureMessage( const WindowCapture& capture );

	// Include the default reference counting implementation.
	IMPLEMENT_REFCOUNTING(CAardvarkCefApp);
};

