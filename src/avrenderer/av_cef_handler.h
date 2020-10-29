// Copyright (c) 2013 The Chromium Embedded Framework Authors. All rights
// reserved. Use of this source code is governed by a BSD-style license that
// can be found in the LICENSE file.

#ifndef CEF_TESTS_CEFSIMPLE_SIMPLE_HANDLER_H_
#define CEF_TESTS_CEFSIMPLE_SIMPLE_HANDLER_H_

#include "include/cef_client.h"
#include <include/cef_urlrequest.h>

#include <aardvark/aardvark_gadget_manifest.h>
#include <aardvark/aardvark_scene_graph.h>

#include "uri_request_handler.h"

#include <list>
#include <set>
#include <map>
#include <memory>

class CAardvarkCefHandler;

class IApplication;

class CAardvarkResourceRequestHandler : public CefResourceRequestHandler
{
public:

	// CefResourceRequestHandler methods:
	virtual void OnProtocolExecution( CefRefPtr<CefBrowser> browser,
		CefRefPtr<CefFrame> frame,
		CefRefPtr<CefRequest> request,
		bool& allow_os_execution ) override;

private:
	// Include the default reference counting implementation.
	IMPLEMENT_REFCOUNTING( CAardvarkResourceRequestHandler );

};

class CAardvarkCefHandler : public CefClient,
                      public CefDisplayHandler,
                      public CefLifeSpanHandler,
                      public CefLoadHandler,
					  public CefRequestHandler,
					  public CefRenderHandler
{
public:
	explicit CAardvarkCefHandler( IApplication *application, const aardvark::GadgetParams_t& params );
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
		CefRefPtr<CefFrame> frame,
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
	virtual CefRefPtr<CefResourceRequestHandler> GetResourceRequestHandler(
		CefRefPtr<CefBrowser> browser,
		CefRefPtr<CefFrame> frame,
		CefRefPtr<CefRequest> request,
		bool is_navigation,
		bool is_download,
		const CefString& request_initiator,
		bool& disable_default_handling ) override 
	{
		return m_resourceRequestHandler;
	}
	virtual void OnRenderProcessTerminated( CefRefPtr<CefBrowser> browser,
		TerminationStatus status ) override;

	bool IsClosing() const { return m_isClosing; }
	bool IsInstanceOfGadget( const aardvark::GadgetParams_t& params ) const { return m_params.uri == params.uri; };
	void triggerClose( bool forceClose );

	// Called after creation to kick off the gadget
	void start();

	// Called when the manifest load is completed
	void onGadgetManifestReceived( bool success, const std::vector< uint8_t > & manifestData );

	// Called when a window info changes for a subscribed window
	void windowUpdate( CefRefPtr<CefListValue> windowInfo );

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

	CWebAppManifest m_gadgetManifest;
	std::string m_gadgetManifestString;

	std::vector<uint32_t> m_gadgets;
	void *m_sharedTexture = nullptr;

	void updateSceneGraphTextures();

	aardvark::GadgetParams_t m_params;

	bool m_wantsToQuit = false;
	bool m_wantsTexture = false;
	bool m_firstPaint = true;

	CUriRequestHandler m_uriRequestHandler;
	CefRefPtr< CAardvarkResourceRequestHandler > m_resourceRequestHandler;

	// Include the default reference counting implementation.
	IMPLEMENT_REFCOUNTING(CAardvarkCefHandler);
};

#endif  // CEF_TESTS_CEFSIMPLE_SIMPLE_HANDLER_H_
