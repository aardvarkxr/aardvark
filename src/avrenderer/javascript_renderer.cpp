#include "javascript_renderer.h"
#include "av_cef_javascript.h"
#include "aardvark_renderer.h"
#include "vrmanager.h"
#include "json/json.hpp"
#include <aardvark/aardvark_renderer_config.h>
#include <algorithm>
#include <tools/base64.h>
#include <stb_image.h>

using aardvark::EEndpointType;
using aardvark::EndpointAddr_t;

extern CefRefPtr<CefV8Value> grabEventToCefEvent( const aardvark::GrabEvent_t & grabEvent );

CJavascriptModelInstance::CJavascriptModelInstance( std::unique_ptr<IModelInstance> modelInstance, 
	std::shared_ptr<IRenderer> renderer )
{
	m_modelInstance = std::move( modelInstance );
	m_renderer = renderer;
}

CJavascriptModelInstance::~CJavascriptModelInstance()
{
	// make sure the model goes away before the renderer
	m_modelInstance = nullptr;
	m_renderer = nullptr;
}


bool mat4FromJavascript( CefRefPtr<CefV8Value> arg, glm::mat4 *out )
{
	if ( !arg->IsArray()
		|| arg->GetArrayLength() != 16
		|| !arg->GetValue( 0 )->IsDouble() )
	{
		return false;
	}

	(*out)[0][0] = arg->GetValue( 0 )->GetDoubleValue();
	(*out)[0][1] = arg->GetValue( 1 )->GetDoubleValue();
	(*out)[0][2] = arg->GetValue( 2 )->GetDoubleValue();
	(*out)[0][3] = arg->GetValue( 3 )->GetDoubleValue();
	(*out)[1][0] = arg->GetValue( 4 )->GetDoubleValue();
	(*out)[1][1] = arg->GetValue( 5 )->GetDoubleValue();
	(*out)[1][2] = arg->GetValue( 6 )->GetDoubleValue();
	(*out)[1][3] = arg->GetValue( 7 )->GetDoubleValue();
	(*out)[2][0] = arg->GetValue( 8 )->GetDoubleValue();
	(*out)[2][1] = arg->GetValue( 9 )->GetDoubleValue();
	(*out)[2][2] = arg->GetValue( 10 )->GetDoubleValue();
	(*out)[2][3] = arg->GetValue( 11 )->GetDoubleValue();
	(*out)[3][0] = arg->GetValue( 12 )->GetDoubleValue();
	(*out)[3][1] = arg->GetValue( 13 )->GetDoubleValue();
	(*out)[3][2] = arg->GetValue( 14 )->GetDoubleValue();
	(*out)[3][3] = arg->GetValue( 15 )->GetDoubleValue();

	return true;
}

bool aabbFromJavascript( CefRefPtr<CefV8Value> arg, AABB_t *out )
{
	if ( !arg->IsObject() )
	{
		return false;
	}

	out->xMin = (float)arg->GetValue( "xMin" )->GetDoubleValue();
	out->xMax = (float)arg->GetValue( "xMax" )->GetDoubleValue();
	out->yMin = (float)arg->GetValue( "yMin" )->GetDoubleValue();
	out->yMax = (float)arg->GetValue( "yMax" )->GetDoubleValue();
	out->zMin = (float)arg->GetValue( "zMin" )->GetDoubleValue();
	out->zMax = (float)arg->GetValue( "zMax" )->GetDoubleValue();

	return true;
}

