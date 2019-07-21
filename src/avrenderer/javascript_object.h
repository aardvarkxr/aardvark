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

template< typename T >
struct JsObjectPtr
{
	T *impl = nullptr;
	CefRefPtr<CefV8Value> object;

	T *operator->() { return impl; }
	JsObjectPtr & operator=(void*) 
	{
		impl = nullptr;
		object = nullptr;
		return *this;
	}
	operator bool() const { return object != nullptr;  }
};


class CJavascriptObjectWithFunctions : public CefBaseRefCounted
{
public:
	virtual ~CJavascriptObjectWithFunctions();

	template< typename T, class ...Ts >
	static JsObjectPtr<T> create( Ts&& ... args )
	{
		JsObjectPtr<T> res;
		res.object = CefV8Value::CreateObject( nullptr, nullptr );

		CefRefPtr<T> impl = new T( std::forward<Ts>( args )... );
		impl->init( res.object );
		res.object->SetUserData( impl );
		res.impl = impl.get();
		return res;
	}

	virtual bool init( CefRefPtr< CefV8Value > container ) = 0;

protected:
	void RegisterFunction( CefRefPtr<CefV8Value> container, const std::string & sName, JavascriptFn fn );

	IMPLEMENT_REFCOUNTING( CJavascriptObjectWithFunctions );
};

