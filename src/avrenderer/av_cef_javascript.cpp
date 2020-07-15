#pragma once

#include "av_cef_javascript.h"

#include <aardvark/aardvark_scene_graph.h>
#include <glm/glm.hpp>
#include <glm/gtc/quaternion.hpp>
#include <set>
#include <unordered_map>
#include <include/base/cef_bind.h>
#include <include/wrapper/cef_closure_task.h>
#include <include/wrapper/cef_helpers.h>
#include "javascript_object.h"
#include "javascript_renderer.h"

using aardvark::EAvSceneGraphResult;
using aardvark::GadgetParams_t;



class CAardvarkObject : public CJavascriptObjectWithFunctions
{
public:
	CAardvarkObject( CAardvarkRenderProcessHandler *pRenderProcessHandler );
	virtual ~CAardvarkObject();

	virtual bool init( CefRefPtr<CefV8Value> container ) override;

	bool hasPermission( const std::string & permission );
	void runFrame();

	void msgUpdateTextureInfo( CefRefPtr< CefProcessMessage > msg );
	void msgWindowList( CefRefPtr< CefProcessMessage > msg );

private:
	CAardvarkRenderProcessHandler *m_handler = nullptr;
	JsObjectPtr< CJavascriptRenderer > m_renderer;
	CefRefPtr<CefV8Value> m_textureInfoCallback;
	CefRefPtr<CefV8Context> m_textureInfoContext;
	CefRefPtr<CefV8Value> m_windowListCallback;
	CefRefPtr<CefV8Context> m_windowListContext;

};

CAardvarkObject::CAardvarkObject( CAardvarkRenderProcessHandler *renderProcessHandler )
{
	m_handler = renderProcessHandler;
}

bool CAardvarkObject::hasPermission( const std::string & permission )
{
	return m_handler->hasPermission( permission );
}

void CAardvarkObject::runFrame()
{
	if ( m_renderer )
	{
		m_renderer->runFrame();
	}
}


extern bool endpointAddrFromJs( CefRefPtr< CefV8Value > obj, aardvark::EndpointAddr_t *addr );
extern bool gadgetParamsFromJs( CefRefPtr< CefV8Value > obj, aardvark::GadgetParams_t *params );