bool CJavascriptModelInstance::init( CefRefPtr<CefV8Value > container )
{
	RegisterFunction( container, "setUniverseFromModelTransform", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 1 )
		{
			exception = "Invalid arguments";
			return;
		}

		glm::mat4 universeFromModel;
		if ( !mat4FromJavascript( arguments[0], &universeFromModel ) )
		{
			exception = "argument must be an array of 16 numbers";
			return;
		}

		m_modelInstance->setUniverseFromModel( universeFromModel );
	} );

	RegisterFunction( container, "setOverrideTexture", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 1 )
		{
			exception = "Invalid arguments";
			return;
		}

		if ( !arguments[0]->IsObject() )
		{
			exception = "argument must a AvSharedTextureInfo object";
			return;
		}

		ETextureType type = (ETextureType)arguments[0]->GetValue( "type" )->GetIntValue();

		switch ( type )
		{
		case ETextureType::D3D11Texture2D:
		{
			ETextureFormat format = (ETextureFormat)arguments[ 0 ]->GetValue( "format" )->GetIntValue();
			uint32_t width = arguments[ 0 ]->GetValue( "width" )->GetUIntValue();
			uint32_t height = arguments[ 0 ]->GetValue( "height" )->GetUIntValue();
			void* sharedTextureHandle = reinterpret_cast<void*>(
				std::strtoull( std::string( arguments[ 0 ]->GetValue( "dxgiHandle" )->GetStringValue() ).c_str(), nullptr, 0 ) );
			m_modelInstance->setDxgiOverrideTexture( sharedTextureHandle, format, width, height );
		}
		break;

		case ETextureType::UrlTexture:
		{
			std::string url = arguments[ 0 ]->GetValue( "url" )->GetStringValue();
			std::string modelData = base64_decode( arguments[ 0 ]->GetValue( "textureDataBase64" )->GetStringValue() );

			int width, height, comp;
			stbi_uc *parsed = stbi_load_from_memory( (const stbi_uc*)modelData.c_str(), (int)modelData.size(), 
				&width, &height, &comp, 4 );

			m_modelInstance->setOverrideTexture( ETextureFormat::R8G8B8A8, parsed, (uint32_t)width, (uint32_t)height );

			stbi_image_free( parsed );
		}
		break;

		}
	} );

	RegisterFunction( container, "setBaseColor", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 1 )
		{
			exception = "Invalid arguments";
			return;
		}

		if ( !arguments[0]->IsArray() || arguments[0]->GetArrayLength() != 4 )
		{
			exception = "argument must an array of 4 numbers";
			return;
		}

		glm::vec4 color =
		{
			arguments[0]->GetValue( 0 )->GetDoubleValue(),
			arguments[0]->GetValue( 1 )->GetDoubleValue(),
			arguments[0]->GetValue( 2 )->GetDoubleValue(),
			arguments[0]->GetValue( 3 )->GetDoubleValue(),
		};

		m_modelInstance->setBaseColor( color );
	} );

	RegisterFunction( container, "setOverlayOnly", [this]( const CefV8ValueList& arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 1 )
		{
			exception = "Invalid arguments";
			return;
		}

		if ( !arguments[ 0 ]->IsBool() )
		{
			exception = "argument must a bool";
			return;
		}

		m_modelInstance->setOverlayOnly( arguments[0]->GetBoolValue() );
	} );
	return true;
}

CJavascriptRenderer::CJavascriptRenderer( CAardvarkRenderProcessHandler *renderProcessHandler )
{
	m_handler = renderProcessHandler;
	m_renderer = std::make_unique<VulkanExample>();
	m_vrManager = std::make_unique<CVRManager>();

}

bool CJavascriptRenderer::hasPermission( const std::string & permission )
{
	return m_handler->hasPermission( permission );
}

void CJavascriptRenderer::runFrame()
{
	if ( m_quitting )
		return;

	auto tStart = std::chrono::high_resolution_clock::now();

	bool shouldQuitVr = false;
	m_vrManager->runFrame( &shouldQuitVr );

	if ( m_jsTraverser )
	{
		m_jsTraverser->ExecuteFunction( nullptr, CefV8ValueList{} );

	}

	if ( m_vrManager->shouldRender() )
	{
		m_renderer->processRenderList();
	}

	auto tEnd = std::chrono::high_resolution_clock::now();
	auto tDiff = std::chrono::duration<double, std::milli>( tEnd - tStart ).count();


	bool shouldQuitWindow = false;
	m_renderer->runFrame( &shouldQuitWindow, tDiff / 1000.0f );

	if ( shouldQuitWindow || shouldQuitVr )
	{
		m_quitting = true;
		CefRefPtr<CefProcessMessage> msg = CefProcessMessage::Create( "quit" );
		m_handler->sendBrowserMessage( msg );
	}
}

bool endpointAddrFromJs( CefRefPtr< CefV8Value > obj, EndpointAddr_t *addr )
{
	if ( !obj || !obj->IsObject() || !addr )
		return false;

	addr->type = EEndpointType::Unknown;

	if ( obj->HasValue( "type" ) )
	{
		CefRefPtr<CefV8Value> type = obj->GetValue( "type" );
		if ( type->IsInt() )
		{
			addr->type = (EEndpointType)type->GetIntValue();
		}
	}

	if ( obj->HasValue( "endpointId" ) )
	{
		CefRefPtr<CefV8Value> v = obj->GetValue( "endpointId" );
		if ( v->IsUInt() )
		{
			addr->endpointId= v->GetUIntValue();
		}
	}

	if ( obj->HasValue( "nodeId" ) )
	{
		CefRefPtr<CefV8Value> v = obj->GetValue( "nodeId" );
		if ( v->IsUInt() )
		{
			addr->nodeId = v->GetUIntValue();
		}
	}

	return addr->type != EEndpointType::Unknown;
}

