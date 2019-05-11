// Copyright (c) 2013 The Chromium Embedded Framework Authors. All rights
// reserved. Use of this source code is governed by a BSD-style license that
// can be found in the LICENSE file.

#pragma once

#include "include/cef_app.h"

#include <thread>

class IApplication
{
public:
	virtual void allBrowsersClosed() = 0;
};


// Implement application-level callbacks for the browser process.
class CAardvarkCefApp : public CefApp, public CefBrowserProcessHandler 
{
public:
	CAardvarkCefApp( IApplication *application );

	// CefApp methods:
	virtual CefRefPtr<CefBrowserProcessHandler> GetBrowserProcessHandler() override
	{
		return this;
	}

	// CefBrowserProcessHandler methods:
	virtual void OnContextInitialized() OVERRIDE;

	private:
	IApplication *m_application = nullptr;

	// Include the default reference counting implementation.
	IMPLEMENT_REFCOUNTING(CAardvarkCefApp);
};

