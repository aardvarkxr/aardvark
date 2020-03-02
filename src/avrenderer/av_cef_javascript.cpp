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




class CAardvarkObject : public CJavascriptObjectWithFunctions
{
public:
	CAardvarkObject( CAardvarkRenderProcessHandler *pRenderProcessHandler );
	virtual ~CAardvarkObject();

	virtual bool init( CefRefPtr<CefV8Value> container ) override;

	bool hasPermission( const std::string & permission );
	void runFrame();

	void msgUpdateTextureInfo( CefRefPtr< CefProcessMessage > msg );

private:
	CAardvarkRenderProcessHandler *m_handler = nullptr;
	JsObjectPtr< CJavascriptRenderer > m_renderer;
	CefRefPtr<CefV8Value> m_textureInfoCallback;
	CefRefPtr<CefV8Context> m_textureInfoContext;
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
			if ( arguments.size() != 4 && arguments.size() != 5 )
			{
				exception = "Invalid arguments";
				return;
			}
			if ( !arguments[0]->IsString() )
			{
				exception = "Invalid url argument";
				return;
			}
			if ( !arguments[1]->IsString() && !arguments[1]->IsBool()
				&& !arguments[1]->IsUndefined() )
			{
				exception = "Invalid hook argument";
				return;
			}
			if ( !arguments[2]->IsString() )
			{
				exception = "Invalid persistence UUID argument";
				return;
			}
			aardvark::EndpointAddr_t epToNotify;
			if ( !endpointAddrFromJs( arguments[3], &epToNotify ) )
			{
				epToNotify.type = aardvark::EEndpointType::Unknown;
			}

			std::string sHook = arguments[1]->IsString() ? arguments[1]->GetStringValue() : "";

			CefString remoteUniversePath;
			if ( arguments.size() >= 5 && !arguments[ 4 ]->IsNull() && !arguments[4]->IsUndefined() )
			{
				if ( !arguments[ 4 ]->IsString() )
				{
					exception = "Invalid remote universe path";
					return;
				}
				remoteUniversePath = arguments[ 4 ]->GetStringValue();
			}

			m_handler->requestStartGadget( arguments[0]->GetStringValue(), sHook, 
				arguments[2]->GetStringValue(), epToNotify, remoteUniversePath );
		} );

		RegisterFunction( container, "getGadgetManifest", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
		{
			if ( arguments.size() != 2 )
			{
				exception = "Invalid arguments";
				return;
			}
			if ( !arguments[0]->IsString() )
			{
				exception = "Invalid url argument";
				return;
			}
			if ( !arguments[1]->IsFunction() )
			{
				exception = "Invalid callback argument";
				return;
			}

			CefRefPtr<CefV8Value> callback = arguments[1];
			CefRefPtr<CefV8Context> context = CefV8Context::GetCurrentContext();
			m_handler->requestUri( std::string( arguments[0]->GetStringValue() ) + "/gadget_manifest.json",
				[ callback, context ]( CUriRequestHandler::Result_t & result )
			{
				context->Enter();

				CefRefPtr<CefV8Value> manifest;

				bool success = false;
				if ( result.success )
				{
					try
					{
						nlohmann::json j = nlohmann::json::parse( result.data.begin(), result.data.end() );
						CAardvarkGadgetManifest gadgetManifest = j.get<CAardvarkGadgetManifest>();

						manifest = CefV8Value::CreateObject( nullptr, nullptr );
						manifest->SetValue( "name", CefV8Value::CreateString( gadgetManifest.m_name ),
							V8_PROPERTY_ATTRIBUTE_NONE );
						manifest->SetValue( "width", CefV8Value::CreateUInt( gadgetManifest.m_width ),
							V8_PROPERTY_ATTRIBUTE_NONE );
						manifest->SetValue( "height", CefV8Value::CreateUInt( gadgetManifest.m_height ),
							V8_PROPERTY_ATTRIBUTE_NONE );
						manifest->SetValue( "modelUri", CefV8Value::CreateString( gadgetManifest.m_modelUri ),
							V8_PROPERTY_ATTRIBUTE_NONE );

						CefRefPtr<CefV8Value> permissions = CefV8Value::CreateArray( (int)gadgetManifest.m_permissions.size() );
						int index = 0;
						for ( auto perm : gadgetManifest.m_permissions )
						{
							permissions->SetValue( index++, CefV8Value::CreateString( perm ) );
						}
						manifest->SetValue( "permissions", permissions, V8_PROPERTY_ATTRIBUTE_NONE );

						success = true;
					}
					catch ( nlohmann::json::exception & )
					{
						// manifest parse failed. Return failure below
						assert( false );
					}
				}

				if ( !success )
				{
					manifest = CefV8Value::CreateNull();
				}

				callback->ExecuteFunction( nullptr, { manifest } );

				context->Exit();
			} );
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
		m_gadgetUri = message->GetArgumentList()->GetString( 0 );
		m_initialHook = message->GetArgumentList()->GetString( 1 );
		m_remoteUniversePath = message->GetArgumentList()->GetString( 2 );

		try
		{
			std::string manifestData = message->GetArgumentList()->GetString( 3 );
			nlohmann::json j = nlohmann::json::parse( manifestData.begin(), manifestData.end() );
			m_gadgetManifest = std::make_unique<CAardvarkGadgetManifest>( j.get<CAardvarkGadgetManifest>() );
			
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
	if ( !this->m_remoteUniversePath.empty() && permission != "scenegraph" )
	{
		// remote apps can only scenegraph
		return false;
	}

	if ( m_gadgetManifest )
	{
		return m_gadgetManifest->m_permissions.find( permission ) != m_gadgetManifest->m_permissions.end();
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


void CAardvarkRenderProcessHandler::requestStartGadget( const CefString & uri, const CefString & initialHook, 
	const CefString & persistenceUuid, const aardvark::EndpointAddr_t & epToNotify, const CefString & remoteUniversePath )
{
	CefRefPtr<CefProcessMessage> msg = CefProcessMessage::Create( "start_gadget" );

	msg->GetArgumentList()->SetString( 0, uri );
	msg->GetArgumentList()->SetString( 1, initialHook );
	msg->GetArgumentList()->SetString( 2, persistenceUuid );
	msg->GetArgumentList()->SetInt( 3, (int)epToNotify.type );
	msg->GetArgumentList()->SetInt( 4, (int)epToNotify.endpointId);
	msg->GetArgumentList()->SetInt( 5, (int)epToNotify.nodeId );
	msg->GetArgumentList()->SetString( 6, remoteUniversePath );

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
