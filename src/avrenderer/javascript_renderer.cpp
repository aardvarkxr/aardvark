#include "javascript_renderer.h"
#include "av_cef_javascript.h"
#include "aardvark_renderer.h"
#include "vrmanager.h"

CJavascriptModelInstance::CJavascriptModelInstance( std::unique_ptr<IModelInstance> modelInstance, 
	std::unordered_map< uint32_t, tools::OwnCapnp< AvSharedTextureInfo > > &textureInfo )
	: m_textureInfo( textureInfo )
{
	m_modelInstance = std::move( modelInstance );
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

		if ( !arguments[0]->IsArray() 
			|| arguments[0]->GetArrayLength() != 16 
			|| !arguments[0]->GetValue( 0 )->IsDouble() )
		{
			exception = "argument must be an array of 16 numbers";
			return;
		}

		glm::mat4 universeFromModel;
		universeFromModel[0][0] = arguments[0]->GetValue( 0 )->GetDoubleValue();
		universeFromModel[0][1] = arguments[0]->GetValue( 1 )->GetDoubleValue();
		universeFromModel[0][2] = arguments[0]->GetValue( 2 )->GetDoubleValue();
		universeFromModel[0][3] = arguments[0]->GetValue( 3 )->GetDoubleValue();
		universeFromModel[1][0] = arguments[0]->GetValue( 4 )->GetDoubleValue();
		universeFromModel[1][1] = arguments[0]->GetValue( 5 )->GetDoubleValue();
		universeFromModel[1][2] = arguments[0]->GetValue( 6 )->GetDoubleValue();
		universeFromModel[1][3] = arguments[0]->GetValue( 7 )->GetDoubleValue();
		universeFromModel[2][0] = arguments[0]->GetValue( 8 )->GetDoubleValue();
		universeFromModel[2][1] = arguments[0]->GetValue( 9 )->GetDoubleValue();
		universeFromModel[2][2] = arguments[0]->GetValue( 10 )->GetDoubleValue();
		universeFromModel[2][3] = arguments[0]->GetValue( 11 )->GetDoubleValue();
		universeFromModel[3][0] = arguments[0]->GetValue( 12 )->GetDoubleValue();
		universeFromModel[3][1] = arguments[0]->GetValue( 13 )->GetDoubleValue();
		universeFromModel[3][2] = arguments[0]->GetValue( 14 )->GetDoubleValue();
		universeFromModel[3][3] = arguments[0]->GetValue( 15 )->GetDoubleValue();

		m_modelInstance->setUniverseFromModel( universeFromModel );
	} );

	RegisterFunction( container, "setOverrideTexture", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
	{
		if ( arguments.size() != 1 )
		{
			exception = "Invalid arguments";
			return;
		}

		if ( !arguments[0]->IsUInt() )
		{
			exception = "argument must an unsigned int";
			return;
		}

		uint32_t textureId = arguments[0]->GetUIntValue();
		auto iTexture = m_textureInfo.find( textureId );
		if ( iTexture == m_textureInfo.end() )
		{
			exception = "unknown texture " + std::to_string( textureId );
			return;
		}

		m_modelInstance->setOverrideTexture( iTexture->second );
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
		m_handler->getContext()->Enter();

		m_jsTraverser->ExecuteFunction( nullptr, CefV8ValueList{} );

		m_handler->getContext()->Exit();

	}
	else
	{
		m_traverser.TraverseSceneGraphs();
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
		m_handler->getBrowser()->SendProcessMessage( PID_BROWSER, msg );
	}
}


bool CJavascriptRenderer::init( CefRefPtr<CefV8Value> container )
{
	m_frameListener = kj::heap<AvFrameListenerImpl>();
	m_frameListener->m_renderer = this;

	auto reqListen = m_handler->getClient()->Server().listenForFramesRequest();
	AvFrameListener::Client listenerClient = std::move( m_frameListener );
	reqListen.setListener( listenerClient );
	reqListen.send().wait( m_handler->getClient()->WaitScope() );

	m_vrManager->init();
	m_renderer->init( nullptr, m_vrManager.get(), m_handler->getClient() );
	m_traverser.init( m_renderer.get(), m_vrManager.get(), m_handler->getClient() );

	RegisterFunction( container, "registerSceneProcessor", [this]( const CefV8ValueList & arguments, CefRefPtr<CefV8Value>& retval, CefString& exception )
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

		m_jsSceneProcessor = arguments[0];
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
					std::move( modelInstance ),
					m_textureInfo );
			retval = newModelInstance.object;
		}
	} );
	return true;
}

