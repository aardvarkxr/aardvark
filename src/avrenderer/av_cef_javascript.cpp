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

using aardvark::AvSceneContext;
using aardvark::EAvSceneGraphResult;
using aardvark::EAvSceneGraphNodeType;

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
	~CJavascriptObjectWithFunctions();

	virtual bool init() = 0;
	virtual void cleanup() = 0;

	CefRefPtr<CefV8Value> getContainer() { return m_container; }

protected:
	void RegisterFunction( const std::string & sName, JavascriptFn fn );

	CefRefPtr<CefV8Value> m_container;

};

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

class CAardvarkGadgetObject : public CJavascriptObjectWithFunctions
{
	friend class CSceneContextObject;
public:
	CAardvarkGadgetObject( CAardvarkRenderProcessHandler *pRenderProcessHandler, AvGadget::Client client, const std::string & name );

	virtual bool init() override;
	virtual void cleanup() override;

	aardvark::EAvSceneGraphResult  finishSceneContext( CSceneContextObject *contextObject );
	const std::string & getName() const { return m_name; }
	void runFrame();

private:
	AvGadget::Client m_gadgetClient;
	CAardvarkRenderProcessHandler *m_handler = nullptr;
	std::string m_name;
	std::list<std::unique_ptr<CSceneContextObject>> m_sceneContexts;
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

