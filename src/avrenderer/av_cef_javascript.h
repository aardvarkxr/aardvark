#pragma once

#include <include/cef_render_process_handler.h>

#include <functional>
#include <memory>
#include <set>

#include <aardvark/aardvark_gadget_manifest.h>
#include <aardvark/aardvark_scene_graph.h>

#include "uri_request_handler.h"
#include "javascript_object.h"


class CAardvarkObject;

class CAardvarkRenderProcessHandler : public CefRenderProcessHandler
{
public:
	CAardvarkRenderProcessHandler();

	virtual void OnContextCreated(
		CefRefPtr<CefBrowser> browser,
		CefRefPtr<CefFrame> frame,
		CefRefPtr<CefV8Context> context ) override;
	virtual void OnContextReleased( CefRefPtr<CefBrowser> browser,
		CefRefPtr<CefFrame> frame,
		CefRefPtr<CefV8Context> context ) override;
	virtual bool OnProcessMessageReceived( CefRefPtr<CefBrowser> browser,
		CefRefPtr<CefFrame> frame,
		CefProcessId source_process,
		CefRefPtr<CefProcessMessage> message ) override;

	virtual void OnBrowserDestroyed( CefRefPtr<CefBrowser> browser ) override;


	void sendBrowserMessage( CefRefPtr< CefProcessMessage > msg );

	bool hasPermission( const std::string & permission );
	const std::string getInitialHook() const { return m_params.initialHook; }
	void requestStartGadget( const aardvark::GadgetParams_t & params );
	void requestUri( const std::string & uri, std::function<void( CUriRequestHandler::Result_t & result ) > callback );
	void requestTextureInfo();
	void requestClose();

	void runFrame();
private:
	struct PerContextInfo_t
	{
		CefRefPtr<CefBrowser> browser;
		CefRefPtr<CefFrame> frame;
		CefRefPtr<CefV8Context> context;
		JsObjectPtr< CAardvarkObject > aardvarkObject;
	};
	std::vector< PerContextInfo_t > m_contexts;
	void InitAardvarkForContext( PerContextInfo_t &contextInfo );

	aardvark::GadgetParams_t m_params;
	std::unique_ptr<CWebAppManifest> m_gadgetManifest;
	CUriRequestHandler m_uriRequestHandler;
	bool m_needRunFrame = true;

	// Include the default reference counting implementation.
	IMPLEMENT_REFCOUNTING( CAardvarkRenderProcessHandler );
};