CJavascriptRenderer::~CJavascriptRenderer() noexcept
{
	m_traverser.cleanup();
	m_renderer = nullptr;
}

aardvark::EAvSceneGraphNodeType sgTypeFromCapnProtoType( AvNode::Type capnType )
{
	switch ( capnType )
	{
	case AvNode::Type::CONTAINER:
		return aardvark::EAvSceneGraphNodeType::Container;
	case AvNode::Type::ORIGIN:
		return aardvark::EAvSceneGraphNodeType::Origin;
	case AvNode::Type::TRANSFORM:
		return aardvark::EAvSceneGraphNodeType::Transform;
	case AvNode::Type::MODEL:
		return aardvark::EAvSceneGraphNodeType::Model;
	case AvNode::Type::PANEL:
		return aardvark::EAvSceneGraphNodeType::Panel;
	case AvNode::Type::POKER:
		return aardvark::EAvSceneGraphNodeType::Poker;
	case AvNode::Type::GRABBABLE:
		return aardvark::EAvSceneGraphNodeType::Grabbable;
	case AvNode::Type::HANDLE:
		return aardvark::EAvSceneGraphNodeType::Handle;
	case AvNode::Type::GRABBER:
		return aardvark::EAvSceneGraphNodeType::Grabber;
	default:
		return aardvark::EAvSceneGraphNodeType::Invalid;
	}
}

CefRefPtr< CefV8Value > protoVectorToJsVector( AvVector::Reader & vector )
{
	CefRefPtr<CefV8Value> jsVector = CefV8Value::CreateObject( nullptr, nullptr );
	jsVector->SetValue( "x",
		CefV8Value::CreateDouble( vector.getX() ), V8_PROPERTY_ATTRIBUTE_NONE );
	jsVector->SetValue( "y",
		CefV8Value::CreateDouble( vector.getY() ), V8_PROPERTY_ATTRIBUTE_NONE );
	jsVector->SetValue( "z",
		CefV8Value::CreateDouble( vector.getZ() ), V8_PROPERTY_ATTRIBUTE_NONE );
	return jsVector;
}

CefRefPtr< CefV8Value > protoQuatToJsQuat( AvQuaternion::Reader & quat )
{
	CefRefPtr<CefV8Value> jsVector = CefV8Value::CreateObject( nullptr, nullptr );
	jsVector->SetValue( "x",
		CefV8Value::CreateDouble( quat.getX() ), V8_PROPERTY_ATTRIBUTE_NONE );
	jsVector->SetValue( "y",
		CefV8Value::CreateDouble( quat.getY() ), V8_PROPERTY_ATTRIBUTE_NONE );
	jsVector->SetValue( "z",
		CefV8Value::CreateDouble( quat.getZ() ), V8_PROPERTY_ATTRIBUTE_NONE );
	jsVector->SetValue( "w",
		CefV8Value::CreateDouble( quat.getW() ), V8_PROPERTY_ATTRIBUTE_NONE );
	return jsVector;
}

CefRefPtr< CefV8Value> protoTransformToJsTransform( AvTransform::Reader & transform )
{
	CefRefPtr<CefV8Value> jsTransform = CefV8Value::CreateObject( nullptr, nullptr );
	if ( transform.hasPosition() )
	{
		jsTransform->SetValue( "position", 
			protoVectorToJsVector( transform.getPosition() ), V8_PROPERTY_ATTRIBUTE_NONE );
	}
	if ( transform.hasScale() )
	{
		jsTransform->SetValue( "scale",
			protoVectorToJsVector( transform.getScale() ), V8_PROPERTY_ATTRIBUTE_NONE );
	}
	if ( transform.hasRotation() )
	{
		jsTransform->SetValue( "rotation",
			protoQuatToJsQuat( transform.getRotation() ), V8_PROPERTY_ATTRIBUTE_NONE );
	}

	return jsTransform;
}

enum class EVolumeType
{
	Invalid = -1,

	Sphere = 0,
};