bool CAardvarkObject::init( CefRefPtr<CefV8Value> container )
{
	RegisterFunction( container, "hasPermission", [ this ]( const CefV8ValueList& arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 1 )
		{
			exception = "Invalid arguments";
			return;
		}
		if ( !arguments[ 0 ]->IsString() )
		{
			exception = "Invalid permission argument";
			return;
		}

		retval = CefV8Value::CreateBool( hasPermission( arguments[ 0 ]->GetStringValue() ) );
	} );

	if ( hasPermission( "scenegraph" ) )
	{
		RegisterFunction( container, "subscribeToBrowserTexture", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
		{
			if ( arguments.size() != 1 )
			{
				exception = "Invalid arguments";
				return;
			}
			if ( !arguments[0]->IsFunction() )
			{
				exception = "Invalid callback argument";
				return;
			}

			m_textureInfoCallback = arguments[0];
			m_textureInfoContext = CefV8Context::GetCurrentContext();

			m_handler->requestTextureInfo();
		} );

		RegisterFunction( container, "spoofMouseEvent", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
		{
			if ( arguments.size() != 3 )
			{
				exception = "argument count must be three";
				return;
			}
			if ( !arguments[0]->IsInt() )
			{
				exception = "first argument must be a message type";
				return;
			}
			if ( !arguments[1]->IsDouble() || !arguments[2]->IsDouble() )
			{
				exception = "second and third arguments must be a x, y coordinates as doubles";
				return;
			}

			CefRefPtr<CefProcessMessage> msg = CefProcessMessage::Create( "mouse_event" );
			msg->GetArgumentList()->SetInt( 0, (int)arguments[0]->GetIntValue() );
			msg->GetArgumentList()->SetDouble( 1, arguments[1]->GetDoubleValue() );
			msg->GetArgumentList()->SetDouble( 2, arguments[2]->GetDoubleValue() );

			m_handler->sendBrowserMessage( msg );
		} );
	}

	if ( hasPermission( "master" ) )
	{
		RegisterFunction( container, "startGadget", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
		{
			if ( arguments.size() != 1 )
			{
				exception = "Invalid arguments";
				return;
			}
			GadgetParams_t params;
			if ( !gadgetParamsFromJs( arguments[0], &params ) )
			{
				exception = "Invalid params";
				return;
			}

			m_handler->requestStartGadget( params );
		} );

	}

	if ( hasPermission( "screencapture" ) )
	{
		RegisterFunction( container, "subscribeWindowList", [ this ]( const CefV8ValueList& arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
		{
			if ( arguments.size() != 1 || !arguments[ 0 ]->IsFunction() )
			{
				exception = "Invalid arguments";
				return;
			}

			m_windowListCallback = arguments[ 0 ];
			m_windowListContext = CefV8Context::GetCurrentContext();

			CefRefPtr<CefProcessMessage> msg = CefProcessMessage::Create( "subscribe_window_list" );
			m_handler->sendBrowserMessage( msg );
		} );

		RegisterFunction( container, "unsubscribeWindowList", [ this ]( const CefV8ValueList& arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
		{
			m_windowListCallback = nullptr;
			m_windowListContext = nullptr;

			CefRefPtr<CefProcessMessage> msg = CefProcessMessage::Create( "unsubscribe_window_list" );
			m_handler->sendBrowserMessage( msg );
		} );

	}

	RegisterFunction( container, "closeBrowser", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		m_handler->requestClose();
	} );

	if ( hasPermission( "renderer" ) )
	{
		m_renderer = CJavascriptObjectWithFunctions::create<CJavascriptRenderer>( m_handler );
		container->SetValue( "renderer", m_renderer.object, V8_PROPERTY_ATTRIBUTE_READONLY );
	}

	return true;

}

void CAardvarkObject::msgUpdateTextureInfo( CefRefPtr< CefProcessMessage > msg )
{
	if ( !m_textureInfoContext || !m_textureInfoCallback )
	{
		return;
	}

	m_textureInfoContext->Enter();

	CefRefPtr<CefV8Value> textureInfo = CefV8Value::CreateObject( nullptr, nullptr );
	textureInfo->SetValue( "type", CefV8Value::CreateInt( (int)ETextureType::D3D11Texture2D ),
		V8_PROPERTY_ATTRIBUTE_NONE );
	textureInfo->SetValue( "format", CefV8Value::CreateInt( (int)ETextureFormat::B8G8R8A8 ),
		V8_PROPERTY_ATTRIBUTE_NONE );
	textureInfo->SetValue( "dxgiHandle", CefV8Value::CreateString( msg->GetArgumentList()->GetString( 0 ) ),
		V8_PROPERTY_ATTRIBUTE_NONE );
	textureInfo->SetValue( "width", CefV8Value::CreateInt( msg->GetArgumentList()->GetInt( 1 ) ),
		V8_PROPERTY_ATTRIBUTE_NONE );
	textureInfo->SetValue( "height", CefV8Value::CreateInt( msg->GetArgumentList()->GetInt( 2 ) ),
		V8_PROPERTY_ATTRIBUTE_NONE );
	textureInfo->SetValue( "invertY", CefV8Value::CreateBool( msg->GetArgumentList()->GetBool( 3 ) ),
		V8_PROPERTY_ATTRIBUTE_NONE );

	m_textureInfoCallback->ExecuteFunction( nullptr, { textureInfo } );
	m_textureInfoContext->Exit();
}