CefRefPtr<CefV8Value> endpointAddrToJs( const EndpointAddr_t & addr )
{
	CefRefPtr<CefV8Value> out = CefV8Value::CreateObject( nullptr, nullptr );
	out->SetValue( "type", CefV8Value::CreateInt( (int)addr.type ), V8_PROPERTY_ATTRIBUTE_NONE );
	if ( addr.type != EEndpointType::Hub )
	{
		out->SetValue( "endpointId", CefV8Value::CreateUInt( addr.endpointId ), V8_PROPERTY_ATTRIBUTE_NONE );
	}
	if ( addr.type == EEndpointType::Node )
	{
		out->SetValue( "nodeId", CefV8Value::CreateUInt( addr.nodeId ), V8_PROPERTY_ATTRIBUTE_NONE );
	}
	return out;
}

CefRefPtr<CefV8Value> endpointAddrVectorToJs( const std::vector<EndpointAddr_t> & addrs )
{
	if ( addrs.empty() )
	{
		return CefV8Value::CreateNull();
	}

	CefRefPtr<CefV8Value> out = CefV8Value::CreateArray( (int)addrs.size() );
	for ( int i = 0; i < addrs.size(); i++ )
	{
		out->SetValue( i, endpointAddrToJs( addrs[i] ) );
	}
	return out;
}

bool gadgetParamsFromJs( CefRefPtr< CefV8Value > obj, aardvark::GadgetParams_t *params)
{
	if ( !obj || !obj->IsObject() || !params )
		return false;

	if ( obj->HasValue( "uri" ) )
	{
		CefRefPtr<CefV8Value> type = obj->GetValue( "uri" );
		if ( type->IsString() )
		{
			params->uri = type->GetStringValue();
		}
	}

	if ( obj->HasValue( "initialInterfaces" ) )
	{
		CefRefPtr<CefV8Value> type = obj->GetValue( "initialInterfaces" );
		if ( type->IsString() )
		{
			params->initialInterfaces = type->GetStringValue();
		}
	}

	if ( obj->HasValue( "epToNotify" ) )
	{
		if ( !endpointAddrFromJs( obj->GetValue( "epToNotify" ), &params->epToNotify ) )
		{
			return false;
		}

	}

	return !params->uri.empty();
}


