#include "javascript_renderer.h"
#include "av_cef_javascript.h"
#include "aardvark_renderer.h"
#include "vrmanager.h"

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
		ETextureFormat format = (ETextureFormat)arguments[0]->GetValue( "format" )->GetIntValue();
		uint32_t width = arguments[0]->GetValue( "width" )->GetUIntValue();
		uint32_t height = arguments[0]->GetValue( "height" )->GetUIntValue();
		void *sharedTextureHandle = reinterpret_cast<void*>(
			std::strtoull( std::string( arguments[0]->GetValue( "dxgiHandle" )->GetStringValue() ).c_str(), nullptr, 0 ) );

		m_modelInstance->setOverrideTexture( sharedTextureHandle, type, format, width, height );
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

	m_vrManager->updateOpenVrPoses();

	if ( m_jsTraverser )
	{
		// we'll use our local intersections and collisions for callbacks from JS
		m_intersections.reset();
		m_collisions.reset();

		m_jsTraverser->ExecuteFunction( nullptr, CefV8ValueList{} );

	}


	m_renderer->processRenderList();

	auto tEnd = std::chrono::high_resolution_clock::now();
	auto tDiff = std::chrono::duration<double, std::milli>( tEnd - tStart ).count();

	m_vrManager->doInputWork();

	bool shouldQuit = false;
	m_renderer->runFrame( &shouldQuit, tDiff / 1000.0f );

	if ( shouldQuit )
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


