// Copyright (c) 2013 The Chromium Embedded Framework Authors. All rights
// reserved. Use of this source code is governed by a BSD-style license that
// can be found in the LICENSE file.

#pragma once

#include "include/cef_app.h"
#include "av_cef_handler.h"
#include "iapplication.h"

#include <thread>


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

	void startGadget( const std::string & uri, const std::string & initialHook, const std::string & persistentUuid,
		const aardvark::EndpointAddr_t & epToNotify );

	virtual void quitRequested() override;
	virtual void browserClosed( CAardvarkCefHandler *handler ) override;

	bool wantsToQuit();
private:

	CefRefPtr<CefRenderProcessHandler> m_renderProcessHandler;
	bool m_quitRequested = false;

	std::vector< CefRefPtr<CAardvarkCefHandler> > m_browsers;

	// Include the default reference counting implementation.
	IMPLEMENT_REFCOUNTING(CAardvarkCefApp);
};

