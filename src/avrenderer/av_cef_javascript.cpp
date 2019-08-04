#pragma once

#include "av_cef_javascript.h"

#include <aardvark/aardvark_client.h>
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

using aardvark::AvSceneContext;
using aardvark::EAvSceneGraphResult;
using aardvark::EAvSceneGraphNodeType;

void protoEventFromCefEvent( CefRefPtr<CefV8Value> cefEvent, AvGrabEvent::Builder &bldEvent )
{
	aardvark::EGrabEventType apiType = ( aardvark::EGrabEventType )cefEvent->GetValue( "type" )->GetIntValue();
	bldEvent.setType( protoTypeFromGrabType( apiType ) );
	if ( cefEvent->HasValue( "grabbableId" ) && cefEvent->GetValue( "grabbableId" )->IsString() )
	{
		uint64_t grabbableId = std::wcstoull( cefEvent->GetValue( "grabbableId" )->GetStringValue().c_str(),
			nullptr, 0 );
		bldEvent.setGrabbableId( grabbableId );
	}
	if ( cefEvent->HasValue( "grabberId" ) && cefEvent->GetValue( "grabberId" )->IsString() )
	{
		uint64_t grabberId = std::wcstoull( cefEvent->GetValue( "grabberId" )->GetStringValue().c_str(),
			nullptr, 0 );
		bldEvent.setGrabberId( grabberId );
	}
	if ( cefEvent->HasValue( "hookId" ) && cefEvent->GetValue( "hookId" )->IsString() )
	{
		uint64_t hookId = std::wcstoull( cefEvent->GetValue( "hookId" )->GetStringValue().c_str(),
			nullptr, 0 );
		bldEvent.setHookId( hookId );
	}
	if ( cefEvent->HasValue( "requestId" ) && cefEvent->GetValue( "requestId" )->IsUInt() )
	{
		bldEvent.setRequestId( cefEvent->GetValue( "requestId" )->GetUIntValue() );
	}
	if ( cefEvent->HasValue( "allowed" ) && cefEvent->GetValue( "allowed" )->IsBool() )
	{
		bldEvent.setAllowed( cefEvent->GetValue( "allowed" )->GetBoolValue() );
	}
	if ( cefEvent->HasValue( "useIdentityTransform" ) && cefEvent->GetValue( "useIdentityTransform" )->IsBool() )
	{
		bldEvent.setUseIdentityTransform( cefEvent->GetValue( "useIdentityTransform" )->GetBoolValue() );
	}
}


class CAardvarkGadgetObject : public CJavascriptObjectWithFunctions
{
	friend class CSceneContextObject;
public:
	CAardvarkGadgetObject( CAardvarkRenderProcessHandler *pRenderProcessHandler, 
		AvGadget::Client client, const std::string & name, uint32_t gadgetId );
	virtual ~CAardvarkGadgetObject() noexcept;

	virtual bool init( CefRefPtr<CefV8Value > container ) override;

	aardvark::EAvSceneGraphResult  finishSceneContext( CSceneContextObject *contextObject );
	const std::string & getName() const { return m_name; }
	uint32_t getId() const { return m_gadgetId; }
	void runFrame();

private:
	AvGadget::Client m_gadgetClient;
	CAardvarkRenderProcessHandler *m_handler = nullptr;
	std::string m_name;
	uint32_t m_gadgetId;
	std::list<JsObjectPtr<CSceneContextObject>> m_sceneContexts;
	std::set<uint32_t> m_nodeIdsThatNeedThisTexture;
	std::unordered_map< uint32_t, CefRefPtr< CefV8Value > > m_pokerProcessors;
	std::unordered_map< uint32_t, CefRefPtr< CefV8Value > > m_panelProcessors;
	std::unordered_map< uint32_t, CefRefPtr< CefV8Value > > m_grabberProcessors;
	std::unordered_map< uint32_t, CefRefPtr< CefV8Value > > m_grabbableProcessors;
	std::set< uint32_t > m_defaultPanels;
};


class CSceneContextObject : public CJavascriptObjectWithFunctions
{
public:
	CSceneContextObject( CAardvarkGadgetObject *parentGadget, CAardvarkRenderProcessHandler *pRenderProcessHandler, aardvark::AvSceneContext context );

	virtual bool init( CefRefPtr<CefV8Value > container ) override;
	AvSceneContext getContext() { return m_context; }

	uint32_t getCurrentNodeId();
	std::vector<uint32_t> getNodeIdsThatWillNeedThisTexture() { return m_nodeIdsThatWillNeedThisTexture;  }
private:
	aardvark::AvSceneContext m_context;
	CAardvarkRenderProcessHandler *m_handler = nullptr;
	CAardvarkGadgetObject *m_parentGadget = nullptr;
	std::vector<uint32_t> m_nodeIdsThatWillNeedThisTexture;
	std::vector<uint32_t> m_nodeIdStack;
};

CSceneContextObject::CSceneContextObject( CAardvarkGadgetObject *parentGadget, CAardvarkRenderProcessHandler *renderProcessHandler, aardvark::AvSceneContext context )
{
	m_handler = renderProcessHandler;
	m_context = context;
	m_parentGadget = parentGadget;
}