EVolumeType protoVolumeTypeToEnum( AvVolume::Type protoType )
{
	switch ( protoType )
	{
	case AvVolume::Type::SPHERE:
		return EVolumeType::Sphere;

	default:
		return EVolumeType::Invalid;
	}
}


CefRefPtr< CefV8Value> protoVolumeToJsVolume( AvVolume::Reader & volume )
{
	CefRefPtr<CefV8Value> jsVolume = CefV8Value::CreateObject( nullptr, nullptr );
	jsVolume->SetValue( "type", 
		CefV8Value::CreateInt( (int)protoVolumeTypeToEnum( volume.getType() ) ), V8_PROPERTY_ATTRIBUTE_NONE );
	jsVolume->SetValue( "radius", CefV8Value::CreateDouble( (int)volume.getRadius() ), V8_PROPERTY_ATTRIBUTE_NONE );
	return jsVolume;
}



CefRefPtr<CefV8Value> CJavascriptRenderer::nodeToJsObject( AvNodeRoot::Reader & nodeRoot, 
	const std::unordered_map<uint32_t, uint32_t> & nodeIdToNodeIndex, uint32_t nodeIndex )
{
	if ( !nodeRoot.hasNodes() || nodeRoot.getNodes().size() <= nodeIndex )
		return nullptr;

	auto node = nodeRoot.getNodes()[ nodeIndex ].getNode();
	CefRefPtr<CefV8Value> jsNode = CefV8Value::CreateObject( nullptr, nullptr );

	aardvark::EAvSceneGraphNodeType nodeType = sgTypeFromCapnProtoType( node.getType() );
	if ( nodeType == aardvark::EAvSceneGraphNodeType::Invalid )
		return nullptr;

	uint64_t globalId = (uint64_t)nodeRoot.getSourceId() << 32 | node.getId();

	jsNode->SetValue( "type", CefV8Value::CreateInt( (int)nodeType ), V8_PROPERTY_ATTRIBUTE_NONE );
	jsNode->SetValue( "id", CefV8Value::CreateUInt( node.getId() ), V8_PROPERTY_ATTRIBUTE_NONE );
	jsNode->SetValue( "globalId", 
		CefV8Value::CreateString( std::to_string( globalId ) ), V8_PROPERTY_ATTRIBUTE_NONE );
	jsNode->SetValue( "flags", CefV8Value::CreateUInt( node.getFlags() ), V8_PROPERTY_ATTRIBUTE_NONE );

	if ( node.hasPropOrigin() )
	{
		jsNode->SetValue( "propOrigin", 
			CefV8Value::CreateString( node.getPropOrigin() ), V8_PROPERTY_ATTRIBUTE_NONE );
	}
	if ( node.hasPropTransform() )
	{
		jsNode->SetValue( "propTransform",
			protoTransformToJsTransform( node.getPropTransform() ), V8_PROPERTY_ATTRIBUTE_NONE );
	}
	if ( node.hasPropModelUri() )
	{
		jsNode->SetValue( "propModelUri", 
			CefV8Value::CreateString( node.getPropModelUri() ), V8_PROPERTY_ATTRIBUTE_NONE );
	}
	if ( node.hasPropVolume() )
	{
		jsNode->SetValue( "radius", protoVolumeToJsVolume( node.getPropVolume() ), V8_PROPERTY_ATTRIBUTE_NONE );
	}
	jsNode->SetValue( "propInteractive",
		CefV8Value::CreateBool( node.getPropInteractive() ), V8_PROPERTY_ATTRIBUTE_NONE );

	if ( node.hasChildren() && node.getChildren().size() > 0 )
	{
		CefRefPtr<CefV8Value> children = CefV8Value::CreateArray( node.getChildren().size() );
		for ( uint32_t child = 0; child < node.getChildren().size(); child++ )
		{
			auto nodeIndex = nodeIdToNodeIndex.find( node.getChildren()[child] );
			if ( nodeIndex != nodeIdToNodeIndex.end() )
			{
				children->SetValue( child, nodeToJsObject( nodeRoot, nodeIdToNodeIndex, nodeIndex->second ) );
			}
		}
		jsNode->SetValue( "children", children, V8_PROPERTY_ATTRIBUTE_NONE );
	}

	return jsNode;
}

