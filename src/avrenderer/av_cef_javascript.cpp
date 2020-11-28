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
#include <tools/systools.h>
#include <tools/pathtools.h>
#include <openvr.h>

#include <fstream>

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
	void msgWindowUpdate( CefRefPtr< CefProcessMessage > msg );

private:
	CAardvarkRenderProcessHandler *m_handler = nullptr;
	JsObjectPtr< CJavascriptRenderer > m_renderer;
	CefRefPtr<CefV8Value> m_textureInfoCallback;
	CefRefPtr<CefV8Context> m_textureInfoContext;
	CefRefPtr<CefV8Value> m_windowListCallback;
	CefRefPtr<CefV8Context> m_windowListContext;

	struct WindowSubscription_t
	{
		CefRefPtr<CefV8Value> callback;
		CefRefPtr<CefV8Context> context;
	};
	std::map<std::string, WindowSubscription_t> m_mapWindowSubscriptions;
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

	if ( hasPermission( "starturl" ) )
	{
		RegisterFunction( container, "startUrl", [ this ]( const CefV8ValueList& arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
		{
			if ( arguments.size() != 1 || !arguments[ 0 ]->IsString() )
			{
				exception = "Invalid arguments";
				return;
			}

			tools::invokeURL( arguments[ 0 ]->GetStringValue() );
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

		RegisterFunction( container, "subscribeWindow", [ this ]( const CefV8ValueList& arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
		{
			if ( arguments.size() != 2 
				|| !arguments[ 1 ]->IsFunction() 
				|| !arguments[0]->IsString() )
			{
				exception = "Invalid arguments";
				return;
			}

			std::string windowHandle = arguments[ 0 ]->GetStringValue();
			m_mapWindowSubscriptions[ windowHandle ] =
			{
				arguments[ 1 ],
				CefV8Context::GetCurrentContext(),
			};

			CefRefPtr<CefProcessMessage> msg = CefProcessMessage::Create( "subscribe_window" );
			msg->GetArgumentList()->SetString( 0, arguments[ 0 ]->GetStringValue() );
			m_handler->sendBrowserMessage( msg );
		} );

		RegisterFunction( container, "unsubscribeWindow", [ this ]( const CefV8ValueList& arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
		{
			if ( arguments.size() != 1
				|| !arguments[ 0 ]->IsString() )
			{
				exception = "Invalid arguments";
				return;
			}

			m_mapWindowSubscriptions.erase( arguments[ 0 ]->GetStringValue() );

			CefRefPtr<CefProcessMessage> msg = CefProcessMessage::Create( "unsubscribe_window" );
			msg->GetArgumentList()->SetString( 0, arguments[ 0 ]->GetStringValue() );
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

	if ( hasPermission( "input" ) )
	{
		RegisterFunction( container, "registerInput", [this]( const CefV8ValueList& arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
		{
			if ( arguments.size() != 1
				|| !arguments[ 0 ]->IsArray() )
			{
				exception = "Invalid arguments";
				return;
			}

			m_handler->registerInput( arguments[ 0 ], &exception );
		} );

		RegisterFunction( container, "syncInput", [this]( const CefV8ValueList& arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
		{
			if ( arguments.size() != 1
				|| !arguments[ 0 ]->IsObject() )
			{
				exception = "Invalid arguments";
				return;
			}

			m_handler->syncInput( arguments[ 0 ], &retval, &exception );
		} );
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


CefRefPtr<CefV8Value> windowInfoFromMessage( CefRefPtr<CefListValue> windowInfo )
{
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
	return windowObj;
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
		windows->SetValue( i, windowInfoFromMessage( pWindows->GetList( i ) ) );
	}

	m_windowListCallback->ExecuteFunction( nullptr, { windows } );
	m_windowListContext->Exit();
}


void CAardvarkObject::msgWindowUpdate( CefRefPtr< CefProcessMessage > msg )
{
	CefRefPtr<CefListValue> windowInfo = msg->GetArgumentList()->GetList( 0 );
	std::string windowHandle = windowInfo->GetString( 1 );
	
	auto i = m_mapWindowSubscriptions.find( windowHandle );
	if ( i == m_mapWindowSubscriptions.end() )
	{
		return;
	}

	i->second.context->Enter();

	CefRefPtr<CefV8Value> windowObj = windowInfoFromMessage( windowInfo );
	i->second.callback->ExecuteFunction( nullptr, { windowObj } );
	i->second.context->Exit();
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
			
			std::string configData = message->GetArgumentList()->GetString( 2 );
			j = nlohmann::json::parse( configData.begin(), configData.end() );
			m_config = j.get<aardvark::AardvarkConfig_t>();

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
	else if ( messageName == "window_update" )
	{
		for ( auto context : m_contexts )
		{
			context.aardvarkObject->msgWindowUpdate( message );
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

std::string ParseStringField( CefRefPtr<CefV8Value> obj, const std::string & objectName, const std::string& fieldName, CefString* exception )
{
	if ( !obj )
	{
		*exception = objectName + " was null";
		return "";
	}
	if ( !obj->IsObject() )
	{
		*exception = objectName + " was not an object";
		return "";
	}
	CefRefPtr<CefV8Value> field = obj->GetValue( fieldName );
	if ( !field )
	{
		*exception = objectName + " had no field " + fieldName;
		return "";
	}
	if ( !field->IsString() )
	{
		*exception = objectName + " field " + fieldName + " was not a string";
		return "";
	}

	return field->GetStringValue();
}

double ParseNumberField( CefRefPtr<CefV8Value> obj, const std::string& objectName, const std::string& fieldName, CefString* exception,
	double default )
{
	if ( !obj )
	{
		*exception = objectName + " was null";
		return 0;
	}
	if ( !obj->IsObject() )
	{
		*exception = objectName + " was not an object";
		return 0;
	}
	CefRefPtr<CefV8Value> field = obj->GetValue( fieldName );
	if ( !field || field->IsNull() || field->IsUndefined() )
	{
		return default;
	}

	if ( !field->IsDouble() && !field->IsInt() && !field->IsUInt() )
	{
		*exception = objectName + " field " + fieldName + " was not an unsigned int";
		return 0;
	}

	return field->GetDoubleValue();
}

bool ParseBooleanField( CefRefPtr<CefV8Value> obj, const std::string& objectName, const std::string& fieldName, CefString* exception )
{
	if ( !obj )
	{
		*exception = objectName + " was null";
		return false;
	}
	if ( !obj->IsObject() )
	{
		*exception = objectName + " was not an object";
		return false;
	}
	CefRefPtr<CefV8Value> field = obj->GetValue( fieldName );
	if ( !field )
	{
		*exception = objectName + " had no field " + fieldName;
		return false;
	}
	if ( !field->IsBool() )
	{
		*exception = objectName + " field " + fieldName + " was not an unsigned int";
		return false;
	}

	return field->GetBoolValue();
}


void CAardvarkRenderProcessHandler::registerInput( CefRefPtr<CefV8Value> manifestJS, CefString* exception )
{
	if ( m_inputManifest )
	{
		*exception = "registerInput can only be called once";
		return;
	}

	ParseInputManifest( manifestJS, exception );
	if ( !exception->empty() )
	{
		return;
	}

	vr::EVRInitError err = PrepareForVRInit();
	if ( err != vr::VRInitError_None )
	{
		m_inputManifest = nullptr;
		*exception = std::string( "prepare VR_Init failed: " ) + vr::VR_GetVRInitErrorAsSymbol( err );
		return;
	}
	
	nlohmann::json inputFiles = toInputFiles( *m_inputManifest );
	for ( auto& [ name, contents ] : inputFiles.items() ) 
	{
		std::ofstream o( tools::GetInputDirectory() / m_gadgetId / name );
		o << std::setw( 4 ) << contents << std::endl;
	}

	err = InitOpenVR();
	if ( err != vr::VRInitError_None )
	{
		m_inputManifest = nullptr;
		*exception = std::string( "VR_Init failed: " ) + vr::VR_GetVRInitErrorAsSymbol( err );
		return;
	}

	std::filesystem::path actionManifestPath = tools::GetInputDirectory() / m_gadgetId / "action_manifest.json";
	vr::EVRInputError inputErr = vr::VRInput()->SetActionManifestPath( actionManifestPath.u8string().c_str() );
	if ( inputErr != vr::VRInputError_None )
	{
		*exception = std::string( "SetActionManifestPath failed: " ) + std::to_string( inputErr );
		vr::VR_Shutdown();
		m_inputManifest = nullptr;
	}

	// get handles for everything
	for ( auto& actionSet : m_inputManifest->m_actionSets )
	{
		vr::VRInput()->GetActionSetHandle( ( "/actions/" + actionSet.name ).c_str(), &actionSet.handle );
		for ( auto& action : actionSet.actions )
		{
			vr::VRInput()->GetActionHandle( ( "/actions/" + actionSet.name + "/in/" + action.name ).c_str(), &action.handle );
		}
	}
}


vr::EVRInitError CAardvarkRenderProcessHandler::InitOpenVR()
{
	nlohmann::json startupInfo =
	{
		{ "app_key", "aardvarkxr.gadget." + m_gadgetId },
		{ "app_name", "Aardvark - " + m_gadgetManifest->m_name },
	};

	vr::EVRInitError err;
	vr::VR_Init( &err, vr::VRApplication_Overlay, startupInfo.dump().c_str() );
	return err;
}


vr::EVRInitError CAardvarkRenderProcessHandler::PrepareForVRInit()
{
	for ( auto& contextInfo : m_contexts )
	{
		if ( !contextInfo.frame->IsMain() )
			continue;

		m_gadgetId = tools::UriToSubpath( contextInfo.frame->GetURL() );
		break;
	}

	// make an app manifest file for this instance so that when we connect for real SteamVR will know about our app
	std::filesystem::path actionManifestPath = tools::GetInputDirectory() / m_gadgetId / "action_manifest.json";
	nlohmann::json appManifest =
	{
		{ "source", "aardvark" },
		{ "applications" ,
			{
				{
					{ "app_key", "aardvarkxr.gadget." + m_gadgetId },
					{ "launch_type" , "url" },
					{ "action_manifest_path" , actionManifestPath.u8string() },
					{ "is_dashboard_overlay" , true },
					{ "url" , "this://url_will_not_work" },
					{ "arguments" , "" },
					{ "strings" ,
						{ "en_us",
							{
								{ "name", "Aardvark - " + m_gadgetManifest->m_name }
							}
						}
					}
				}
			}
		}
	};

	std::filesystem::create_directories( tools::GetInputDirectory() / m_gadgetId );

	std::filesystem::path appManifestPath = tools::GetInputDirectory() / m_gadgetId / ( m_gadgetId + ".vrmanifest" );
	{
		std::ofstream o( appManifestPath );
		o << std::setw( 4 ) << appManifest << std::endl;
	}

	vr::EVRInitError err;
	vr::VR_Init( &err, vr::VRApplication_Utility );
	if ( err != vr::VRInitError_None )
		return err;

	vr::VRApplications()->AddApplicationManifest( appManifestPath.u8string().c_str(), true );

	vr::VR_Shutdown();
	return vr::VRInitError_None;
}

void CAardvarkRenderProcessHandler::ParseInputManifest( CefRefPtr<CefV8Value> manifestJS, CefString* exception )
{
	std::unique_ptr< CInputManifest> pManifest = std::make_unique<CInputManifest>();
	for ( int i = 0; i < manifestJS->GetArrayLength(); i++ )
	{
		CefRefPtr<CefV8Value> pActionSet = manifestJS->GetValue( i );

		CInputManifestActionSet actionSet;
		actionSet.name = ParseStringField( pActionSet, "action set", "name", exception );
		actionSet.localizedName = ParseStringField( pActionSet, "action set", "localizedName", exception );
		actionSet.priority = (uint32_t)ParseNumberField( pActionSet, "action set", "priority", exception, 0 );
		actionSet.suppressAppBindings = ParseBooleanField( pActionSet, "action set", "suppressAppBindings", exception );

		if ( !exception->empty() )
		{
			return;
		}

		CefRefPtr< CefV8Value> pActions = pActionSet->GetValue( "actions" );
		if ( !pActions || !pActions->IsArray() )
		{
			*exception = "invalid action array";
			return;
		}

		for ( int iAction = 0; iAction < pActions->GetArrayLength(); iAction++ )
		{
			CefRefPtr<CefV8Value> pAction = pActions->GetValue( iAction );

			CInputManifestAction action;
			action.name = ParseStringField( pAction, "action", "name", exception );
			action.localizedName = ParseStringField( pAction, "action", "localizedName", exception );
			action.type = (ActionType)ParseNumberField( pAction, "action", "type", exception, (double)ActionType::Unknown );
			if ( !exception->empty() )
			{
				return;
			}
			if ( action.type != ActionType::Boolean && action.type != ActionType::Float && action.type != ActionType::Vector2 )
			{
				*exception = "action " + action.name + " has an invalid type";
				return;
			}

			CefRefPtr< CefV8Value> pBindings = pAction->GetValue( "bindings" );
			if ( pBindings )
			{
				if ( !pBindings->IsArray() )
				{
					*exception = "invalid binding array";
					return;
				}

				for ( int iBinding = 0; iBinding < pBindings->GetArrayLength(); iBinding++ )
				{
					CefRefPtr<CefV8Value> pBinding = pBindings->GetValue( iBinding );

					CInputManifestActionBinding binding;
					binding.interactionProfile = ParseStringField( pBinding, action.name + " binding", "interactionProfile", exception );
					binding.inputPath = ParseStringField( pBinding, action.name + " binding", "inputPath", exception );

					if ( !exception->empty() )
					{
						return;
					}

					action.bindings.push_back( std::move( binding ) );
				}

			}


			actionSet.actions.push_back( std::move( action ) );
		}

		pManifest->m_actionSets.push_back( std::move( actionSet ) );
	}

	m_inputManifest = std::move( pManifest );
}

void CAardvarkRenderProcessHandler::syncInput( CefRefPtr<CefV8Value> infoJS, CefRefPtr<CefV8Value>* retVal, CefString* exception )
{
	if ( !m_inputManifest )
	{
		*exception = "registerInput must be called before syncInput";
		return;
	}

	if ( !infoJS->IsObject() )
	{
		*exception = "InputInfo must be an object";
		return;
	}

	CefRefPtr<CefV8Value> actionSetsJS = infoJS->GetValue( "activeActionSets" );
	if ( !actionSetsJS || !actionSetsJS->IsArray() )
	{
		*exception = "activeActionSets must be an array";
		return;
	}

	static vr::VRInputValueHandle_t k_leftHand = 0;
	static vr::VRInputValueHandle_t k_rightHand = 0;
	if ( !k_leftHand )
	{
		vr::VRInput()->GetInputSourceHandle( "/user/hand/left", &k_leftHand );
		vr::VRInput()->GetInputSourceHandle( "/user/hand/right", &k_rightHand );
	}

	std::map<uint64_t, const CInputManifestActionSet*> actionSetsToQuery;
	std::vector<vr::VRActiveActionSet_t> activeActionSets;
	for ( int iActiveActionSet = 0; iActiveActionSet < actionSetsJS->GetArrayLength(); iActiveActionSet++ )
	{
		CefRefPtr<CefV8Value> actionSetJS = actionSetsJS->GetValue( iActiveActionSet );
		if ( !actionSetsJS->IsObject() )
		{
			*exception = "invalid entry in activeActionSets";
			return;
		}

		std::string actionSetName = ParseStringField( actionSetJS, "active action set", "actionSetName", exception );
		if ( !exception->empty() )
			return;

		const CInputManifestActionSet* actionSetToQuery = nullptr;
		for ( CInputManifestActionSet& actionSet : m_inputManifest->m_actionSets )
		{
			if ( actionSet.name == actionSetName )
			{
				actionSetToQuery = &actionSet;
				break;
			}
		}

		if ( !actionSetToQuery )
		{
			*exception = "Unknown action set " + actionSetName;
			return;
		}

		std::vector<vr::VRInputValueHandle_t> topLevelPaths;
		CefRefPtr<CefV8Value> topLevelPathsJS = actionSetJS->GetValue( "topLevelPaths" );
		if ( topLevelPathsJS && !topLevelPathsJS->IsNull() && !topLevelPathsJS->IsUndefined() )
		{
			if ( !topLevelPathsJS->IsArray() )
			{
				*exception = "topLevelPaths must be an array if it is provided";
				return;
			}

			if ( topLevelPathsJS->GetArrayLength() == 0 )
			{
				*exception = "topLevelPaths contain at least one path if it is defined";
				return;
			}

			for ( int i = 0; i < topLevelPathsJS->GetArrayLength(); i++ )
			{
				CefRefPtr<CefV8Value> v = topLevelPathsJS->GetValue( i );
				if ( !v->IsString() )
				{
					*exception = "top level paths must be strings";
					return;
				}

				std::string path = v->GetStringValue();
				if ( path != "/user/hand/right" && path != "/user/hand/left" )
				{
					*exception = "top level path must be either /user/hand/left or /user/hand/right";
					return;
				}

				vr::VRInputValueHandle_t handle;
				vr::VRInput()->GetInputSourceHandle( path.c_str(), &handle );
				topLevelPaths.push_back( handle );
			}
		}

		vr::VRActiveActionSet_t activeSet = {};
		activeSet.ulActionSet = actionSetToQuery->handle;
		activeSet.nPriority = actionSetToQuery->priority;
		if ( actionSetToQuery->suppressAppBindings )
		{
			activeSet.nPriority += vr::k_nActionSetOverlayGlobalPriorityMin;
		}

		if ( topLevelPaths.empty() )
		{
			topLevelPaths.push_back( k_leftHand );
			topLevelPaths.push_back( k_rightHand );
		}

		for( vr::VRInputValueHandle_t pathHandle : topLevelPaths )
		{
			activeSet.ulRestrictedToDevice = pathHandle;
			activeActionSets.push_back( activeSet );
		}

		actionSetsToQuery[actionSetToQuery->handle] = actionSetToQuery;
	}

	vr::EVRInputError err = vr::VRInput()->UpdateActionState( &activeActionSets[ 0 ], sizeof( vr::VRActiveActionSet_t ), 
		(uint32_t)activeActionSets.size() );
	if ( err != vr::VRInputError_None )
	{
		*exception = "UpdateActionState failed with " + std::to_string( err );
		return;
	}


	( *retVal ) = CefV8Value::CreateObject( nullptr, nullptr );

	CefRefPtr<CefV8Value> results = CefV8Value::CreateObject( nullptr, nullptr );
	( *retVal )->SetValue( "results", results, V8_PROPERTY_ATTRIBUTE_NONE );

	for ( const vr::VRActiveActionSet_t& active : activeActionSets )
	{
		std::string deviceName = active.ulRestrictedToDevice == k_leftHand ? "left" : "right";
		const CInputManifestActionSet * actionSet = actionSetsToQuery[ active.ulActionSet ];

		for ( const CInputManifestAction& action : actionSet->actions )
		{
			CefRefPtr<CefV8Value> deviceResult = CefV8Value::CreateObject( nullptr, nullptr );
			switch ( action.type )
			{
			case ActionType::Boolean:
			{
				vr::InputDigitalActionData_t data;
				err = vr::VRInput()->GetDigitalActionData( action.handle, &data, sizeof( data ), active.ulRestrictedToDevice );
				if ( err == vr::VRInputError_None )
				{
					deviceResult->SetValue( "active", CefV8Value::CreateBool( data.bActive ), V8_PROPERTY_ATTRIBUTE_NONE );
					deviceResult->SetValue( "value", CefV8Value::CreateBool( data.bState ), V8_PROPERTY_ATTRIBUTE_NONE );
				}
			}
			break;

			case ActionType::Float:
			case ActionType::Vector2:
			{
				vr::InputAnalogActionData_t data;
				err = vr::VRInput()->GetAnalogActionData( action.handle, &data, sizeof( data ), active.ulRestrictedToDevice );
				if ( err == vr::VRInputError_None )
				{
					deviceResult->SetValue( "active", CefV8Value::CreateBool( data.bActive ), V8_PROPERTY_ATTRIBUTE_NONE );

					if ( action.type == ActionType::Float )
					{
						deviceResult->SetValue( "value", CefV8Value::CreateDouble( data.x ), V8_PROPERTY_ATTRIBUTE_NONE );
					}
					else
					{
						CefRefPtr<CefV8Value> arr = CefV8Value::CreateArray( 2 );
						arr->SetValue( 0, CefV8Value::CreateDouble( data.x ) );
						arr->SetValue( 1, CefV8Value::CreateDouble( data.y ) );
						deviceResult->SetValue( "value", arr, V8_PROPERTY_ATTRIBUTE_NONE );
					}
				}
			}
			break;

			}

			CefRefPtr<CefV8Value> as = results->GetValue( actionSet->name );
			if ( !as || !as->IsObject() )
			{
				as = CefV8Value::CreateObject( nullptr, nullptr );
				results->SetValue( actionSet->name, as, V8_PROPERTY_ATTRIBUTE_NONE );
			}

			CefRefPtr<CefV8Value> a = as->GetValue( action.name );
			if ( !a || !a->IsObject() )
			{
				a = CefV8Value::CreateObject( nullptr, nullptr );
				as->SetValue( action.name, a, V8_PROPERTY_ATTRIBUTE_NONE );
			}

			a->SetValue( deviceName, deviceResult, V8_PROPERTY_ATTRIBUTE_NONE );
		}
	}

}

