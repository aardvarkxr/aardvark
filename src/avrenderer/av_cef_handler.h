// Copyright (c) 2013 The Chromium Embedded Framework Authors. All rights
// reserved. Use of this source code is governed by a BSD-style license that
// can be found in the LICENSE file.

#ifndef CEF_TESTS_CEFSIMPLE_SIMPLE_HANDLER_H_
#define CEF_TESTS_CEFSIMPLE_SIMPLE_HANDLER_H_

#include "include/cef_client.h"

#include <aardvark/aardvark_client.h>

#include <list>
#include <set>
#include <map>
#include <memory>

class IApplication;

class CAardvarkCefHandler : public CefClient,
                      public CefDisplayHandler,
                      public CefLifeSpanHandler,
                      public CefLoadHandler,
					  public CefRenderHandler
{
public:
	explicit CAardvarkCefHandler(bool use_views, IApplication *application, const std::vector<std::string> & vecPermissions );
	~CAardvarkCefHandler();

	// CefClient methods:
	virtual CefRefPtr<CefDisplayHandler> GetDisplayHandler() override 
	{
		return this;
	}
	virtual CefRefPtr<CefLifeSpanHandler> GetLifeSpanHandler() override 
	{
		return this;
	}
	virtual CefRefPtr<CefLoadHandler> GetLoadHandler() override { return this; }
	virtual CefRefPtr<CefRenderHandler> GetRenderHandler() override { return this; }
	virtual bool OnProcessMessageReceived( CefRefPtr<CefBrowser> browser,
		CefProcessId source_process,
		CefRefPtr<CefProcessMessage> message ) override;

	// CefDisplayHandler methods:
	virtual void OnTitleChange(CefRefPtr<CefBrowser> browser,
								const CefString& title) override;

	// CefLifeSpanHandler methods:
	virtual void OnAfterCreated(CefRefPtr<CefBrowser> browser) override;
	virtual bool DoClose(CefRefPtr<CefBrowser> browser) override;
	virtual void OnBeforeClose(CefRefPtr<CefBrowser> browser) override;

	// CefLoadHandler methods:
	virtual void OnLoadError(CefRefPtr<CefBrowser> browser,
							CefRefPtr<CefFrame> frame,
							ErrorCode errorCode,
							const CefString& errorText,
							const CefString& failedUrl) override;

	// CefRenderHandler methods:
	virtual void GetViewRect( CefRefPtr<CefBrowser> browser, CefRect& rect ) override;
	virtual void OnPaint( CefRefPtr<CefBrowser> browser,
		PaintElementType type,
		const RectList& dirtyRects,
		const void* buffer,
		int width,
		int height ) override;
	virtual void OnAcceleratedPaint( CefRefPtr<CefBrowser> browser,
		PaintElementType type,
		const RectList& dirtyRects,
		void* shared_handle ) override;

	bool IsClosing() const { return m_isClosing; }

	void triggerClose( bool forceClose );

	private:
	// Platform-specific implementation.
	void PlatformTitleChange(CefRefPtr<CefBrowser> browser,
							const CefString& title);


	void RunFrame();

	// True if the application is using the Views framework.
	const bool m_useViews;

	CefRefPtr<CefBrowser> m_browser;

	bool m_isClosing;
	IApplication *m_application = nullptr;

	int m_width = 1024, m_height = 1024;

	std::vector<std::string> m_apps;
	void *m_sharedTexture = nullptr;

	void updateSceneGraphTextures();

	std::unique_ptr< aardvark::CAardvarkClient > m_client;
	std::vector<std::string> m_permissions;

	// Include the default reference counting implementation.
	IMPLEMENT_REFCOUNTING(CAardvarkCefHandler);
};

#endif  // CEF_TESTS_CEFSIMPLE_SIMPLE_HANDLER_H_
