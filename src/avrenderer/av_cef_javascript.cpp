#pragma once

#include "av_cef_javascript.h"

#include <aardvark/aardvark_client.h>

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
	virtual bool init() = 0;

	CefRefPtr<CefV8Value> getContainer() { return m_container; }

protected:
	void RegisterFunction( const std::string & sName, JavascriptFn fn );

private:
	CefRefPtr<CefV8Value> m_container;

};

CJavascriptObjectWithFunctions::CJavascriptObjectWithFunctions()
{
	m_container = CefV8Value::CreateObject( nullptr, nullptr );
}


void CJavascriptObjectWithFunctions::RegisterFunction( const std::string & sName, JavascriptFn fn )
{
	CefRefPtr< DynamicFunctionHandler > pFunction( new DynamicFunctionHandler( sName, fn ) );
	m_container->SetValue( sName, CefV8Value::CreateFunction( sName, pFunction ), V8_PROPERTY_ATTRIBUTE_READONLY );
}

class CAardvarkAppObject : public CJavascriptObjectWithFunctions
{
public:
	CAardvarkAppObject( CAardvarkRenderProcessHandler *pRenderProcessHandler, AvApp::Client client );

	virtual bool init() override;

private:
	AvApp::Client m_appClient;
	CAardvarkRenderProcessHandler *m_handler = nullptr;
};

CAardvarkAppObject::CAardvarkAppObject( CAardvarkRenderProcessHandler *renderProcessHandler, AvApp::Client client )
	: m_appClient( client )
{
	m_handler = renderProcessHandler;
}


bool CAardvarkAppObject::init()
{
	RegisterFunction( "getName", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 0 )
		{
			exception = "Invalid arguments";
			return;
		}

		auto resName= m_appClient.nameRequest().send().wait( m_handler->getClient()->WaitScope() );
		if( resName.hasName() )
		{
			retval = CefV8Value::CreateString( resName.getName().cStr() );
		}
		else
		{
			retval = CefV8Value::CreateNull();
		}
	} );

	return true;
}




class CAardvarkObject : public CJavascriptObjectWithFunctions
{
public:
	CAardvarkObject( CAardvarkRenderProcessHandler *pRenderProcessHandler );

	virtual bool init() override;

private:
	CAardvarkRenderProcessHandler *m_handler = nullptr;
	std::list<std::unique_ptr<CAardvarkAppObject>> m_apps;
};

CAardvarkObject::CAardvarkObject( CAardvarkRenderProcessHandler *renderProcessHandler )
{
	m_handler = renderProcessHandler;
}


bool CAardvarkObject::init()
{
	RegisterFunction( "createApp", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 1 )
		{
			exception = "Invalid arguments";
			return;
		}
		if ( !arguments[0]->IsString() )
		{
			exception = "Invalid name argument";
			return;
		}

		auto reqCreateExampleApp = m_handler->getClient()->Server().createAppRequest();
		reqCreateExampleApp.setName( std::string( arguments[0]->GetStringValue()).c_str() );
		auto resCreateApp = reqCreateExampleApp.send().wait( m_handler->getClient()->WaitScope() );
		if ( !resCreateApp.hasApp() )
		{
			retval = CefV8Value::CreateNull();
		}
		else
		{
			auto app = std::make_unique<CAardvarkAppObject>( m_handler, resCreateApp.getApp() );
			if ( !app->init() )
			{
				retval = CefV8Value::CreateNull();
			}
			else
			{
				retval = app->getContainer();
				m_apps.push_back( std::move( app ) );
			}
		}
	} );
	return true;

}


CAardvarkRenderProcessHandler::CAardvarkRenderProcessHandler()
{
	m_client = std::make_unique< aardvark::CAardvarkClient >();
}


void CAardvarkRenderProcessHandler::OnContextCreated(
	CefRefPtr<CefBrowser> browser,
	CefRefPtr<CefFrame> frame,
	CefRefPtr<CefV8Context> context )
{
	m_client->Start();

	// Retrieve the context's window object.
	CefRefPtr<CefV8Value> windowObj = context->GetGlobal();

	// Create an object to store our functions in
	m_aardvarkObject = std::make_unique<CAardvarkObject>( this );
	assert( m_aardvarkObject->init() );
	windowObj->SetValue( "aardvark", m_aardvarkObject->getContainer(), V8_PROPERTY_ATTRIBUTE_READONLY );

}

void CAardvarkRenderProcessHandler::OnContextReleased( CefRefPtr<CefBrowser> browser,
	CefRefPtr<CefFrame> frame,
	CefRefPtr<CefV8Context> context )
{
	m_client->Stop();
}