	virtual bool init() override;
	virtual void cleanup() override;
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


bool CSceneContextObject::init()
{
	RegisterFunction( "finish", [this, parentGadget = m_parentGadget]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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

	RegisterFunction( "startNode", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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
	m_container->SetValue( "type", typeEnum, V8_PROPERTY_ATTRIBUTE_READONLY );

	RegisterFunction( "finishNode", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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

	RegisterFunction( "setOriginPath", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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

	RegisterFunction( "setTranslation", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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

	RegisterFunction( "setScale", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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

	RegisterFunction( "setUniformScale", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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

	RegisterFunction( "setRotationEulerDegrees", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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

	RegisterFunction( "setModelUri", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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

	RegisterFunction( "setTextureSource", [this, handler = m_handler ]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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

	RegisterFunction( "setInteractive", [this, handler = m_handler ]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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

	RegisterFunction( "setSphereVolume", [this, handler = m_handler]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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


void CSceneContextObject::cleanup()
{

}


CAardvarkGadgetObject::CAardvarkGadgetObject( CAardvarkRenderProcessHandler *renderProcessHandler, AvGadget::Client client, const std::string & name )
	: m_gadgetClient( client )
{
	m_handler = renderProcessHandler;
	m_name = name;
}


bool CAardvarkGadgetObject::init()
{
	RegisterFunction( "getName", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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

	RegisterFunction( "startSceneContext", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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

		auto newContext = std::make_unique<CSceneContextObject>( this, m_handler, context );
		if ( !newContext->init() )
		{
			exception = "Failed to init context";
			return;
		}
		retval = newContext->getContainer();

		m_sceneContexts.push_back( std::move( newContext ) );

	} );

	RegisterFunction( "registerPokerHandler", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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

	RegisterFunction( "registerPanelHandler", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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

	RegisterFunction( "registerGrabberProcessor", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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

	RegisterFunction( "registerGrabbableProcessor", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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

	RegisterFunction( "enableDefaultPanelHandling", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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

	RegisterFunction( "sendMouseEvent", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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

	RegisterFunction( "sendHapticEventFromPanel", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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

	RegisterFunction( "sendGrabEvent", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 3 )
		{
			exception = "Invalid arguments";
			return;
		}

		if ( !arguments[0]->IsUInt() )
		{
			exception = "first argument must be a grabber node ID";
			return;
		}

		if ( !arguments[1]->IsString() )
		{
			exception = "second argument must be the grabbable ID string";
			return;
		}

		if ( !arguments[2]->IsInt() )
		{
			exception = "third argument must be a grab event type";
			return;
		}

		aardvark::EAvSceneGraphResult result = aardvark::avPushGrabEventFromGrabber(
			m_handler->getClient(), &m_gadgetClient,
			arguments[0]->GetUIntValue(),
			std::stoull( std::string( arguments[1]->GetStringValue() ).c_str() ),
			( aardvark::EGrabEventType)arguments[2]->GetIntValue() );
		if ( result != aardvark::EAvSceneGraphResult::Success )
		{
			exception = "Error returned by avPushGrabEventFromGrabber: " + std::to_string( (int)result );
		}
	} );

	return true;
}

void CAardvarkGadgetObject::cleanup()
{
	for ( auto &context : m_sceneContexts )
	{
		context->cleanup();
	}
	m_sceneContexts.clear();

	m_gadgetClient = nullptr;
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
			m_handler->getContext()->Enter();

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

			m_handler->getContext()->Exit();
		}
	}

	for ( auto iHandler : m_panelProcessors )
	{
		aardvark::PanelMouseEvent_t panelMouseEvent;
		uint32_t unLimit = 0;
		while ( ++unLimit < 100 && EAvSceneGraphResult::Success == aardvark::avGetNextMouseEvent(
			m_handler->getClient(), iHandler.first, &panelMouseEvent ) )
		{
			m_handler->getContext()->Enter();

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

			m_handler->getContext()->Exit();
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

			m_handler->getBrowser()->SendProcessMessage( PID_BROWSER, msg );
		}
	}

	for ( auto iHandler : m_grabberProcessors )
	{
		uint64_t grabbableIntersections[100];
		bool isGrabberPressed = false;
		uint32_t usedCount;
		aardvark::EAvSceneGraphResult result = aardvark::avGetNextGrabberIntersection(
			m_handler->getClient(), iHandler.first, &isGrabberPressed, grabbableIntersections, 100, &usedCount );
		assert( result != EAvSceneGraphResult::InsufficientBufferSize );
		if ( result == EAvSceneGraphResult::Success )
		{
			m_handler->getContext()->Enter();

			CefRefPtr< CefV8Value > list = CefV8Value::CreateArray( (int)usedCount );
			for ( uint32_t n = 0; n < usedCount; n++ )
			{
				list->SetValue( n, CefV8Value::CreateString( std::to_string( grabbableIntersections[ n ] ) ) );
			}

			iHandler.second->ExecuteFunction( nullptr, 
				CefV8ValueList{ CefV8Value::CreateBool( isGrabberPressed ), list } );

			m_handler->getContext()->Exit();
		}
	}

	for ( auto iHandler : m_grabbableProcessors )
	{
		aardvark::GrabEvent_t grabEvent;
		uint32_t unLimit = 0;
		while ( ++unLimit < 100 && EAvSceneGraphResult::Success == aardvark::avGetNextGrabEvent(
			m_handler->getClient(), iHandler.first, &grabEvent) )
		{
			m_handler->getContext()->Enter();

			CefRefPtr< CefV8Value > evt = CefV8Value::CreateObject( nullptr, nullptr );
			evt->SetValue( CefString( "grabberId" ),
				CefV8Value::CreateString( std::to_string( grabEvent.grabberId) ),
				V8_PROPERTY_ATTRIBUTE_NONE );
			evt->SetValue( CefString( "grabbableId" ),
				CefV8Value::CreateString( std::to_string( grabEvent.grabbableId ) ),
				V8_PROPERTY_ATTRIBUTE_NONE );
			evt->SetValue( CefString( "type" ),
				CefV8Value::CreateInt( (int)grabEvent.type ),
				V8_PROPERTY_ATTRIBUTE_NONE );

			iHandler.second->ExecuteFunction( nullptr, CefV8ValueList{ evt } );

			m_handler->getContext()->Exit();
		}
	}
}



aardvark::EAvSceneGraphResult CAardvarkGadgetObject::finishSceneContext( CSceneContextObject *contextObject )
{
	aardvark::EAvSceneGraphResult res = avFinishSceneContext( contextObject->getContext(), &m_gadgetClient );
	if ( res != EAvSceneGraphResult::Success )
	{
		return res;
	}

	for ( auto iEntry = m_sceneContexts.begin(); iEntry != m_sceneContexts.end(); iEntry++ )
	{
		if ( &*(*iEntry) == contextObject )
		{
			m_sceneContexts.erase( iEntry );
			break;
		}
	}

	return res;
}



class CAardvarkObject : public CJavascriptObjectWithFunctions
{
public:
	CAardvarkObject( CAardvarkRenderProcessHandler *pRenderProcessHandler );

	virtual bool init() override;
	void cleanup() override;
	std::list<std::unique_ptr<CAardvarkGadgetObject>> & getGadgets() { return m_gadgets;  }

	bool hasPermission( const std::string & permission );
	void runFrame();

private:
	CAardvarkRenderProcessHandler *m_handler = nullptr;
	std::list<std::unique_ptr<CAardvarkGadgetObject>> m_gadgets;
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
}


bool CAardvarkObject::init()
{
	if ( hasPermission( "scenegraph" ) )
	{
		RegisterFunction( "createGadget", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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
			auto resCreateGadget = reqCreateGadget.send().wait( m_handler->getClient()->WaitScope() );
			if ( !resCreateGadget.hasGadget() )
			{
				retval = CefV8Value::CreateNull();
			}
			else
			{
				auto gadget = std::make_unique<CAardvarkGadgetObject>( m_handler, resCreateGadget.getGadget(), std::string( arguments[0]->GetStringValue() ) );
				if ( !gadget->init() )
				{
					retval = CefV8Value::CreateNull();
				}
				else
				{
					retval = gadget->getContainer();
					m_gadgets.push_back( std::move( gadget ) );
					m_handler->updateGadgetNamesForBrowser();
				}
			}
		} );
	}

	if ( hasPermission( "master" ) )
	{
		RegisterFunction( "startGadget", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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
			if ( !arguments[1]->IsArray() )
			{
				exception = "Invalid permission argument";
				return;
			}

			size_t listIndex = 0;
			CefRefPtr< CefListValue> permissionList = CefListValue::Create();
			for ( size_t n = 0; n < arguments[1]->GetArrayLength(); n++ )
			{
				auto arrayValue = arguments[1]->GetValue( (int)n );
				if ( arrayValue->IsString() )
				{
					permissionList->SetString( listIndex++, arrayValue->GetStringValue() );
				}
			}

			CefRefPtr<CefProcessMessage> msg = CefProcessMessage::Create( "start_gadget" );

			msg->GetArgumentList()->SetString( 0, arguments[0]->GetStringValue() );
			msg->GetArgumentList()->SetList( 1, permissionList );
			m_handler->getBrowser()->SendProcessMessage( PID_BROWSER, msg );
		} );
	}

	return true;

}

void CAardvarkObject::cleanup()
{
	for ( auto & gadget : m_gadgets )
	{
		gadget->cleanup();
	}
	m_gadgets.clear();
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
	assert( !m_browser );
	m_browser = browser;
	m_context = context;
	m_client->Start();

	// Retrieve the context's window object.
	CefRefPtr<CefV8Value> windowObj = m_context->GetGlobal();

	// Create an object to store our functions in
	m_aardvarkObject = std::make_unique<CAardvarkObject>( this );
	assert( m_aardvarkObject->init() );
	windowObj->SetValue( "aardvark", m_aardvarkObject->getContainer(), V8_PROPERTY_ATTRIBUTE_READONLY );

	CefPostDelayedTask( TID_RENDERER, base::Bind( &CAardvarkRenderProcessHandler::runFrame, this ), 0 );

}

void CAardvarkRenderProcessHandler::OnContextReleased( CefRefPtr<CefBrowser> browser,
	CefRefPtr<CefFrame> frame,
	CefRefPtr<CefV8Context> context )
{
	m_aardvarkObject->cleanup();
	m_aardvarkObject = nullptr;
	m_client->Stop();
	m_browser = nullptr;
}


bool CAardvarkRenderProcessHandler::OnProcessMessageReceived( CefRefPtr<CefBrowser> browser,
	CefProcessId source_process,
	CefRefPtr<CefProcessMessage> message )
{
	std::string messageName = message->GetName();

	if ( messageName == "set_browser_permissions" )
	{
		m_permissions.clear();
		auto permList = message->GetArgumentList()->GetList( 0 );
		for ( size_t n = 0; n < permList->GetSize(); n++ )
		{
			std::string perm( permList->GetString( n ) );
			m_permissions.insert( perm );
		}
	}
	return false;
}


void CAardvarkRenderProcessHandler::updateGadgetNamesForBrowser()
{
	size_t listIndex = 0;
	CefRefPtr< CefListValue> nameList = CefListValue::Create();
	for ( auto & gadget : m_aardvarkObject->getGadgets() )
	{
		nameList->SetString( listIndex++, gadget->getName() );
	}

	CefRefPtr<CefProcessMessage> msg = CefProcessMessage::Create( "update_browser_gadget_names" );

	msg->GetArgumentList()->SetList( 0, nameList );
	m_browser->SendProcessMessage( PID_BROWSER, msg );
}

bool CAardvarkRenderProcessHandler::hasPermission( const std::string & permission )
{
	return m_permissions.find( permission ) != m_permissions.end();
}

void CAardvarkRenderProcessHandler::runFrame()
{
	if ( m_aardvarkObject )
	{
		m_aardvarkObject->runFrame();
	}

	m_client->WaitScope().poll();

	CefPostDelayedTask( TID_RENDERER, base::Bind( &CAardvarkRenderProcessHandler::runFrame, this ), 10 );
}
