#include "javascript_object.h"

CJavascriptObjectWithFunctions::CJavascriptObjectWithFunctions()
{
	m_container = CefV8Value::CreateObject( nullptr, nullptr );
}

CJavascriptObjectWithFunctions::~CJavascriptObjectWithFunctions()
{
	m_container = nullptr;
}

void CJavascriptObjectWithFunctions::RegisterFunction( const std::string & sName, JavascriptFn fn )
{
	CefRefPtr< DynamicFunctionHandler > pFunction( new DynamicFunctionHandler( sName, fn ) );
	m_container->SetValue( sName, CefV8Value::CreateFunction( sName, pFunction ), V8_PROPERTY_ATTRIBUTE_READONLY );
}