bool CJavascriptRenderer::init( CefRefPtr<CefV8Value> container )
{
	m_vrManager->init();
	m_renderer->init( nullptr, m_vrManager.get(), m_handler->getConfig() );

	RegisterFunction( container, "setRendererConfig", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if (arguments.size() != 1)
		{
			exception = "Invalid arguments";
			return;
		}
		
		try
		{
			auto settings = arguments[0]->GetStringValue().ToString();
			nlohmann::json j = nlohmann::json::parse( settings.begin(), settings.end() );
			auto rendererConfig = j.get<CAardvarkRendererConfig>();
			if ( std::any_of( rendererConfig.m_clearColor.begin(), rendererConfig.m_clearColor.end(),
				 [](float x) { return x < 0.0f && x > 1.0f; } ) ) {
				exception = "invalid clearColor, values must be in the range [0, 1]";
				return;
			}
			m_renderer->setRenderingConfiguration(rendererConfig);
		}
		catch (nlohmann::json::exception &)
		{
			exception = "invalid config";
			return;
		}
	} );


	RegisterFunction( container, "registerTraverser", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 1 )
		{
			exception = "Invalid arguments";
			return;
		}

		if ( !arguments[0]->IsFunction() )
		{
			exception = "argument must be a function";
			return;
		}

		m_jsTraverser = arguments[0];
	} );

	RegisterFunction( container, "renderList", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 1 )
		{
			exception = "Invalid arguments";
			return;
		}

		if ( !arguments[0]->IsArray() )
		{
			exception = "argument must be an array of model instances";
			return;
		}

		m_renderer->resetRenderList();

		CefRefPtr< CefV8Value > renderList = arguments[0];
		for ( int32_t entry = 0; entry < renderList->GetArrayLength(); entry++ )
		{
			CefRefPtr< CefV8Value > modelInstanceObject = renderList->GetValue( entry );
			CefRefPtr< CJavascriptModelInstance > modelInstance = 
				static_cast<CJavascriptModelInstance *>( modelInstanceObject->GetUserData().get() );
			m_renderer->addToRenderList( modelInstance->getModelInstance() );
		}
	} );

	RegisterFunction( container, "registerHapticProcessor", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 1 )
		{
			exception = "Invalid arguments";
			return;
		}

		if ( !arguments[0]->IsFunction() )
		{
			exception = "argument must be a function";
			return;
		}

		m_jsHapticProcessor = arguments[0];
	} );

	RegisterFunction( container, "sendHapticEventForHand", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 4 )
		{
			exception = "Invalid arguments";
			return;
		}

		if ( !arguments[0]->IsInt() )
		{
			exception = "first argument must be an int";
			return;
		}
		if ( !arguments[1]->IsDouble()
			|| !arguments[2]->IsDouble() 
			|| !arguments[3]->IsDouble() )
		{
			exception = "second, third, and fourth arguments must be an numbers";
			return;
		}

		m_vrManager->sentHapticEventForHand( (EHand)arguments[0]->GetIntValue(),
			arguments[1]->GetDoubleValue(),
			arguments[2]->GetDoubleValue(),
			arguments[3]->GetDoubleValue() );
	} );


	RegisterFunction( container, "getUniverseFromOriginTransform", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 1 )
		{
			exception = "Invalid arguments";
			return;
		}

		if ( !arguments[0]->IsString() )
		{
			exception = "argument must be the name of an origin as a string";
			return;
		}

		glm::mat4 universeFromOrigin;
		if ( m_vrManager->getUniverseFromOrigin( arguments[0]->GetStringValue(), &universeFromOrigin ) )
		{
			retval = CefV8Value::CreateArray( 16 );
			for ( int x = 0; x < 4; x++ )
			{
				for ( int y = 0; y < 4; y++ )
				{
					retval->SetValue( x + 4 * y, CefV8Value::CreateDouble( universeFromOrigin[y][x] ) );
				}
			}
		}
		else
		{
			retval = CefV8Value::CreateNull();
		}
	} );

	RegisterFunction( container, "createModelInstance", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 2 )
		{
			exception = "Invalid arguments";
			return;
		}

		if ( !arguments[0]->IsString() )
		{
			exception = "first argument must be a url string";
			return;
		}

		if ( !arguments[ 1 ]->IsString() )
		{
			exception = "second argument must be a base64 encoded string of the gltf model blob because CEF doesn't support arraybuffer";
			return;
		}

		const std::string uri = arguments[0]->GetStringValue();
		std::string modelData = base64_decode( arguments[ 1 ]->GetStringValue() );
		std::string sError;
		auto modelInstance = m_renderer->createModelInstance( uri, modelData.c_str(), modelData.size(), &sError );
		if ( !modelInstance )
		{
			if (!sError.empty())
			{
				exception = sError;
			}

			retval = CefV8Value::CreateNull();
		}
		else
		{
			JsObjectPtr<CJavascriptModelInstance> newModelInstance =
				CJavascriptObjectWithFunctions::create<CJavascriptModelInstance>(
					std::move( modelInstance ), m_renderer );
			retval = newModelInstance.object;
		}
	} );

	RegisterFunction( container, "getActionState", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 1 )
		{
			exception = "Invalid arguments";
			return;
		}

		if ( !arguments[ 0 ]->IsInt() )
		{
			exception = "argument must be a number (and a hand enum)";
		}

		EHand hand = (EHand)arguments[0]->GetIntValue();
		IVrManager::ActionState_t actionState = m_vrManager->getCurrentActionState( hand );

		retval = CefV8Value::CreateObject( nullptr, nullptr );
		retval->SetValue( "a", CefV8Value::CreateBool( actionState.a ), V8_PROPERTY_ATTRIBUTE_NONE );
		retval->SetValue( "b", CefV8Value::CreateBool( actionState.b ), V8_PROPERTY_ATTRIBUTE_NONE );
		retval->SetValue( "grab", CefV8Value::CreateBool( actionState.grab ), V8_PROPERTY_ATTRIBUTE_NONE );
		retval->SetValue( "grabShowRay", CefV8Value::CreateBool( actionState.grabShowRay ), V8_PROPERTY_ATTRIBUTE_NONE );
		retval->SetValue( "squeeze", CefV8Value::CreateBool( actionState.squeeze ), V8_PROPERTY_ATTRIBUTE_NONE );
		retval->SetValue( "detach", CefV8Value::CreateBool( actionState.detach ), V8_PROPERTY_ATTRIBUTE_NONE );

		CefRefPtr<CefV8Value> grabMove = CefV8Value::CreateArray( 2 );
		grabMove->SetValue( 0, CefV8Value::CreateDouble( actionState.grabMove.x ) );
		grabMove->SetValue( 1, CefV8Value::CreateDouble( actionState.grabMove.y ) );
		retval->SetValue( "grabMove", grabMove, V8_PROPERTY_ATTRIBUTE_NONE );
	} );


	return true;
}

CJavascriptRenderer::~CJavascriptRenderer() noexcept
{
	m_renderer = nullptr;
}


