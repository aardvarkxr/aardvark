#pragma once

#include "av_cef_javascript.h"

CAardvarkRenderProcessHandler::CAardvarkRenderProcessHandler() 
{
}


class DynamicFunctionHandler : public CefV8Handler 
{
public:
	DynamicFunctionHandler( CAardvarkRenderProcessHandler *handler, const std::string & sFunctionName, JavascriptFn fn )
	{
		m_handler = handler;
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
	CAardvarkRenderProcessHandler *m_handler = nullptr;
	std::string m_functionName;
	JavascriptFn m_fn = nullptr;

	// Provide the reference counting implementation for this class.
	IMPLEMENT_REFCOUNTING( DynamicFunctionHandler );
};


void CAardvarkRenderProcessHandler::OnContextCreated(
	CefRefPtr<CefBrowser> browser,
	CefRefPtr<CefFrame> frame,
	CefRefPtr<CefV8Context> context )
{
	// Retrieve the context's window object.
	CefRefPtr<CefV8Value> windowObj = context->GetGlobal();

	// Create an object to store our functions in
	m_aardvarkContainerObj = CefV8Value::CreateObject( nullptr, nullptr );
	windowObj->SetValue( "aardvark", m_aardvarkContainerObj, V8_PROPERTY_ATTRIBUTE_READONLY );

	RegisterFunction( "fnord", []( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		retval = CefV8Value::CreateInt( 5 );
	} );
}

void CAardvarkRenderProcessHandler::RegisterFunction( const std::string & sName, JavascriptFn fn )
{
	CefRefPtr< DynamicFunctionHandler > pFunction( new DynamicFunctionHandler( this, sName, fn ) );
	m_aardvarkContainerObj->SetValue( sName, CefV8Value::CreateFunction( sName, pFunction ), V8_PROPERTY_ATTRIBUTE_READONLY );
}