bool CJavascriptRenderer::init( CefRefPtr<CefV8Value> container )
{
	m_vrManager->init();
	m_renderer->init( nullptr, m_vrManager.get() );

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


	RegisterFunction( container, "updateGrabberIntersections", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 0 )
		{
			exception = "Invalid arguments";
			return;
		}

		std::vector<GrabberCollisionState_t> res = m_collisions.updateGrabberIntersections();
		retval = CefV8Value::CreateArray( (int)res.size() );
		for ( size_t unIndex = 0; unIndex < res.size(); unIndex++ )
		{
			const GrabberCollisionState_t & grabberState = res[unIndex];
			CefRefPtr<CefV8Value> out = CefV8Value::CreateObject( nullptr, nullptr );
			out->SetValue( "grabberId", endpointAddrToJs( grabberState.grabberGlobalId ), V8_PROPERTY_ATTRIBUTE_NONE );
			out->SetValue( "isPressed", CefV8Value::CreateBool( grabberState.isPressed ), V8_PROPERTY_ATTRIBUTE_NONE );
			if ( !grabberState.grabbables.empty() )
			{
				CefRefPtr<CefV8Value> grabbables = CefV8Value::CreateArray( (int)grabberState.grabbables.size() );
				for ( uint32_t n = 0; n < grabberState.grabbables.size(); n++ )
				{
					const GrabbableCollision_t & gc = grabberState.grabbables[n];
					CefRefPtr<CefV8Value> grabbable = CefV8Value::CreateObject( nullptr, nullptr );
					grabbable->SetValue( "grabbableId", endpointAddrToJs( gc.grabbableId ), V8_PROPERTY_ATTRIBUTE_NONE );
					grabbable->SetValue( "handleId", endpointAddrToJs( gc.handleId), V8_PROPERTY_ATTRIBUTE_NONE );
					grabbables->SetValue( n, grabbable );
				}
				out->SetValue( "grabbables", grabbables, V8_PROPERTY_ATTRIBUTE_NONE );
			}
			if ( !grabberState.hooks.empty() )
			{
				out->SetValue( "hooks", endpointAddrVectorToJs( grabberState.hooks ), V8_PROPERTY_ATTRIBUTE_NONE );
			}
			retval->SetValue( (int)unIndex, out );
		}
	} );


	RegisterFunction( container, "updatePokerProximity", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 0 )
		{
			exception = "Invalid arguments";
			return;
		}

		std::vector<PokerState_t> res = m_intersections.updatePokerProximity();
		retval = CefV8Value::CreateArray( (int)res.size() );
		for ( size_t pokerIndex = 0; pokerIndex < res.size(); pokerIndex++ )
		{
			const PokerState_t & pokerState = res[pokerIndex];
			CefRefPtr<CefV8Value> out = CefV8Value::CreateObject( nullptr, nullptr );
			out->SetValue( "pokerId", endpointAddrToJs( pokerState.pokerId ), V8_PROPERTY_ATTRIBUTE_NONE );
			out->SetValue( "isPressed", CefV8Value::CreateBool( pokerState.isPressed ), V8_PROPERTY_ATTRIBUTE_NONE );

			CefRefPtr<CefV8Value> panels = CefV8Value::CreateArray( (int)pokerState.panels.size() );
			for ( size_t panelIndex = 0; panelIndex < pokerState.panels.size(); panelIndex++ )
			{
				const aardvark::PokerProximity_t & inPanel = pokerState.panels[panelIndex];
				CefRefPtr< CefV8Value > outPanel = CefV8Value::CreateObject( nullptr, nullptr );
				outPanel->SetValue( "panelId", endpointAddrToJs( inPanel.panelId ), V8_PROPERTY_ATTRIBUTE_NONE );
				outPanel->SetValue( "x", CefV8Value::CreateDouble( inPanel.x ), V8_PROPERTY_ATTRIBUTE_NONE );
				outPanel->SetValue( "y", CefV8Value::CreateDouble( inPanel.y ), V8_PROPERTY_ATTRIBUTE_NONE );
				outPanel->SetValue( "distance", CefV8Value::CreateDouble( inPanel.distance ), V8_PROPERTY_ATTRIBUTE_NONE );
				panels->SetValue( (int)panelIndex, outPanel );
			}
			out->SetValue( "panels", panels, V8_PROPERTY_ATTRIBUTE_NONE );

			retval->SetValue( (int)pokerIndex, out );
		}
	} );


	RegisterFunction( container, "addGrabbableHandle_Sphere", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 5 )
		{
			exception = "Invalid arguments";
			return;
		}

		EndpointAddr_t grabbableId;
		if ( !endpointAddrFromJs( arguments[0], &grabbableId ) )
		{
			exception = "argument must be an endpoint address";
			return;
		}

		EndpointAddr_t handleId;
		if ( !endpointAddrFromJs( arguments[1], &handleId ) )
		{
			exception = "argument must be an endpoint address";
			return;
		}

		glm::mat4 universeFromHandle;
		if ( !mat4FromJavascript( arguments[2], &universeFromHandle ) )
		{
			exception = "argument must be a string";
			return;
		}

		m_collisions.addGrabbableHandle_Sphere(
			grabbableId,
			handleId,
			universeFromHandle,
			arguments[3]->GetDoubleValue(),
			(EHand )arguments[4]->GetIntValue()
			);
	} );

	RegisterFunction( container, "addGrabbableHandle_ModelBox", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 5 )
		{
			exception = "Invalid arguments";
			return;
		}

		EndpointAddr_t grabbableId;
		if ( !endpointAddrFromJs( arguments[0], &grabbableId ) )
		{
			exception = "argument must be an endpoint address";
			return;
		}

		EndpointAddr_t handleId;
		if ( !endpointAddrFromJs( arguments[1], &handleId ) )
		{
			exception = "argument must be an endpoint address";
			return;
		}

		glm::mat4 universeFromHandle;
		if ( !mat4FromJavascript( arguments[2], &universeFromHandle ) )
		{
			exception = "argument must be a string";
			return;
		}

		if ( !arguments[3]->IsString() )
		{
			exception = "argument must be a model URI";
			return;
		}

		AABB_t box;

		if ( !m_renderer->getModelBox( arguments[3]->GetStringValue(), &box ) )
		{
			// if we don't have a box for this model, it's either because we 
			// haven't loaded it yet or because the URL is invalid. Either way,
			// just don't add the handle
			return;
		}

		m_collisions.addGrabbableHandle_Box(
			grabbableId,
			handleId,
			universeFromHandle,
			box,
			(EHand)arguments[4]->GetIntValue()
		);
	} );

	RegisterFunction( container, "addGrabber_Sphere", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 4 )
		{
			exception = "Invalid arguments";
			return;
		}

		EndpointAddr_t grabberGlobalId;
		if ( !endpointAddrFromJs( arguments[0], &grabberGlobalId ) )
		{
			exception = "argument must be an endpoint address";
			return;
		}

		glm::mat4 universeFromHandle;
		if ( !mat4FromJavascript( arguments[1], &universeFromHandle ) )
		{
			exception = "second argument must be an array of 16 numbers";
			return;
		}

		if ( !arguments[2]->IsDouble() )
		{
			exception = "third argument must be a number";
		}
		if ( !arguments[3]->IsInt() )
		{
			exception = "fourth argument must be a number (and a hand enum)";
		}

		EHand hand = (EHand)arguments[3]->GetIntValue();

		m_collisions.addGrabber_Sphere(
			grabberGlobalId,
			universeFromHandle,
			arguments[2]->GetDoubleValue(),
			hand,
			m_vrManager->isGrabPressed( hand ) );
	} );

	RegisterFunction( container, "addHook_Sphere", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 4 )
		{
			exception = "Invalid arguments";
			return;
		}

		EndpointAddr_t hookGlobalId;
		if ( !endpointAddrFromJs( arguments[0], &hookGlobalId ) )
		{
			exception = "argument must be an endpoint address";
			return;
		}

		glm::mat4 universeFromHandle;
		if ( !mat4FromJavascript( arguments[1], &universeFromHandle ) )
		{
			exception = "second argument must be an array of 16 numbers";
			return;
		}

		if ( !arguments[2]->IsDouble() )
		{
			exception = "third argument must be a number";
		}
		if ( !arguments[3]->IsInt() )
		{
			exception = "fourth argument must be a number (and hand enum value)";
		}

		m_collisions.addHook_Sphere(
			hookGlobalId,
			universeFromHandle,
			arguments[2]->GetDoubleValue(),
			(EHand)arguments[3]->GetIntValue() );
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

	RegisterFunction( container, "getAABBForModel", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 1 )
		{
			exception = "Invalid arguments";
			return;
		}	

		if ( !arguments[0]->IsString() )
		{
			exception = "argument must be the url of a model";
			return;
		}

		AABB_t box;

		if ( !m_renderer->getModelBox( arguments[0]->GetStringValue(), &box ) )
		{
			retval = CefV8Value::CreateNull();
		}
		else
		{
			retval = CefV8Value::CreateObject( nullptr, nullptr );
			retval->SetValue( "xMin", CefV8Value::CreateDouble( box.xMin ), V8_PROPERTY_ATTRIBUTE_NONE );
			retval->SetValue( "xMax", CefV8Value::CreateDouble( box.xMax ), V8_PROPERTY_ATTRIBUTE_NONE );
			retval->SetValue( "yMin", CefV8Value::CreateDouble( box.yMin ), V8_PROPERTY_ATTRIBUTE_NONE );
			retval->SetValue( "yMax", CefV8Value::CreateDouble( box.yMax ), V8_PROPERTY_ATTRIBUTE_NONE );
			retval->SetValue( "zMin", CefV8Value::CreateDouble( box.zMin ), V8_PROPERTY_ATTRIBUTE_NONE );
			retval->SetValue( "zMax", CefV8Value::CreateDouble( box.zMax ), V8_PROPERTY_ATTRIBUTE_NONE );
		}
	} );

	RegisterFunction( container, "createModelInstance", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 1 )
		{
			exception = "Invalid arguments";
			return;
		}

		if ( !arguments[0]->IsString() )
		{
			exception = "argument must be a URI string";
			return;
		}

		std::string uri = arguments[0]->GetStringValue();
		auto modelInstance = m_renderer->createModelInstance( uri );
		if ( !modelInstance )
		{
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


	RegisterFunction( container, "addActivePanel", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 4 )
		{
			exception = "Invalid arguments";
			return;
		}

		EndpointAddr_t panelId;
		if ( !endpointAddrFromJs( arguments[0], &panelId ) )
		{
			exception = "argument must be the global panel ID";
			return;
		}

		glm::mat4 panelFromUniverse;
		if ( !mat4FromJavascript( arguments[1], &panelFromUniverse ) )
		{
			exception = "second argument must be an array of 16 numbers";
			return;
		}

		if ( !arguments[2]->IsDouble() )
		{
			exception = "third argument must be a number";
			return;
		}

		if ( !arguments[3]->IsDouble() )
		{
			exception = "fourth argument must be an int (and hand enum value)";
			return;
		}

		m_intersections.addActivePanel( panelId, panelFromUniverse, 
			arguments[2]->GetDoubleValue(), (EHand)arguments[3]->GetIntValue() );
	} );

	RegisterFunction( container, "addActivePoker", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 3 )
		{
			exception = "Invalid arguments";
			return;
		}

		EndpointAddr_t pokerId;
		if ( !endpointAddrFromJs( arguments[0], &pokerId ) )
		{
			exception = "argument must be the global poker ID";
			return;
		}


		if ( !arguments[1]->IsArray()
			|| arguments[1]->GetArrayLength() != 3
			|| !arguments[1]->GetValue( 0 )->IsDouble() )
		{
			exception = "second argument must be an array of 3 numbers";
			return;
		}
		if ( !arguments[2]->IsInt() )
		{
			exception = "third argument must be an int (and hand enum)";
			return;
		}

		glm::vec3 pokerInUniverse;
		pokerInUniverse.x = arguments[1]->GetValue( 0 )->GetDoubleValue();
		pokerInUniverse.y = arguments[1]->GetValue( 1 )->GetDoubleValue();
		pokerInUniverse.z = arguments[1]->GetValue( 2 )->GetDoubleValue();

		EHand hand = (EHand)arguments[2]->GetIntValue();
		m_intersections.addActivePoker( pokerId, pokerInUniverse, hand, m_vrManager->isGrabPressed( hand ) );
	} );


	RegisterFunction( container, "startGrab", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 2 )
		{
			exception = "Invalid arguments";
			return;
		}

		EndpointAddr_t grabberGlobalId;
		if ( !endpointAddrFromJs( arguments[0], &grabberGlobalId ) )
		{
			exception = "first argument must be an endpoint address";
			return;
		}

		EndpointAddr_t grabbableGlobalId;
		if ( !endpointAddrFromJs( arguments[1], &grabbableGlobalId ) )
		{
			exception = "second argument must be an endpoint address";
			return;
		}

		m_collisions.startGrab( grabberGlobalId, grabbableGlobalId );
	} );

	RegisterFunction( container, "endGrab", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 2 )
		{
			exception = "Invalid arguments";
			return;
		}

		EndpointAddr_t grabberGlobalId;
		if ( !endpointAddrFromJs( arguments[0], &grabberGlobalId ) )
		{
			exception = "first argument must be an endpoint address";
			return;
		}

		EndpointAddr_t grabbableGlobalId;
		if ( !endpointAddrFromJs( arguments[1], &grabbableGlobalId ) )
		{
			exception = "second argument must be an endpoint address";
			return;
		}

		m_collisions.endGrab( grabberGlobalId, grabbableGlobalId );
	} );


	RegisterFunction( container, "isEditPressed", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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

		EHand hand = (EHand)arguments[ 0 ]->GetIntValue();
		retval = CefV8Value::CreateBool( m_vrManager->isEditPressed( hand ) );
	} );


	return true;
}

CJavascriptRenderer::~CJavascriptRenderer() noexcept
{
	m_renderer = nullptr;
}


