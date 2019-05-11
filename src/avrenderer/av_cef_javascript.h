#pragma once

#include <include/cef_render_process_handler.h>

#include <functional>
#include <memory>

namespace aardvark
{
	class CAardvarkClient;
};


typedef std::function<void( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )> JavascriptFn;

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

	aardvark::CAardvarkClient *getClient() { return &*m_client; }
private:

	std::unique_ptr<aardvark::CAardvarkClient> m_client;
	std::unique_ptr<CAardvarkObject> m_aardvarkObject;

	// Include the default reference counting implementation.
	IMPLEMENT_REFCOUNTING( CAardvarkRenderProcessHandler );
};
