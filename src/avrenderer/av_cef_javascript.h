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
		CefProcessId source_process,
		CefRefPtr<CefProcessMessage> message ) override;
	virtual void OnBrowserDestroyed( CefRefPtr<CefBrowser> browser ) override;


	void sendBrowserMessage( CefRefPtr< CefProcessMessage > msg );

	bool hasPermission( const std::string & permission );
	const std::string getInitialHook() const { return m_initialHook; }
	void requestStartGadget( const CefString & uri, const CefString & initialHook, const CefString & persistenceUuid, 
		const aardvark::EndpointAddr_t & epToNotify );
	void requestUri( const std::string & uri, std::function<void( CUriRequestHandler::Result_t & result ) > callback );
	void requestTextureInfo();

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

	std::string m_gadgetUri;
	std::string m_initialHook;
	CAardvarkGadgetManifest m_gadgetManifest;
	CUriRequestHandler m_uriRequestHandler;
	bool m_needRunFrame = true;

	// Include the default reference counting implementation.
	IMPLEMENT_REFCOUNTING( CAardvarkRenderProcessHandler );
};