uint32_t CSceneContextObject::getCurrentNodeId()
{
	if ( m_nodeIdStack.empty() )
	{
		return 0;
	}
	else
	{
		return m_nodeIdStack.back();
	}
}


bool CSceneContextObject::init( CefRefPtr<CefV8Value> container )
{
	RegisterFunction( container, "finish", [this, parentGadget = m_parentGadget]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 0 )
		{
			exception = "Invalid arguments";
			return;
		}

		aardvark::EAvSceneGraphResult result = parentGadget->finishSceneContext( this );
		if ( result != aardvark::EAvSceneGraphResult::Success )
		{
			exception = "avFinishSceneContext failed " + std::to_string( (int)result );
		}
	} );

	RegisterFunction( container, "startNode", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 3 )
		{
			exception = "Invalid argument count";
			return;
		}
		if ( !arguments[0]->IsUInt() || !( arguments[1]->IsString() || arguments[1]->IsNull() ) || !arguments[2]->IsInt() )
		{
			exception = "Invalid arguments";
			return;
		}

		std::string name;
		if ( arguments[1]->IsString() )
		{
			name = arguments[1]->GetStringValue();
		}

		EAvSceneGraphNodeType eType = (EAvSceneGraphNodeType)arguments[2]->GetIntValue();

		uint32_t nodeId = arguments[0]->GetUIntValue();
		EAvSceneGraphResult res = aardvark::avStartNode( m_context, nodeId, name.empty() ? nullptr : name.c_str(), eType );
		if ( res != EAvSceneGraphResult::Success )
		{
			exception = "avStartNode failed " + std::to_string( (int)res );
		}
		else
		{
			m_nodeIdStack.push_back( nodeId );
		}
	} );

	RegisterFunction( container, "startCustomNode", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 3 )
		{
			exception = "Invalid argument count";
			return;
		}
		if ( !arguments[0]->IsUInt() || !( arguments[1]->IsString() || arguments[1]->IsNull() ) || !arguments[2]->IsString() )
		{
			exception = "Invalid arguments";
			return;
		}

		std::string name;
		if ( arguments[1]->IsString() )
		{
			name = arguments[1]->GetStringValue();
		}

		std::string customNodeType = arguments[2]->GetStringValue();

		uint32_t nodeId = arguments[0]->GetUIntValue();
		EAvSceneGraphResult res = aardvark::avStartNode( m_context, nodeId, name.empty() ? nullptr : name.c_str(), EAvSceneGraphNodeType::Custom );
		if ( res == EAvSceneGraphResult::Success )
		{
			res = aardvark::avSetCustomNodeType( m_context, customNodeType.c_str() );
		}

		if ( res != EAvSceneGraphResult::Success )
		{
			exception = "avStartNode failed " + std::to_string( (int)res );
		}
		else
		{
			m_nodeIdStack.push_back( nodeId );
		}
	} );

	CefRefPtr<CefV8Value> typeEnum = CefV8Value::CreateObject(nullptr, nullptr);
	typeEnum->SetValue( "Container",	CefV8Value::CreateInt( (int32_t)EAvSceneGraphNodeType::Container ),	V8_PROPERTY_ATTRIBUTE_READONLY );
	typeEnum->SetValue( "Origin",		CefV8Value::CreateInt( (int32_t)EAvSceneGraphNodeType::Origin ),		V8_PROPERTY_ATTRIBUTE_READONLY );
	typeEnum->SetValue( "Transform",	CefV8Value::CreateInt( (int32_t)EAvSceneGraphNodeType::Transform ),	V8_PROPERTY_ATTRIBUTE_READONLY );
	typeEnum->SetValue( "Model",		CefV8Value::CreateInt( (int32_t)EAvSceneGraphNodeType::Model ),		V8_PROPERTY_ATTRIBUTE_READONLY );
	typeEnum->SetValue( "Panel",		CefV8Value::CreateInt( (int32_t)EAvSceneGraphNodeType::Panel ), V8_PROPERTY_ATTRIBUTE_READONLY );
	typeEnum->SetValue( "Poker",		CefV8Value::CreateInt( (int32_t)EAvSceneGraphNodeType::Poker ), V8_PROPERTY_ATTRIBUTE_READONLY );
	typeEnum->SetValue( "Grabbable", CefV8Value::CreateInt( (int32_t)EAvSceneGraphNodeType::Grabbable), V8_PROPERTY_ATTRIBUTE_READONLY );
	typeEnum->SetValue( "Handle", CefV8Value::CreateInt( (int32_t)EAvSceneGraphNodeType::Handle ), V8_PROPERTY_ATTRIBUTE_READONLY );
	typeEnum->SetValue( "Grabber", CefV8Value::CreateInt( (int32_t)EAvSceneGraphNodeType::Grabber ), V8_PROPERTY_ATTRIBUTE_READONLY );
	typeEnum->SetValue( "Custom", CefV8Value::CreateInt( (int32_t)EAvSceneGraphNodeType::Custom ), V8_PROPERTY_ATTRIBUTE_READONLY );
	container->SetValue( "type", typeEnum, V8_PROPERTY_ATTRIBUTE_READONLY );

	RegisterFunction( container, "finishNode", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 0 )
		{
			exception = "Invalid argument count";
			return;
		}

		EAvSceneGraphResult res = aardvark::avFinishNode( m_context );
		if ( res != EAvSceneGraphResult::Success )
		{
			exception = "avFinishNode failed";
		}
		else
		{
			if ( !m_nodeIdStack.empty() )
			{
				m_nodeIdStack.pop_back();
			}
		}
	} );

	RegisterFunction( container, "setOriginPath", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 1 )
		{
			exception = "Invalid argument count";
			return;
		}
		if ( !arguments[0]->IsString() )
		{
			exception = "Invalid arguments";
			return;
		}

		EAvSceneGraphResult res = aardvark::avSetOriginPath( m_context, std::string( arguments[0]->GetStringValue() ).c_str() );
		if ( res != EAvSceneGraphResult::Success )
		{
			exception = "avSetOriginPath failed " + std::to_string( (int)res );
		}
	} );

	RegisterFunction( container, "setTranslation", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 3 )
		{
			exception = "Invalid argument count";
			return;
		}
		if ( !arguments[0]->IsDouble() || !arguments[1]->IsDouble() || !arguments[2]->IsDouble() )
		{
			exception = "Invalid arguments";
			return;
		}

		EAvSceneGraphResult res = aardvark::avSetTranslation( m_context, 
			(float)arguments[0]->GetDoubleValue(),
			(float)arguments[1]->GetDoubleValue(),
			(float)arguments[2]->GetDoubleValue() );
		if ( res != EAvSceneGraphResult::Success )
		{
			exception = "avSetTranslation failed " + std::to_string( (int)res );
		}
	} );

	RegisterFunction( container, "setScale", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 3 )
		{
			exception = "Invalid argument count";
			return;
		}
		if ( !arguments[0]->IsDouble() || !arguments[1]->IsDouble() || !arguments[2]->IsDouble() )
		{
			exception = "Invalid arguments";
			return;
		}

		EAvSceneGraphResult res = aardvark::avSetScale( m_context,
			(float)arguments[0]->GetDoubleValue(),
			(float)arguments[1]->GetDoubleValue(),
			(float)arguments[2]->GetDoubleValue() );
		if ( res != EAvSceneGraphResult::Success )
		{
			exception = "avSetScale failed " + std::to_string( (int)res );
		}
	} );

	RegisterFunction( container, "setUniformScale", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 1 )
		{
			exception = "Invalid argument count";
			return;
		}
		if ( !arguments[0]->IsDouble() )
		{
			exception = "Invalid arguments";
			return;
		}

		EAvSceneGraphResult res = aardvark::avSetScale( m_context,
			(float)arguments[0]->GetDoubleValue(),
			(float)arguments[0]->GetDoubleValue(),
			(float)arguments[0]->GetDoubleValue() );
		if ( res != EAvSceneGraphResult::Success )
		{
			exception = "avSetScale failed " + std::to_string( (int)res );
		}
	} );

	RegisterFunction( container, "setRotationEulerDegrees", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 3 )
		{
			exception = "Invalid argument count";
			return;
		}
		if ( !arguments[0]->IsDouble() || !arguments[1]->IsDouble() || !arguments[2]->IsDouble() )
		{
			exception = "Invalid arguments";
			return;
		}

		double fYawRadians = ( arguments[0]->GetDoubleValue() * M_PI / 180.0 );
		double fPitchRadians =( arguments[1]->GetDoubleValue() * M_PI / 180.0 );
		double fRollRadians = ( arguments[2]->GetDoubleValue() * M_PI / 180.0 );

		glm::quat rot = glm::quat( glm::vec3( fPitchRadians, fYawRadians, fRollRadians ) );

		EAvSceneGraphResult res = aardvark::avSetRotation( m_context,
			(float)rot.x,
			(float)rot.y,
			(float)rot.z,
			(float)rot.w );
		if ( res != EAvSceneGraphResult::Success )
		{
			exception = "avSetRotation failed " + std::to_string( (int)res );
		}
	} );

	RegisterFunction( container, "setModelUri", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 1 )
		{
			exception = "Invalid argument count";
			return;
		}
		if ( !arguments[0]->IsString() )
		{
			exception = "Invalid arguments";
			return;
		}

		EAvSceneGraphResult res = aardvark::avSetModelUri( m_context, std::string( arguments[0]->GetStringValue() ).c_str() );
		if ( res != EAvSceneGraphResult::Success )
		{
			exception = "avSetModelUri failed " + std::to_string( (int)res );
		}
	} );

	RegisterFunction( container, "setTextureSource", [this, handler = m_handler ]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 1 )
		{
			exception = "Invalid argument count";
			return;
		}
		if ( !arguments[0]->IsString() )
		{
			exception = "Invalid arguments";
			return;
		}

		EAvSceneGraphResult res = aardvark::avSetPanelTextureSource( m_context, std::string( arguments[0]->GetStringValue() ).c_str() );
		if ( res != EAvSceneGraphResult::Success )
		{
			exception = "avSetPanelTextureSource failed " + std::to_string( (int)res );
		}
	} );

	RegisterFunction( container, "setInteractive", [this, handler = m_handler ]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 1 )
		{
			exception = "Invalid argument count";
			return;
		}
		if ( !arguments[0]->IsBool() )
		{
			exception = "Invalid arguments";
			return;
		}

		EAvSceneGraphResult res = aardvark::avSetPanelInteractive( m_context, arguments[0]->GetBoolValue() );
		if ( res != EAvSceneGraphResult::Success )
		{
			exception = "avSetPanelInteractive failed " + std::to_string( (int)res );
		}
	} );

	RegisterFunction( container, "setSphereVolume", [this, handler = m_handler]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 1 )
		{
			exception = "Invalid argument count";
			return;
		}
		if ( !arguments[0]->IsDouble() )
		{
			exception = "Invalid arguments";
			return;
		}

		EAvSceneGraphResult res = aardvark::avSetSphereVolume( m_context, (float)arguments[0]->GetDoubleValue() );
		if ( res != EAvSceneGraphResult::Success )
		{
			exception = "avSetSphereVolume failed " + std::to_string( (int)res );
		}
	} );

	return true;
}


