// Copyright (c) 2013 The Chromium Embedded Framework Authors. All rights
// reserved. Use of this source code is governed by a BSD-style license that
// can be found in the LICENSE file.

#pragma once

#include "include/cef_app.h"

#include <thread>

// Implement application-level callbacks for the browser process.
class SimpleApp : public CefApp, public CefBrowserProcessHandler {
 public:
  SimpleApp();

  // CefApp methods:
  virtual CefRefPtr<CefBrowserProcessHandler> GetBrowserProcessHandler()
      OVERRIDE {
    return this;
  }

  // CefBrowserProcessHandler methods:
  virtual void OnContextInitialized() OVERRIDE;

 private:
  // Include the default reference counting implementation.
  IMPLEMENT_REFCOUNTING(SimpleApp);
};

class CCefThread
{
public:
	CCefThread( const CefMainArgs & mainArgs, void *sandbox_info );

	void Start();
	void Join();

private:
	void Run();

	CefMainArgs m_mainArgs;
	void *m_sandboxInfo = nullptr;
	std::thread m_thread;
};