void CAardvarkObject::msgWindowList( CefRefPtr< CefProcessMessage > msg )
{
	if ( !m_windowListContext || !m_windowListCallback )
	{
		return;
	}

	m_windowListContext->Enter();

	CefRefPtr<CefListValue> pWindows = msg->GetArgumentList()->GetSize() > 0 ? msg->GetArgumentList()->GetList( 0 ) : CefListValue::Create();

	int windowCount = (int)pWindows->GetSize();
	CefRefPtr<CefV8Value> windows = CefV8Value::CreateArray( windowCount );
	for ( int i = 0; i < windowCount; i++ )
	{
		CefRefPtr<CefListValue> windowInfo = pWindows->GetList( i );

		CefRefPtr< CefV8Value > windowObj = CefV8Value::CreateObject( nullptr, nullptr );
		windowObj->SetValue( "name", CefV8Value::CreateString( windowInfo->GetString( 0 ) ),
			V8_PROPERTY_ATTRIBUTE_READONLY );
		windowObj->SetValue( "handle", CefV8Value::CreateString( windowInfo->GetString( 1 ) ),
			V8_PROPERTY_ATTRIBUTE_READONLY );

		CefRefPtr<CefV8Value> textureInfo = CefV8Value::CreateObject( nullptr, nullptr );
		textureInfo->SetValue( "type", CefV8Value::CreateInt( (int)ETextureType::D3D11Texture2D ),
			V8_PROPERTY_ATTRIBUTE_NONE );
		textureInfo->SetValue( "format", CefV8Value::CreateInt( (int)ETextureFormat::B8G8R8A8 ),
			V8_PROPERTY_ATTRIBUTE_NONE );
		textureInfo->SetValue( "dxgiHandle", CefV8Value::CreateString( windowInfo->GetString( 2 ) ),
			V8_PROPERTY_ATTRIBUTE_NONE );
		textureInfo->SetValue( "width", CefV8Value::CreateInt( windowInfo->GetInt( 3 ) ),
			V8_PROPERTY_ATTRIBUTE_NONE );
		textureInfo->SetValue( "height", CefV8Value::CreateInt( windowInfo->GetInt( 4 ) ),
			V8_PROPERTY_ATTRIBUTE_NONE );
		textureInfo->SetValue( "invertY", CefV8Value::CreateBool( windowInfo->GetBool( 5 ) ),
			V8_PROPERTY_ATTRIBUTE_NONE );

		windowObj->SetValue( "texture", textureInfo, V8_PROPERTY_ATTRIBUTE_NONE );

		windows->SetValue( i, windowObj );
	}

	m_windowListCallback->ExecuteFunction( nullptr, { windows } );
	m_windowListContext->Exit();
}


CAardvarkObject::~CAardvarkObject()
{
	m_renderer = nullptr;
}


CAardvarkRenderProcessHandler::CAardvarkRenderProcessHandler()
{
}


void CAardvarkRenderProcessHandler::OnContextCreated(
	CefRefPtr<CefBrowser> browser,
	CefRefPtr<CefFrame> frame,
	CefRefPtr<CefV8Context> context )
{
	if ( m_needRunFrame )
	{
		// first time setup tasks
		CefPostDelayedTask( TID_RENDERER, base::Bind( &CAardvarkRenderProcessHandler::runFrame, this ), 0 );
		m_needRunFrame = false;
	}


	PerContextInfo_t info;
	info.browser = browser;
	info.frame = frame;
	info.context = context;
	
	if ( m_gadgetManifest )
	{
		InitAardvarkForContext( info );
	}

	m_contexts.push_back( std::move( info ) );
}

void CAardvarkRenderProcessHandler::OnContextReleased( CefRefPtr<CefBrowser> browser,
	CefRefPtr<CefFrame> frame,
	CefRefPtr<CefV8Context> context )
{
	for ( auto iInfo = m_contexts.begin(); iInfo != m_contexts.end(); iInfo++ )
	{
		if ( iInfo->context->IsSame( context ) )
		{
			m_contexts.erase( iInfo );
			break;
		}
	}
}

void CAardvarkRenderProcessHandler::OnBrowserDestroyed( CefRefPtr<CefBrowser> browser )
{
}