CAardvarkGadgetObject::CAardvarkGadgetObject( CAardvarkRenderProcessHandler *renderProcessHandler, AvGadget::Client client, const std::string & name, uint32_t gadgetId )
	: m_gadgetClient( client )
{
	m_handler = renderProcessHandler;
	m_name = name;
	m_gadgetId = gadgetId;
}


bool CAardvarkGadgetObject::init( CefRefPtr<CefV8Value> container )
{
	RegisterFunction( container, "getName", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 0 )
		{
			exception = "Invalid arguments";
			return;
		}

		auto resName= m_gadgetClient.nameRequest().send().wait( m_handler->getClient()->WaitScope() );
		if( resName.hasName() )
		{
			retval = CefV8Value::CreateString( resName.getName().cStr() );
		}
		else
		{
			retval = CefV8Value::CreateNull();
		}
	} );

	RegisterFunction( container, "startSceneContext", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 0 )
		{
			exception = "Invalid arguments";
			return;
		}

		AvSceneContext context;
		if ( aardvark::EAvSceneGraphResult::Success != aardvark::avStartSceneContext( m_handler->getClient(), &context ) )
		{
			exception = "Failed to start context";
			return;
		}

		auto newContext = CJavascriptObjectWithFunctions::create<CSceneContextObject>( this, m_handler, context );
		retval = newContext.object;

		m_sceneContexts.push_back( std::move( newContext ) );

	} );

	RegisterFunction( container, "registerPokerHandler", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 2 )
		{
			exception = "Invalid arguments";
			return;
		}

		if ( !arguments[0]->IsUInt() )
		{
			exception = "first argument must be a poker node ID";
			return;
		}

		if ( !arguments[1]->IsFunction() )
		{
			exception = "second argument must be a function";
			return;
		}

		m_pokerProcessors.insert_or_assign( arguments[0]->GetUIntValue(), arguments[1] );
	} );

	RegisterFunction( container, "registerPanelHandler", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 2 )
		{
			exception = "Invalid arguments";
			return;
		}

		if ( !arguments[0]->IsUInt() )
		{
			exception = "first argument must be a panel node ID";
			return;
		}

		if ( !arguments[1]->IsFunction() )
		{
			exception = "second argument must be a function";
			return;
		}

		m_panelProcessors.insert_or_assign( arguments[0]->GetUIntValue(), arguments[1] );
	} );

	RegisterFunction( container, "registerGrabberProcessor", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 2 )
		{
			exception = "Invalid arguments";
			return;
		}

		if ( !arguments[0]->IsUInt() )
		{
			exception = "first argument must be a grabber node ID";
			return;
		}

		if ( !arguments[1]->IsFunction() )
		{
			exception = "second argument must be a function";
			return;
		}

		m_grabberProcessors.insert_or_assign( arguments[0]->GetUIntValue(), arguments[1] );
	} );

	RegisterFunction( container, "registerGrabbableProcessor", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 2 )
		{
			exception = "Invalid arguments";
			return;
		}

		if ( !arguments[0]->IsUInt() )
		{
			exception = "first argument must be a grabbable node ID";
			return;
		}

		if ( !arguments[1]->IsFunction() )
		{
			exception = "second argument must be a function";
			return;
		}

		m_grabbableProcessors.insert_or_assign( arguments[0]->GetUIntValue(), arguments[1] );
	} );

	RegisterFunction( container, "enableDefaultPanelHandling", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 1 )
		{
			exception = "Invalid arguments";
			return;
		}

		if ( !arguments[0]->IsUInt() )
		{
			exception = "argument must be a panel node ID";
			return;
		}

		m_defaultPanels.insert( arguments[0]->GetUIntValue() );
	} );

	RegisterFunction( container, "sendMouseEvent", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 5 )
		{
			exception = "Invalid arguments";
			return;
		}

		if ( !arguments[0]->IsUInt() )
		{
			exception = "first argument must be a poker node ID";
			return;
		}

		if ( !arguments[1]->IsString() )
		{
			exception = "second argument must be a panelID as a string";
			return;
		}

		if ( !arguments[2]->IsInt() )
		{
			exception = "third argument must be an event type";
			return;
		}

		if ( !arguments[3]->IsDouble() || !arguments[4]->IsDouble() )
		{
			exception = "Fourth and fifth arguments must be coords";
			return;
		}

		aardvark::avPushMouseEventFromPoker( m_handler->getClient(), &m_gadgetClient,
			arguments[0]->GetUIntValue(),
			std::stoull( std::string( arguments[1]->GetStringValue() ).c_str() ),
			( aardvark::EPanelMouseEventType )arguments[2]->GetIntValue(),
			(float)arguments[3]->GetDoubleValue(), (float)arguments[4]->GetDoubleValue() );
	} );

	RegisterFunction( container, "sendHapticEventFromPanel", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 4 )
		{
			exception = "Invalid arguments";
			return;
		}

		if ( !arguments[0]->IsUInt() )
		{
			exception = "first argument must be a panel node ID";
			return;
		}

		if ( !arguments[1]->IsDouble() )
		{
			exception = "second argument must be a number between 0 and 1 representing amplitude";
			return;
		}

		if ( !arguments[2]->IsDouble() )
		{
			exception = "third argument must be a frequency number in Hz";
			return;
		}

		if ( !arguments[3]->IsDouble()  )
		{
			exception = "fourth number must be a duration in seconds";
			return;
		}

		aardvark::EAvSceneGraphResult result = aardvark::avSendHapticEventFromPanel( m_handler->getClient(), &m_gadgetClient,
			arguments[0]->GetUIntValue(),
			(float)arguments[1]->GetDoubleValue(),
			(float)arguments[2]->GetDoubleValue(),
			(float)arguments[3]->GetDoubleValue() );
		if ( result != aardvark::EAvSceneGraphResult::Success )
		{
			exception = "Error returned by avSendHapticEventFromPanel: " + std::to_string( (int)result );
		}
	} );

	RegisterFunction( container, "sendGrabEvent", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 1 || !arguments[0]->IsObject() )
		{
			exception = "Invalid arguments";
			return;
		}


		auto reqPushEvent = m_gadgetClient.pushGrabEventRequest();
		AvGrabEvent::Builder bldEvent = reqPushEvent.initEvent();
		CefRefPtr< CefV8Value > cefEvent = arguments[0];
		if ( cefEvent->HasValue( "senderId" ) )
		{
			reqPushEvent.setGrabberNodeId( cefEvent->GetValue( "senderId" )->GetUIntValue() );
		}
		protoEventFromCefEvent( cefEvent, bldEvent );

		m_handler->getClient()->addRequestToTasks( std::move( reqPushEvent ) );
	} );

	return true;
}

