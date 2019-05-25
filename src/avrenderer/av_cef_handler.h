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
	explicit CAardvarkCefHandler(bool use_views, IApplication *application );
	~CAardvarkCefHandler();

	// Provide access to the single global instance of this object.
	static CAardvarkCefHandler* GetInstance();

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

	// Request that all existing browser windows close.
	void CloseAllBrowsers(bool force_close);

	bool IsClosing() const { return m_isClosing; }

	private:
	// Platform-specific implementation.
	void PlatformTitleChange(CefRefPtr<CefBrowser> browser,
							const CefString& title);


	void RunFrame();

	// True if the application is using the Views framework.
	const bool m_useViews;

	// List of existing browser windows. Only accessed on the CEF UI thread.
	typedef std::list<CefRefPtr<CefBrowser>> BrowserList;
	BrowserList m_browserList;

	bool m_isClosing;
	IApplication *m_application = nullptr;

	int m_width = 1024, m_height = 1024;

	struct BrowserInfo_t
	{
		std::vector<std::string> m_apps;
		void *m_sharedTexture = nullptr;
	};
	std::map<int, std::unique_ptr<BrowserInfo_t> > m_browserInfo;

	void updateSceneGraphTextures( CAardvarkCefHandler::BrowserInfo_t & browserInfo );

	std::unique_ptr< aardvark::CAardvarkClient > m_client;

	// Include the default reference counting implementation.
	IMPLEMENT_REFCOUNTING(CAardvarkCefHandler);
};

#endif  // CEF_TESTS_CEFSIMPLE_SIMPLE_HANDLER_H_
