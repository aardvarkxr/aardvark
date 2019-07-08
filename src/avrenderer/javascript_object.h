#pragma once

#include <include/cef_render_process_handler.h>

#include <functional>

typedef std::function<void( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )> JavascriptFn;

class DynamicFunctionHandler : public CefV8Handler
{
public:
	DynamicFunctionHandler( const std::string & sFunctionName, JavascriptFn fn )
	{
		m_functionName = sFunctionName;
		m_fn = fn;
	}

	virtual bool Execute( const CefString& name,
		CefRefPtr<CefV8Value> object,
		const CefV8ValueList& arguments,
		CefRefPtr<CefV8Value>& retval,
		CefString& exception ) override
	{
		if ( name == m_functionName && m_fn )
		{
			m_fn( arguments, retval, exception );
			return true;
		}

		// Function does not exist.
		return false;
	}

private:
	std::string m_functionName;
	JavascriptFn m_fn = nullptr;

	// Provide the reference counting implementation for this class.
	IMPLEMENT_REFCOUNTING( DynamicFunctionHandler );
};

class CJavascriptObjectWithFunctions
{
public:
	CJavascriptObjectWithFunctions();
	~CJavascriptObjectWithFunctions();

	virtual bool init() = 0;
	virtual void cleanup() = 0;

	CefRefPtr<CefV8Value> getContainer() { return m_container; }

protected:
	void RegisterFunction( const std::string & sName, JavascriptFn fn );

	CefRefPtr<CefV8Value> m_container;

};