CAardvarkGadgetObject::~CAardvarkGadgetObject() noexcept
{
	m_sceneContexts.clear();

	m_gadgetClient = nullptr;
}

CefRefPtr<CefV8Value> grabEventToCefEvent( const aardvark::GrabEvent_t & grabEvent )
{
	CefRefPtr< CefV8Value > evt = CefV8Value::CreateObject( nullptr, nullptr );
	evt->SetValue( CefString( "grabberId" ),
		CefV8Value::CreateString( std::to_string( grabEvent.grabberId ) ),
		V8_PROPERTY_ATTRIBUTE_NONE );
	evt->SetValue( CefString( "grabbableId" ),
		CefV8Value::CreateString( std::to_string( grabEvent.grabbableId ) ),
		V8_PROPERTY_ATTRIBUTE_NONE );
	evt->SetValue( CefString( "hookId" ),
		CefV8Value::CreateString( std::to_string( grabEvent.hookId ) ),
		V8_PROPERTY_ATTRIBUTE_NONE );
	evt->SetValue( CefString( "requestId" ),
		CefV8Value::CreateUInt( grabEvent.requestId ),
		V8_PROPERTY_ATTRIBUTE_NONE );
	evt->SetValue( CefString( "allowed" ),
		CefV8Value::CreateBool( grabEvent.allowed ),
		V8_PROPERTY_ATTRIBUTE_NONE );
	evt->SetValue( CefString( "useIdentityTransform" ),
		CefV8Value::CreateBool( grabEvent.useIdentityTransform ),
		V8_PROPERTY_ATTRIBUTE_NONE );
	evt->SetValue( CefString( "type" ),
		CefV8Value::CreateInt( (int)grabEvent.type ),
		V8_PROPERTY_ATTRIBUTE_NONE );
	return evt;
}