CefRefPtr<CefV8Value> CJavascriptRenderer::nodeRootToJsObject( AvNodeRoot::Reader & nodeRoot )
{
	std::unordered_map<uint32_t, uint32_t> nodeIdToNodeIndex;
	for ( uint32_t n = 0; n < nodeRoot.getNodes().size(); n++ )
	{
		auto & node = nodeRoot.getNodes()[n].getNode();
		nodeIdToNodeIndex.insert_or_assign( node.getId(), n );
	}

	CefRefPtr<CefV8Value> jsNodeRoot = CefV8Value::CreateObject( nullptr, nullptr );
	jsNodeRoot->SetValue( "gadgetId", CefV8Value::CreateUInt( nodeRoot.getSourceId() ), V8_PROPERTY_ATTRIBUTE_NONE );
	if ( nodeRoot.hasHook() && nodeRoot.getHook().size() > 0 )
	{
		jsNodeRoot->SetValue( "hook", CefV8Value::CreateString( nodeRoot.getHook() ), V8_PROPERTY_ATTRIBUTE_NONE );
	}

	jsNodeRoot->SetValue( "root", nodeToJsObject( nodeRoot, nodeIdToNodeIndex, 0 ), V8_PROPERTY_ATTRIBUTE_NONE );
	return jsNodeRoot;
}

CefRefPtr<CefV8Value> CJavascriptRenderer::frameToJsObject( AvVisualFrame::Reader & frame )
{
	CefRefPtr<CefV8Value> jsFrame = CefV8Value::CreateObject( nullptr,nullptr );
	jsFrame->SetValue( "id", CefV8Value::CreateString( std::to_string( frame.getId() ) ), V8_PROPERTY_ATTRIBUTE_NONE );

	CefRefPtr<CefV8Value> roots = CefV8Value::CreateArray( frame.getRoots().size() );
	for ( uint32_t unRoot = 0; unRoot < frame.getRoots().size(); unRoot++ )
	{
		roots->SetValue( unRoot, nodeRootToJsObject( frame.getRoots()[unRoot] ) );
	}
	jsFrame->SetValue( "nodeRoots", roots, V8_PROPERTY_ATTRIBUTE_NONE );

	return jsFrame;
}


::kj::Promise<void> AvFrameListenerImpl::newFrame( NewFrameContext context )
{
	m_renderer->m_textureInfo.clear();
	if ( m_renderer->m_jsSceneProcessor )
	{
		auto frame = context.getParams().getFrame();
		if ( frame.hasGadgetTextures() )
		{
			for ( auto & texture : frame.getGadgetTextures() )
			{
				m_renderer->m_textureInfo.insert_or_assign( texture.getGadgetId(),
					tools::newOwnCapnp( texture.getSharedTextureInfo() ) );
			}
		}

		m_renderer->m_handler->getContext()->Enter();

		CefRefPtr< CefV8Value > jsFrame = m_renderer->frameToJsObject( context.getParams().getFrame() );
		m_renderer->m_jsSceneProcessor->ExecuteFunction( nullptr, CefV8ValueList{ jsFrame } );

		m_renderer->m_handler->getContext()->Exit();
	}
	else
	{
		m_renderer->m_traverser.newSceneGraph( context.getParams().getFrame() );
	}
	return kj::READY_NOW;
}

::kj::Promise<void> AvFrameListenerImpl::sendHapticEvent( SendHapticEventContext context )
{
	m_renderer->m_traverser.sendHapticEvent( context.getParams().getTargetGlobalId(),
		context.getParams().getAmplitude(),
		context.getParams().getFrequency(),
		context.getParams().getDuration() );
	return kj::READY_NOW;
}

::kj::Promise<void> AvFrameListenerImpl::startGrab( StartGrabContext context )
{
	uint64_t grabberGlobalId = context.getParams().getGrabberGlobalId();
	uint64_t grabbableGlobalId = context.getParams().getGrabbableGlobalId();

	m_renderer->m_traverser.startGrabImpl( grabberGlobalId, grabbableGlobalId );
	return kj::READY_NOW;
}


::kj::Promise<void> AvFrameListenerImpl::endGrab( EndGrabContext context )
{
	uint64_t grabberGlobalId = context.getParams().getGrabberGlobalId();
	uint64_t grabbableGlobalId = context.getParams().getGrabbableGlobalId();
	m_renderer->m_traverser.endGrabImpl( grabberGlobalId, grabbableGlobalId );
	return kj::READY_NOW;
}

