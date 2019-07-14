#include "javascript_object.h"

CJavascriptObjectWithFunctions::~CJavascriptObjectWithFunctions()
{
}

void CJavascriptObjectWithFunctions::RegisterFunction( CefRefPtr<CefV8Value> container, const std::string & sName, JavascriptFn fn )
{
	CefRefPtr< DynamicFunctionHandler > pFunction( new DynamicFunctionHandler( sName, fn ) );
	container->SetValue( sName, CefV8Value::CreateFunction( sName, pFunction ), V8_PROPERTY_ATTRIBUTE_READONLY );
}