void CAardvarkGadgetObject::runFrame()
{
	for( auto iHandler : m_pokerProcessors )
	{
		aardvark::PokerProximity_t pokerProximity[100];
		uint32_t usedCount;
		aardvark::EAvSceneGraphResult result = aardvark::avGetNextPokerProximity( 
			m_handler->getClient(), iHandler.first, pokerProximity, 100, &usedCount );
		assert( result != EAvSceneGraphResult::InsufficientBufferSize );
		if ( result == EAvSceneGraphResult::Success )
		{
			CefRefPtr< CefV8Value > list = CefV8Value::CreateArray( (int)usedCount );
			for ( uint32_t n = 0; n < usedCount; n++ )
			{
				CefRefPtr< CefV8Value > prox = CefV8Value::CreateObject( nullptr, nullptr );
				prox->SetValue( CefString( "panelId" ),
					CefV8Value::CreateString( std::to_string( pokerProximity[n].panelId ) ), 
					V8_PROPERTY_ATTRIBUTE_NONE );
				prox->SetValue( CefString( "x" ),
					CefV8Value::CreateDouble( pokerProximity[n].x ),
					V8_PROPERTY_ATTRIBUTE_NONE );
				prox->SetValue( CefString( "y" ),
					CefV8Value::CreateDouble( pokerProximity[n].y ),
					V8_PROPERTY_ATTRIBUTE_NONE );
				prox->SetValue( CefString( "distance" ),
					CefV8Value::CreateDouble( pokerProximity[n].distance ),
					V8_PROPERTY_ATTRIBUTE_NONE );

				list->SetValue( n, prox );
			}

			iHandler.second->ExecuteFunction( nullptr, CefV8ValueList{ list } );
		}
	}

	for ( auto iHandler : m_panelProcessors )
	{
		aardvark::PanelMouseEvent_t panelMouseEvent;
		uint32_t unLimit = 0;
		while ( ++unLimit < 100 && EAvSceneGraphResult::Success == aardvark::avGetNextMouseEvent(
			m_handler->getClient(), iHandler.first, &panelMouseEvent ) )
		{
			CefRefPtr< CefV8Value > evt = CefV8Value::CreateObject( nullptr, nullptr );
			evt->SetValue( CefString( "panelId" ),
				CefV8Value::CreateString( std::to_string( panelMouseEvent.panelId ) ),
				V8_PROPERTY_ATTRIBUTE_NONE );
			evt->SetValue( CefString( "pokerId" ),
				CefV8Value::CreateString( std::to_string( panelMouseEvent.pokerId ) ),
				V8_PROPERTY_ATTRIBUTE_NONE );
			evt->SetValue( CefString( "x" ),
				CefV8Value::CreateDouble( panelMouseEvent.x ),
				V8_PROPERTY_ATTRIBUTE_NONE );
			evt->SetValue( CefString( "y" ),
				CefV8Value::CreateDouble( panelMouseEvent.y ),
				V8_PROPERTY_ATTRIBUTE_NONE );
			evt->SetValue( CefString( "type" ),
				CefV8Value::CreateInt( (int)panelMouseEvent.type ),
				V8_PROPERTY_ATTRIBUTE_NONE );

			iHandler.second->ExecuteFunction( nullptr, CefV8ValueList{ evt } );
		}
	}

	for ( uint32_t panelId : m_defaultPanels )
	{
		aardvark::PanelMouseEvent_t panelMouseEvent;
		uint32_t unLimit = 0;
		while ( ++unLimit < 100 && EAvSceneGraphResult::Success == aardvark::avGetNextMouseEvent(
			m_handler->getClient(), panelId, &panelMouseEvent ) )
		{
			CefRefPtr<CefProcessMessage> msg = CefProcessMessage::Create( "mouse_event" );
			msg->GetArgumentList()->SetInt( 0, (int)panelMouseEvent.type );
			msg->GetArgumentList()->SetDouble( 1, panelMouseEvent.x );
			msg->GetArgumentList()->SetDouble( 2, panelMouseEvent.y );

			m_handler->sendBrowserMessage( msg );
		}
	}

	for ( auto iHandler : m_grabberProcessors )
	{
		uint64_t grabbableIntersections[100];
		uint64_t hookIntersections[100];
		bool isGrabberPressed = false;
		uint32_t usedCount;
		uint32_t usedHookCount;
		aardvark::EAvSceneGraphResult result = aardvark::avGetNextGrabberIntersection(
			m_handler->getClient(), iHandler.first, &isGrabberPressed, grabbableIntersections, 100, &usedCount,
			hookIntersections, 100, &usedHookCount );
		assert( result != EAvSceneGraphResult::InsufficientBufferSize );
		if ( result == EAvSceneGraphResult::Success )
		{
			CefRefPtr< CefV8Value > list = CefV8Value::CreateArray( (int)usedCount );
			for ( uint32_t n = 0; n < usedCount; n++ )
			{
				list->SetValue( n, CefV8Value::CreateString( std::to_string( grabbableIntersections[ n ] ) ) );
			}

			CefRefPtr< CefV8Value > hookList = CefV8Value::CreateArray( (int)usedHookCount );
			for ( uint32_t n = 0; n < usedHookCount; n++ )
			{
				hookList->SetValue( n, CefV8Value::CreateString( std::to_string( hookIntersections[n] ) ) );
			}

			iHandler.second->ExecuteFunction( nullptr, 
				CefV8ValueList{ CefV8Value::CreateBool( isGrabberPressed ), list, hookList } );
		}
	}

	for ( auto iHandler : m_grabbableProcessors )
	{
		aardvark::GrabEvent_t grabEvent;
		uint32_t unLimit = 0;
		while ( ++unLimit < 100 && EAvSceneGraphResult::Success == aardvark::avGetNextGrabEvent(
			m_handler->getClient(), iHandler.first, &grabEvent) )
		{
			CefRefPtr< CefV8Value > evt = grabEventToCefEvent( grabEvent );
			iHandler.second->ExecuteFunction( nullptr, CefV8ValueList{ evt } );
		}
	}
}



