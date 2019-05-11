#pragma once

#include <include/cef_render_process_handler.h>

#include <functional>

typedef std::function<void( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )> JavascriptFn;

class CAardvarkRenderProcessHandler : public CefRenderProcessHandler
{
public:
	CAardvarkRenderProcessHandler();

	void OnContextCreated(
		CefRefPtr<CefBrowser> browser,
		CefRefPtr<CefFrame> frame,
		CefRefPtr<CefV8Context> context );

private:

	void RegisterFunction( const std::string & sName, JavascriptFn fn );

	CefRefPtr<CefV8Value> m_aardvarkContainerObj;

	// Include the default reference counting implementation.
	IMPLEMENT_REFCOUNTING( CAardvarkRenderProcessHandler );

};
