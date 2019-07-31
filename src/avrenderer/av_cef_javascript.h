#pragma once

#include <include/cef_render_process_handler.h>

#include <functional>
#include <memory>
#include <set>

#include <aardvark/aardvark_gadget_manifest.h>

#include "uri_request_handler.h"
#include "javascript_object.h"

namespace aardvark
{
	class CAardvarkClient;
};


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


	aardvark::CAardvarkClient *getClient() { return &*m_client; }
	CefRefPtr<CefBrowser> getBrowser() { return m_browser;  }
	CefRefPtr<CefV8Context> getContext() { return m_context; }

	void updateGadgetNamesForBrowser();
	bool hasPermission( const std::string & permission );
	const std::string getInitialHook() const { return m_initialHook; }
	void requestStartGadget( const CefString & uri, const CefString & initialHook, CefRefPtr<CefV8Value> callback );
	void sceneFinished( uint64_t mainGrabbableId );

	void runFrame();
private:

	std::unique_ptr<aardvark::CAardvarkClient> m_client;
	JsObjectPtr< CAardvarkObject > m_aardvarkObject;
	CefRefPtr<CefBrowser> m_browser;
	CefRefPtr<CefV8Context> m_context;
	std::string m_gadgetUri;
	std::string m_initialHook;
	CAardvarkGadgetManifest m_gadgetManifest;
	CUriRequestHandler m_uriRequestHandler;
	int m_nextGadgetRequestId = 1;
	std::map< int, CefRefPtr< CefV8Value> > m_startGadgetCallbacks;

	// Include the default reference counting implementation.
	IMPLEMENT_REFCOUNTING( CAardvarkRenderProcessHandler );
};