aardvark::EAvSceneGraphResult CAardvarkGadgetObject::finishSceneContext( CSceneContextObject *contextObject )
{
	uint64_t mainGrabbableId = 0;
	aardvark::EAvSceneGraphResult res = avFinishSceneContext( contextObject->getContext(), &m_gadgetClient, &mainGrabbableId );
	if ( res != EAvSceneGraphResult::Success )
	{
		return res;
	}

	for ( auto iEntry = m_sceneContexts.begin(); iEntry != m_sceneContexts.end(); iEntry++ )
	{
		if ( iEntry->impl == contextObject )
		{
			m_sceneContexts.erase( iEntry );
			break;
		}
	}

	m_handler->sceneFinished( mainGrabbableId );
	return res;
}



class CAardvarkObject : public CJavascriptObjectWithFunctions
{
public:
	CAardvarkObject( CAardvarkRenderProcessHandler *pRenderProcessHandler );
	virtual ~CAardvarkObject();

	virtual bool init( CefRefPtr<CefV8Value> container ) override;
	std::list<JsObjectPtr<CAardvarkGadgetObject>> & getGadgets() { return m_gadgets;  }

	bool hasPermission( const std::string & permission );
	void runFrame();

private:
	CAardvarkRenderProcessHandler *m_handler = nullptr;
	std::list<JsObjectPtr<CAardvarkGadgetObject>> m_gadgets;
	JsObjectPtr< CJavascriptRenderer > m_renderer;
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
	for ( auto & gadget : m_gadgets )
	{
		gadget->runFrame();
	}

