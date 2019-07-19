// Copyright (c) 2013 The Chromium Embedded Framework Authors. All rights
// reserved. Use of this source code is governed by a BSD-style license that
// can be found in the LICENSE file.

#ifndef CEF_TESTS_CEFSIMPLE_SIMPLE_HANDLER_H_
#define CEF_TESTS_CEFSIMPLE_SIMPLE_HANDLER_H_

#include "include/cef_client.h"
#include <include/cef_urlrequest.h>

#include <aardvark/aardvark_client.h>
#include <aardvark/aardvark_gadget_manifest.h>

#include "uri_request_handler.h"

#include <list>
#include <set>
#include <map>
#include <memory>

class CAardvarkCefHandler;

class CStartGadgetRequestClient : public CefURLRequestClient
{
public:
	CStartGadgetRequestClient( CAardvarkCefHandler *cefHandler );

	void OnRequestComplete( CefRefPtr<CefURLRequest> request ) override;

	void OnUploadProgress( CefRefPtr<CefURLRequest> request,
		int64 current,
		int64 total ) override;

	void OnDownloadProgress( CefRefPtr<CefURLRequest> request,
		int64 current,
		int64 total ) override;

	void OnDownloadData( CefRefPtr<CefURLRequest> request,
		const void* data,
		size_t data_length ) override;

	bool GetAuthCredentials( bool isProxy,
		const CefString& host,
		int port,
		const CefString& realm,
		const CefString& scheme,
		CefRefPtr<CefAuthCallback> callback ) override;

private:
	CAardvarkCefHandler *m_cefHandler = nullptr;

	std::string m_downloadData;

private:
	IMPLEMENT_REFCOUNTING( CStartGadgetRequestClient );
};


class IApplication;

class CAardvarkCefHandler : public CefClient,
                      public CefDisplayHandler,
                      public CefLifeSpanHandler,
                      public CefLoadHandler,
					  public CefRequestHandler,
					  public CefRenderHandler
{
public:
	explicit CAardvarkCefHandler( IApplication *application, const std::string & gadgetUri, const std::string & initialHook );
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
	virtual CefRefPtr<CefRequestHandler> GetRequestHandler() override { return this; }

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

	// CefRequestHandler methods:
	virtual ReturnValue OnBeforeResourceLoad(
		CefRefPtr<CefBrowser> browser,
		CefRefPtr<CefFrame> frame,
		CefRefPtr<CefRequest> request,
		CefRefPtr<CefRequestCallback> callback ) override;

	bool IsClosing() const { return m_isClosing; }

	void triggerClose( bool forceClose );

	// Called after creation to kick off the gadget
	void start();

	// Called when the manifest load is completed
	void onGadgetManifestReceived( bool success, const std::string & manifestData );
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

	CAardvarkGadgetManifest m_gadgetManifest;
	std::string m_gadgetManifestString;

	std::vector<uint32_t> m_gadgets;
	void *m_sharedTexture = nullptr;

	void updateSceneGraphTextures();

	std::unique_ptr< aardvark::CAardvarkClient > m_client;

	CefRefPtr<CStartGadgetRequestClient> m_manifestRequestClient;
	CefRefPtr<CefURLRequest> m_manifestRequest;
	std::string m_gadgetUri;
	std::string m_initialHook;
	bool m_wantsToQuit = false;

	CUriRequestHandler m_uriRequestHandler;

	// Include the default reference counting implementation.
	IMPLEMENT_REFCOUNTING(CAardvarkCefHandler);
};

#endif  // CEF_TESTS_CEFSIMPLE_SIMPLE_HANDLER_H_