bool CAardvarkRenderProcessHandler::OnProcessMessageReceived( CefRefPtr<CefBrowser> browser,
	CefRefPtr<CefFrame> frame,
	CefProcessId source_process,
	CefRefPtr<CefProcessMessage> message )
{
	std::string messageName = message->GetName();

	if ( messageName == "gadget_info" )
	{
		try
		{
			std::string paramData = message->GetArgumentList()->GetString( 0 );
			nlohmann::json j = nlohmann::json::parse( paramData.begin(), paramData.end() );
			m_params = j.get<aardvark::GadgetParams_t>();

			std::string manifestData = message->GetArgumentList()->GetString( 1 );
			j = nlohmann::json::parse( manifestData.begin(), manifestData.end() );
			m_gadgetManifest = std::make_unique<CWebAppManifest>( j.get<CWebAppManifest>() );
			
			for ( auto & contextInfo : m_contexts )
			{
				InitAardvarkForContext( contextInfo );
			}
		}
		catch ( nlohmann::json::exception & )
		{
			// manifest parse failed
			assert( false );
			return false;
		}
	}
	else if ( messageName == "update_shared_texture" )
	{
		for ( auto context : m_contexts )
		{
			context.aardvarkObject->msgUpdateTextureInfo( message );
		}
	}
	else if ( messageName == "window_list" )
	{
		for ( auto context : m_contexts )
		{
			context.aardvarkObject->msgWindowList( message );
		}
	}
	return false;
}


void CAardvarkRenderProcessHandler::InitAardvarkForContext( PerContextInfo_t &contextInfo )
{
	contextInfo.context->Enter();
	CefRefPtr<CefV8Value> windowObj = contextInfo.context->GetGlobal();

	// Create an object to store our functions in
	contextInfo.aardvarkObject = CJavascriptObjectWithFunctions::create< CAardvarkObject>( this );
	windowObj->SetValue( "aardvark", contextInfo.aardvarkObject.object, V8_PROPERTY_ATTRIBUTE_READONLY );

	contextInfo.context->Exit();
}


bool CAardvarkRenderProcessHandler::hasPermission( const std::string & permission )
{
	if ( m_gadgetManifest )
	{
		return m_gadgetManifest->m_aardvark.m_permissions.find( permission ) != m_gadgetManifest->m_aardvark.m_permissions.end();
	}
	else
	{
		return false;
	}
}

void CAardvarkRenderProcessHandler::runFrame()
{
	for ( auto & info : m_contexts )
	{
		if ( info.aardvarkObject )
		{
			info.context->Enter();
			info.aardvarkObject->runFrame();
			info.context->Exit();
		}
	}

	m_uriRequestHandler.doCefRequestWork();

	// requests from javascript come in on the renderer thread, so process those too
	m_uriRequestHandler.processResults();

	int64_t frameDelay = 10;
	if ( hasPermission( "renderer" ) )
	{
		frameDelay = 0;
	}

	CefPostDelayedTask( TID_RENDERER, base::Bind( &CAardvarkRenderProcessHandler::runFrame, this ), frameDelay );
}

void CAardvarkRenderProcessHandler::sendBrowserMessage( CefRefPtr< CefProcessMessage > msg )
{
	CefV8Context::GetCurrentContext()->GetBrowser()->GetFocusedFrame()->SendProcessMessage( PID_BROWSER, msg );
}


void CAardvarkRenderProcessHandler::requestStartGadget( const aardvark::GadgetParams_t& params )
{
	CefRefPtr<CefProcessMessage> msg = CefProcessMessage::Create( "start_gadget" );
	nlohmann::json j = params;

	msg->GetArgumentList()->SetString( 0, j.dump() );
	sendBrowserMessage( msg );
}


void CAardvarkRenderProcessHandler::requestUri( const std::string & uri, 
	std::function<void( CUriRequestHandler::Result_t & result ) > callback )
{
	m_uriRequestHandler.requestUri( uri, callback );
}


void CAardvarkRenderProcessHandler::requestTextureInfo()
{
	CefRefPtr<CefProcessMessage> msg = CefProcessMessage::Create( "request_texture_info" );
	sendBrowserMessage( msg );
}


void CAardvarkRenderProcessHandler::requestClose()
{
	CefRefPtr<CefProcessMessage> msg = CefProcessMessage::Create( "request_close" );
	sendBrowserMessage( msg );
}