	if ( m_renderer )
	{
		m_renderer->runFrame();
	}
}


bool CAardvarkObject::init( CefRefPtr<CefV8Value> container )
{
	if ( hasPermission( "scenegraph" ) )
	{
		RegisterFunction( container, "createGadget", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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

			auto reqCreateGadget = m_handler->getClient()->Server().createGadgetRequest();
			reqCreateGadget.setName( std::string( arguments[0]->GetStringValue() ).c_str() );
			reqCreateGadget.setInitialHook( m_handler->getInitialHook() );
			auto resCreateGadget = reqCreateGadget.send().wait( m_handler->getClient()->WaitScope() );
			if ( !resCreateGadget.hasGadget() )
			{
				retval = CefV8Value::CreateNull();
			}
			else
			{
				auto gadget = CJavascriptObjectWithFunctions::create<CAardvarkGadgetObject>( m_handler, resCreateGadget.getGadget(), std::string( arguments[0]->GetStringValue() ), resCreateGadget.getGadgetId() );
				retval = gadget.object;
				m_gadgets.push_back( std::move( gadget ) );
				m_handler->updateGadgetNamesForBrowser();
			}
		} );
	}

	if ( hasPermission( "master" ) )
	{
		RegisterFunction( container, "startGadget", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
		{
			if ( arguments.size() != 3 )
			{
				exception = "Invalid arguments";
				return;
			}
			if ( !arguments[0]->IsString() )
			{
				exception = "Invalid url argument";
				return;
			}
			if ( !arguments[1]->IsString() )
			{
				exception = "Invalid hook argument";
				return;
			}
			if ( !arguments[2]->IsFunction() && !arguments[2]->IsNull() )
			{
				exception = "Invalid callback argument";
				return;
			}

			m_handler->requestStartGadget( arguments[0]->GetStringValue(), arguments[1]->GetStringValue(), arguments[2] );
		} );
	}

	if ( hasPermission( "renderer" ) )
	{
		m_renderer = CJavascriptObjectWithFunctions::create<CJavascriptRenderer>( m_handler );
		container->SetValue( "renderer", m_renderer.object, V8_PROPERTY_ATTRIBUTE_READONLY );

		RegisterFunction( container, "sendGrabEvent", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
		{
			if ( arguments.size() != 1 || !arguments[0]->IsObject() )
			{
				exception = "Invalid arguments";
				return;
			}

			aardvark::EGrabEventType apiType = ( aardvark::EGrabEventType )arguments[0]->GetValue( "type" )->GetIntValue();

			auto reqPushEvent = m_handler->getClient()->Server().pushGrabEventRequest();
			protoEventFromCefEvent( arguments[0], reqPushEvent.initEvent() );
			m_handler->getClient()->addRequestToTasks( std::move( reqPushEvent ) );
		} );
	}

	return true;

}

CAardvarkObject::~CAardvarkObject()
{
	m_gadgets.clear();
	m_renderer = nullptr;
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
	if ( m_contexts.empty() )
	{
		if ( m_clientNeedsReset )
		{
			m_client->Stop();
			m_clientNeedsReset = false;
		}

		// first time setup tasks
		CefPostDelayedTask( TID_RENDERER, base::Bind( &CAardvarkRenderProcessHandler::runFrame, this ), 0 );
		m_client->Start();
	}


	PerContextInfo_t info;
	info.browser = browser;
	info.frame = frame;
	info.context = context;
	
	// Retrieve the context's window object.
	CefRefPtr<CefV8Value> windowObj = context->GetGlobal();

	// Create an object to store our functions in
	info.aardvarkObject = CJavascriptObjectWithFunctions::create< CAardvarkObject>( this );
	windowObj->SetValue( "aardvark", info.aardvarkObject.object, V8_PROPERTY_ATTRIBUTE_READONLY );

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

	if ( m_contexts.empty() )
	{
		m_clientNeedsReset = true;
	}
}

void CAardvarkRenderProcessHandler::OnBrowserDestroyed( CefRefPtr<CefBrowser> browser )
{
	if ( m_clientNeedsReset )
	{
		m_client->Stop();
		m_clientNeedsReset = false;
	}
}


bool CAardvarkRenderProcessHandler::OnProcessMessageReceived( CefRefPtr<CefBrowser> browser,
	CefProcessId source_process,
	CefRefPtr<CefProcessMessage> message )
{
	std::string messageName = message->GetName();

	if ( messageName == "gadget_info" )
	{
		m_gadgetUri = message->GetArgumentList()->GetString( 0 );
		m_initialHook = message->GetArgumentList()->GetString( 1 );

		try
		{
			std::string manifestData = message->GetArgumentList()->GetString( 2 );
			nlohmann::json j = nlohmann::json::parse( manifestData.begin(), manifestData.end() );
			m_gadgetManifest = j.get<CAardvarkGadgetManifest>();
		}
		catch ( nlohmann::json::exception & )
		{
			// manifest parse failed
			assert( false );
			return false;
		}
	}
	else if ( messageName == "gadget_started" )
	{
		int gadgetStartRequestId = message->GetArgumentList()->GetInt( 0 );
		auto callback = m_startGadgetCallbacks.find( gadgetStartRequestId );
		if ( callback != m_startGadgetCallbacks.end() )
		{
			bool success = message->GetArgumentList()->GetBool( 1 );
			CefString mainGrabbableId = message->GetArgumentList()->GetString( 2 );

			callback->second.context->Enter();
			callback->second.callback->ExecuteFunction( nullptr,
				{
					CefV8Value::CreateBool( success ),
					CefV8Value::CreateString( mainGrabbableId ),
				} );
			callback->second.context->Exit();

			m_startGadgetCallbacks.erase( callback );
		}
	}
	return false;
}


void CAardvarkRenderProcessHandler::updateGadgetNamesForBrowser()
{
	size_t listIndex = 0;
	CefRefPtr< CefListValue> idList = CefListValue::Create();
	for ( auto & info : m_contexts )
	{
		for ( auto & gadget : info.aardvarkObject->getGadgets() )
		{
			idList->SetInt( listIndex++, gadget->getId() );
		}
	}

	CefRefPtr<CefProcessMessage> msg = CefProcessMessage::Create( "update_browser_gadget_ids" );

	msg->GetArgumentList()->SetList( 0, idList );
	sendBrowserMessage( msg );
}

bool CAardvarkRenderProcessHandler::hasPermission( const std::string & permission )
{
	return m_gadgetManifest.m_permissions.find( permission ) != m_gadgetManifest.m_permissions.end();
}

void CAardvarkRenderProcessHandler::runFrame()
{
	for ( auto & info : m_contexts )
	{
		info.context->Enter();
		info.aardvarkObject->runFrame();
		info.context->Exit();
	}

	if ( m_client->isRunning() )
	{
		m_client->WaitScope().poll();
	}

	m_uriRequestHandler.doCefRequestWork();

	int64_t frameDelay = 10;
	if ( hasPermission( "renderer" ) )
	{
		frameDelay = 0;
	}

	CefPostDelayedTask( TID_RENDERER, base::Bind( &CAardvarkRenderProcessHandler::runFrame, this ), frameDelay );
}

void CAardvarkRenderProcessHandler::sendBrowserMessage( CefRefPtr< CefProcessMessage > msg )
{
	CefV8Context::GetCurrentContext()->GetBrowser()->SendProcessMessage( PID_BROWSER, msg );
}


void CAardvarkRenderProcessHandler::requestStartGadget( const CefString & uri, const CefString & initialHook, CefRefPtr<CefV8Value> callback )
{
	int requestId = 0;
	if ( callback->IsFunction() )
	{
		requestId = this->m_nextGadgetRequestId++;
		StartGadgetCallback_t cb = { CefV8Context::GetCurrentContext(), callback };
		m_startGadgetCallbacks.insert_or_assign( requestId, cb );
	}

	CefRefPtr<CefProcessMessage> msg = CefProcessMessage::Create( "start_gadget" );

	msg->GetArgumentList()->SetString( 0, uri );
	msg->GetArgumentList()->SetString( 1, initialHook );
	msg->GetArgumentList()->SetInt( 2, requestId );

	sendBrowserMessage( msg );
}


void CAardvarkRenderProcessHandler::sceneFinished( uint64_t mainGrabbableId )
{
	CefRefPtr<CefProcessMessage> msg = CefProcessMessage::Create( "scene_finished" );

	msg->GetArgumentList()->SetString( 0, std::to_string( mainGrabbableId ) );

	sendBrowserMessage( msg );
}
