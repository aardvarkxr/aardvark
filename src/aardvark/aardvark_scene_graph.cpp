#include "aardvark/aardvark_scene_graph.h"

#include <vector>
#include <set>
#include <cassert>

#include "aardvark.capnp.h"
#include "aardvark_grabbable_processor.h"
#include "aardvark_grabber_processor.h"
#include "aardvark_panel_processor.h"
#include "aardvark_poker_processor.h"
#include <capnp/message.h>
#include <tools/capnprototools.h>

namespace aardvark
{

	class CSceneGraphContext
	{
	public:

		EAvSceneGraphResult avStartSceneContext( aardvark::CAardvarkClient *pClient );
		EAvSceneGraphResult avFinishSceneContext( AvGadget::Client *gadget, uint64_t *mainGrabbableId );

		// Starts a node as a child of the current node
		EAvSceneGraphResult avStartNode( uint32_t id, const char *pchName, EAvSceneGraphNodeType type );
		EAvSceneGraphResult avFinishNode( );

		// 
		// These property setters modify the current node and must be called between 
		// an avStartNode and avFinishNode pair.
		//

		// valid for Origin nodes.
		EAvSceneGraphResult avSetOriginPath( const char *pchOriginPath );

		// valid for Transform nodes
		EAvSceneGraphResult avSetTranslation( float x, float y, float z );
		EAvSceneGraphResult avSetScale( float x, float y, float z );
		EAvSceneGraphResult avSetRotation(float x, float y, float z, float w );

		// valid for Model nodes
		EAvSceneGraphResult avSetModelUri( const char *pchModelUri );

		// valid for Panel nodes
		EAvSceneGraphResult avSetPanelTextureSource( const char *pchSourceName );
		EAvSceneGraphResult avSetPanelInteractive( bool interactive );

		// valid for volume nodes
		EAvSceneGraphResult avSetSphereVolume( float radius );

		// valid for Custom nodes
		EAvSceneGraphResult avSetCustomNodeType( const char *pchCustomNodeType );

		AvNode::Builder & CurrentNode();
	private:
		struct NodeInProgress_t
		{
			NodeInProgress_t( capnp::Orphan< AvNode > node )
			{
				this->node = std::move( node );
			}
			NodeInProgress_t( const NodeInProgress_t & ) = delete;
			NodeInProgress_t( NodeInProgress_t && src )
			{
				node = std::move( src.node );
				children = src.children;
			}
			capnp::Orphan< AvNode > node;
			std::vector<uint32_t> children;
		};

		std::vector< NodeInProgress_t > m_vecBuilders;
		std::vector< capnp::Orphan< AvNode> > m_vecFinishedNodes;
		std::set<uint32_t> m_usedIds;
		::capnp::MallocMessageBuilder m_message;
		AvNode::Builder m_currentNodeBuilder = nullptr;
		aardvark::CAardvarkClient *m_pClient = nullptr;
	};

	// -----------------------------------------------------------------------------------------------
	// Creating new contexts
	// -----------------------------------------------------------------------------------------------
	EAvSceneGraphResult avStartSceneContext( aardvark::CAardvarkClient *pClient, AvSceneContext *pContext )
	{
		CSceneGraphContext *pNewContext = new CSceneGraphContext;
		*pContext = (AvSceneContextStruct *)pNewContext;
		EAvSceneGraphResult res = pNewContext->avStartSceneContext( pClient );
		if ( res != EAvSceneGraphResult::Success )
			delete pNewContext;
		return res;
	}

	// -----------------------------------------------------------------------------------------------
	// Finishing contexts
	// -----------------------------------------------------------------------------------------------
	EAvSceneGraphResult avFinishSceneContext( AvSceneContext context, AvGadget::Client *gadget, uint64_t *mainGrabbableId )
	{
		CSceneGraphContext *pContext = (CSceneGraphContext *)context;
		if ( !pContext )
			return EAvSceneGraphResult::InvalidContext;
		EAvSceneGraphResult res = pContext->avFinishSceneContext( gadget, mainGrabbableId );
		delete pContext;
		return res;
	}

	// ------------------------------------------------------------------------------------
	// These free functions just call through into the context
	// ------------------------------------------------------------------------------------
	EAvSceneGraphResult avStartNode( AvSceneContext context, uint32_t id, const char *pchName, EAvSceneGraphNodeType type )
	{
		CSceneGraphContext *pContext = (CSceneGraphContext *)context;
		if ( pContext )
			return pContext->avStartNode( id, pchName, type );
		else
			return EAvSceneGraphResult::InvalidContext;

	}

	EAvSceneGraphResult avFinishNode( AvSceneContext context )
	{
		CSceneGraphContext *pContext = (CSceneGraphContext *)context;
		if ( pContext )
			return pContext->avFinishNode();
		else
			return EAvSceneGraphResult::InvalidContext;

	}

	EAvSceneGraphResult avSetOriginPath( AvSceneContext context, const char *pchOriginPath )
	{
		CSceneGraphContext *pContext = (CSceneGraphContext *)context;
		if ( pContext )
			return pContext->avSetOriginPath( pchOriginPath );
		else
			return EAvSceneGraphResult::InvalidContext;

	}

	EAvSceneGraphResult avSetTranslation( AvSceneContext context, float x, float y, float z )
	{
		CSceneGraphContext *pContext = (CSceneGraphContext *)context;
		if ( pContext )
			return pContext->avSetTranslation( x, y, z );
		else
			return EAvSceneGraphResult::InvalidContext;

	}

	EAvSceneGraphResult avSetScale( AvSceneContext context, float x, float y, float z )
	{
		CSceneGraphContext *pContext = (CSceneGraphContext *)context;
		if ( pContext )
			return pContext->avSetScale( x, y, z );
		else
			return EAvSceneGraphResult::InvalidContext;

	}

	EAvSceneGraphResult avSetRotation( AvSceneContext context, float x, float y, float z, float w )
	{
		CSceneGraphContext *pContext = (CSceneGraphContext *)context;
		if ( pContext )
			return pContext->avSetRotation( x, y, z, w );
		else
			return EAvSceneGraphResult::InvalidContext;

	}

	EAvSceneGraphResult avSetModelUri( AvSceneContext context, const char *pchModelUri )
	{
		CSceneGraphContext *pContext = (CSceneGraphContext *)context;
		if ( pContext )
			return pContext->avSetModelUri( pchModelUri );
		else
			return EAvSceneGraphResult::InvalidContext;

	}

	EAvSceneGraphResult avSetPanelTextureSource( AvSceneContext context, const char *pchSourceName )
	{
		CSceneGraphContext *pContext = (CSceneGraphContext *)context;
		if ( pContext )
			return pContext->avSetPanelTextureSource( pchSourceName );
		else
			return EAvSceneGraphResult::InvalidContext;
	}

	EAvSceneGraphResult avSetPanelInteractive( AvSceneContext context, bool interactive )
	{
		CSceneGraphContext *pContext = (CSceneGraphContext *)context;
		if ( pContext )
			return pContext->avSetPanelInteractive( interactive );
		else
			return EAvSceneGraphResult::InvalidContext;
	}

	EAvSceneGraphResult avSetSphereVolume( AvSceneContext context, float radius )
	{
		CSceneGraphContext *pContext = (CSceneGraphContext *)context;
		if ( pContext )
			return pContext->avSetSphereVolume( radius );
		else
			return EAvSceneGraphResult::InvalidContext;
	}

	EAvSceneGraphResult avSetCustomNodeType( AvSceneContext context, const char *pchCustomNodeType )
	{
		CSceneGraphContext *pContext = (CSceneGraphContext *)context;
		if ( pContext )
			return pContext->avSetCustomNodeType( pchCustomNodeType );
		else
			return EAvSceneGraphResult::InvalidContext;
	}


	// -------------------------- CSceneGraphContext implementation ------------------------------------

	EAvSceneGraphResult CSceneGraphContext::avStartSceneContext( aardvark::CAardvarkClient *pClient )
	{
		m_pClient = pClient;

		// make a root node with the Id 0
		EAvSceneGraphResult res = avStartNode( 0, "root", EAvSceneGraphNodeType::Container );

		return res;
	}

	EAvSceneGraphResult CSceneGraphContext::avFinishSceneContext( AvGadget::Client *gadget, uint64_t *mainGrabbableId )
	{
		if ( m_vecBuilders.size() != 1 )
		{
			return EAvSceneGraphResult::NodeMismatch;
		}

		EAvSceneGraphResult res = avFinishNode();
		if ( res != EAvSceneGraphResult::Success )
		{
			return res;
		}


		AvNodeRoot::Builder root = m_message.initRoot<AvNodeRoot>();

		auto rootBuilder = root.initNodes( (uint32_t)m_vecFinishedNodes.size() );
		for ( uint32_t unNodeIndex = 0; unNodeIndex < m_vecFinishedNodes.size(); unNodeIndex++ )
		{
			size_t unReversedNodeIndex = m_vecFinishedNodes.size() - unNodeIndex - 1;
			rootBuilder[unNodeIndex].adoptNode( std::move( m_vecFinishedNodes[unReversedNodeIndex] ) );
		}

		root.setPokerProcessor( m_pClient->getPokerProcessor() );
		root.setPanelProcessor( m_pClient->getPanelProcessor() );
		root.setGrabberProcessor( m_pClient->getGrabberProcessor() );
		root.setGrabbableProcessor( m_pClient->getGrabbableProcessor() );

		auto reqUpdateSceneGraph = gadget->updateSceneGraphRequest();
		reqUpdateSceneGraph.setRoot( root );


		bool success = false;
		auto resGrabbableId = reqUpdateSceneGraph.send()
			.then( [gadget,&success ]( AvGadget::UpdateSceneGraphResults::Reader && res )
			{
				success = res.getSuccess();
				return gadget->mainGrabbableIdRequest().send();
			}
		).wait( m_pClient->WaitScope() );

		*mainGrabbableId = resGrabbableId.getGlobalId();

		if ( !success )
		{
			return EAvSceneGraphResult::RequestFailed;
		}
		else
		{
			return EAvSceneGraphResult::Success;
		}
	}


	AvNode::Type ProtoTypeFromApiType( EAvSceneGraphNodeType apiType )
	{
		switch ( apiType )
		{
		case EAvSceneGraphNodeType::Container: return AvNode::Type::CONTAINER;
		case EAvSceneGraphNodeType::Origin: return AvNode::Type::ORIGIN;
		case EAvSceneGraphNodeType::Transform: return AvNode::Type::TRANSFORM;
		case EAvSceneGraphNodeType::Model: return AvNode::Type::MODEL;
		case EAvSceneGraphNodeType::Panel: return AvNode::Type::PANEL;
		case EAvSceneGraphNodeType::Poker: return AvNode::Type::POKER;
		case EAvSceneGraphNodeType::Grabbable: return AvNode::Type::GRABBABLE;
		case EAvSceneGraphNodeType::Handle: return AvNode::Type::HANDLE;
		case EAvSceneGraphNodeType::Grabber: return AvNode::Type::GRABBER;
		case EAvSceneGraphNodeType::Custom: return AvNode::Type::CUSTOM;

		default: return AvNode::Type::INVALID;
		}
	}

	EAvSceneGraphNodeType ApiTypeFromProtoType( AvNode::Type protoType )
	{
		switch ( protoType )
		{
		case AvNode::Type::CONTAINER: return EAvSceneGraphNodeType::Container;
		case AvNode::Type::ORIGIN: return EAvSceneGraphNodeType::Origin;
		case AvNode::Type::TRANSFORM: return EAvSceneGraphNodeType::Transform;
		case AvNode::Type::MODEL: return EAvSceneGraphNodeType::Model;
		case AvNode::Type::PANEL: return EAvSceneGraphNodeType::Panel;
		case AvNode::Type::POKER: return EAvSceneGraphNodeType::Poker;
		case AvNode::Type::GRABBABLE: return EAvSceneGraphNodeType::Grabbable;
		case AvNode::Type::HANDLE: return EAvSceneGraphNodeType::Handle;
		case AvNode::Type::GRABBER: return EAvSceneGraphNodeType::Grabber;
		case AvNode::Type::CUSTOM: return EAvSceneGraphNodeType::Custom;

		default: return EAvSceneGraphNodeType::Invalid;
		}
	}

	EAvSceneGraphResult CSceneGraphContext::avStartNode( uint32_t id, const char *pchName, EAvSceneGraphNodeType type )
	{
		if ( m_usedIds.find( id ) != m_usedIds.end() )
		{
			return EAvSceneGraphResult::IdInUse;
		}

		NodeInProgress_t nodeInProgress( m_message.getOrphanage().newOrphan<AvNode>() );

		AvNode::Builder newNode = nodeInProgress.node.get();
		newNode.setId( id );
		auto protoType = ProtoTypeFromApiType( type );
		if ( protoType == AvNode::Type::INVALID )
		{
			return EAvSceneGraphResult::InvalidParameter;
		}

		newNode.setType( protoType );
		if ( pchName )
		{
			newNode.setName( pchName );
		}

		if ( !m_vecBuilders.empty() )
		{
			m_vecBuilders.back().children.push_back( id );
		}

		m_vecBuilders.push_back( std::move( nodeInProgress ) );
		m_currentNodeBuilder = newNode;

		m_usedIds.insert( id );
		return EAvSceneGraphResult::Success;
	}

	EAvSceneGraphResult CSceneGraphContext::avFinishNode()
	{
		assert( !m_vecBuilders.empty() );
		
		NodeInProgress_t &nip = m_vecBuilders.back();

		if ( !nip.children.empty() )
		{
			auto childrenBuilder = CurrentNode().initChildren( (uint32_t)nip.children.size() );
			for ( uint32_t unIndex = 0; unIndex < nip.children.size(); unIndex++ )
			{
				childrenBuilder.set( unIndex, nip.children[unIndex] );
			}
		}

		m_vecFinishedNodes.push_back( std::move( nip.node ) );
		m_vecBuilders.pop_back();

		if ( m_vecBuilders.empty() )
		{
			m_currentNodeBuilder = nullptr;
		}
		else
		{
			m_currentNodeBuilder = m_vecBuilders.back().node.get();
		}

		return EAvSceneGraphResult::Success;
	}

	// 
	// These property setters modify the current node and must be called between 
	// an avStartNode and avFinishNode pair.
	//

	// valid for Origin nodes.
	EAvSceneGraphResult CSceneGraphContext::avSetOriginPath( const char *pchOriginPath )
	{
		if ( CurrentNode().getType() != AvNode::Type::ORIGIN && CurrentNode().getType() != AvNode::Type::CUSTOM )
			return EAvSceneGraphResult::InvalidNodeType;
		CurrentNode().setPropOrigin( pchOriginPath );
		return EAvSceneGraphResult::Success;
	}

	// valid for Transform nodes
	EAvSceneGraphResult CSceneGraphContext::avSetTranslation( float x, float y, float z )
	{
		if ( CurrentNode().getType() != AvNode::Type::TRANSFORM && CurrentNode().getType() != AvNode::Type::CUSTOM )
			return EAvSceneGraphResult::InvalidNodeType;
		AvVector::Builder & trans = CurrentNode().getPropTransform().getPosition();
		trans.setX( x );
		trans.setY( y );
		trans.setZ( z );
		return EAvSceneGraphResult::Success;
	}
	EAvSceneGraphResult CSceneGraphContext::avSetScale( float x, float y, float z )
	{
		if ( CurrentNode().getType() != AvNode::Type::TRANSFORM && CurrentNode().getType() != AvNode::Type::CUSTOM )
			return EAvSceneGraphResult::InvalidNodeType;
		AvVector::Builder & scale = CurrentNode().getPropTransform().getScale();
		scale.setX( x );
		scale.setY( y );
		scale.setZ( z );
		return EAvSceneGraphResult::Success;
	}
	EAvSceneGraphResult CSceneGraphContext::avSetRotation( float x, float y, float z, float w )
	{
		if ( CurrentNode().getType() != AvNode::Type::TRANSFORM && CurrentNode().getType() != AvNode::Type::CUSTOM )
			return EAvSceneGraphResult::InvalidNodeType;
		AvQuaternion::Builder & rot = CurrentNode().getPropTransform().getRotation();
		rot.setX( x );
		rot.setY( y );
		rot.setZ( z );
		rot.setW( w );
		return EAvSceneGraphResult::Success;
	}

	// valid for Model nodes
	EAvSceneGraphResult CSceneGraphContext::avSetModelUri( const char *pchModelUri )
	{
		if ( CurrentNode().getType() != AvNode::Type::MODEL && CurrentNode().getType() != AvNode::Type::CUSTOM )
			return EAvSceneGraphResult::InvalidNodeType;
		CurrentNode().setPropModelUri( pchModelUri );
		return EAvSceneGraphResult::Success;
	}

	EAvSceneGraphResult CSceneGraphContext::avSetPanelTextureSource( const char *pchTextureSource )
	{
		if ( CurrentNode().getType() != AvNode::Type::PANEL && CurrentNode().getType() != AvNode::Type::CUSTOM )
			return EAvSceneGraphResult::InvalidNodeType;
		CurrentNode().setPropTextureSource( pchTextureSource );
		return EAvSceneGraphResult::Success;
	}

	EAvSceneGraphResult CSceneGraphContext::avSetPanelInteractive( bool interactive )
	{
		if ( CurrentNode().getType() != AvNode::Type::PANEL && CurrentNode().getType() != AvNode::Type::CUSTOM )
			return EAvSceneGraphResult::InvalidNodeType;
		CurrentNode().setPropInteractive( interactive );
		return EAvSceneGraphResult::Success;
	}

	EAvSceneGraphResult CSceneGraphContext::avSetSphereVolume( float radius )
	{
		if ( radius < 0 )
			return EAvSceneGraphResult::InvalidParameter;
		if ( CurrentNode().getType() != AvNode::Type::HANDLE && CurrentNode().getType() != AvNode::Type::GRABBER
			&& CurrentNode().getType() != AvNode::Type::CUSTOM )
			return EAvSceneGraphResult::InvalidNodeType;
		auto volume = CurrentNode().initPropVolume();
		volume.setType( AvVolume::Type::SPHERE );
		volume.setRadius( radius );
		return EAvSceneGraphResult::Success;
	}

	EAvSceneGraphResult CSceneGraphContext::avSetCustomNodeType( const char *pchCustomNodeType )
	{
		if ( !pchCustomNodeType || !*pchCustomNodeType )
			return EAvSceneGraphResult::InvalidParameter;
		if ( CurrentNode().getType() != AvNode::Type::CUSTOM )
			return EAvSceneGraphResult::InvalidNodeType;
		CurrentNode().setPropCustomNodeType( pchCustomNodeType );
		return EAvSceneGraphResult::Success;
	}

	AvNode::Builder & CSceneGraphContext::CurrentNode()
	{
		return m_currentNodeBuilder;
	}

	// tells the renderer what DXGI to use for a scene graph node
	EAvSceneGraphResult avUpdateDxgiTextureForGadgets( aardvark::CAardvarkClient *pClient, 
		uint32_t *gadgetIds, uint32_t unIdCount,
		uint32_t unWidth, uint32_t unHeight, 
		void *pvSharedTextureHandle, bool bInvertY )
	{
		auto reqUpdate = pClient->Server().updateDxgiTextureForGadgetsRequest();
		if ( unIdCount )
		{
			auto ids = reqUpdate.initGadgetIds( unIdCount );
			for ( uint32_t n = 0; n < unIdCount; n++ )
			{
				ids.set( n, gadgetIds[n] );
			}
		}

		auto paramInfo = reqUpdate.initSharedTextureInfo();
		paramInfo.setType( AvSharedTextureInfo::Type::D3D11_TEXTURE2_D );
		paramInfo.setFormat( AvSharedTextureInfo::Format::B8G8R8A8 );
		paramInfo.setWidth( unWidth );
		paramInfo.setHeight( unHeight );
		paramInfo.setSharedTextureHandle( reinterpret_cast<uint64_t>( pvSharedTextureHandle ) );
		paramInfo.setInvertY( bInvertY );

		pClient->addRequestToTasks( std::move( reqUpdate ) );
		return EAvSceneGraphResult::Success;
	}

	EAvSceneGraphResult avGetNextPokerProximity( aardvark::CAardvarkClient *pClient,
		uint32_t pokerNodeId, 
		PokerProximity_t *pokerProximities, uint32_t pokerProximityCount, 
		uint32_t *usedPokerProximityCount )
	{
		KJ_IF_MAYBE( pokerProcessor, pClient->getPokerProcessorServer() )
		{
			return (*pokerProcessor )->avGetNextPokerProximity( pokerNodeId, pokerProximities, pokerProximityCount, usedPokerProximityCount );
		}
		else
		{
			return EAvSceneGraphResult::NoEvents;
		}
	}

	EAvSceneGraphResult avGetNextMouseEvent( aardvark::CAardvarkClient *pClient, uint32_t panelNodeId, PanelMouseEvent_t *mouseEvent )
	{
		KJ_IF_MAYBE( pokerProcessor, pClient->getPanelProcessorServer() )
		{
			return ( *pokerProcessor )->avGetNextMouseEvent( panelNodeId, mouseEvent );
		}
		else
		{
			return EAvSceneGraphResult::NoEvents;
		}
	}

	EAvSceneGraphResult avPushMouseEventFromPoker( aardvark::CAardvarkClient *pClient, 
		AvGadget::Client *gadget, uint32_t pokerNodeId,
		uint64_t panelId, EPanelMouseEventType type, float x, float y )
	{
		auto reqPushEvent = gadget->pushMouseEventRequest();
		reqPushEvent.setPokerNodeId( pokerNodeId );
		AvPanelMouseEvent::Builder bldEvent = reqPushEvent.initEvent();
		bldEvent.setPanelId( panelId );
		bldEvent.setX( x );
		bldEvent.setY( y );
		switch ( type )
		{
		case EPanelMouseEventType::Down:
			bldEvent.setType( AvPanelMouseEvent::Type::DOWN );
			break;
		case EPanelMouseEventType::Up:
			bldEvent.setType( AvPanelMouseEvent::Type::UP );
			break;
		case EPanelMouseEventType::Enter:
			bldEvent.setType( AvPanelMouseEvent::Type::ENTER );
			break;
		case EPanelMouseEventType::Leave:
			bldEvent.setType( AvPanelMouseEvent::Type::LEAVE );
			break;
		case EPanelMouseEventType::Move:
			bldEvent.setType( AvPanelMouseEvent::Type::MOVE );
			break;

		default:
			return EAvSceneGraphResult::InvalidParameter;
		}

		auto promPushEvent = reqPushEvent.send()
			.then( []( AvGadget::PushMouseEventResults::Reader && result )
		{
			// nothing to do when the update happens
		} );
		pClient->addToTasks( std::move( promPushEvent ) );

		return EAvSceneGraphResult::Success;
	}

	EAvSceneGraphResult avGetNextGrabberIntersection( aardvark::CAardvarkClient *pClient,
		uint32_t grabberNodeId,
		bool *isGrabberPressed,
		uint64_t *grabberIntersections, uint32_t intersectionArraySize,
		uint32_t *usedIntersectionCount,
		uint64_t *hooks, uint32_t hookArraySize,
		uint32_t *usedHookCount )
	{
		KJ_IF_MAYBE( grabberProcessor, pClient->getGrabberProcessorServer() )
		{
			return ( *grabberProcessor )->avGetNextGrabberIntersection( grabberNodeId, isGrabberPressed, 
				grabberIntersections, intersectionArraySize, usedIntersectionCount,
				hooks, hookArraySize, usedHookCount );
		}
		else
		{
		return EAvSceneGraphResult::NoEvents;
		}
	}

	EAvSceneGraphResult avGetNextGrabEvent( aardvark::CAardvarkClient *pClient, 
		uint32_t grabbableNodeId, GrabEvent_t *grabEvent )
	{
		KJ_IF_MAYBE( grabbableProcessor, pClient->getGrabbableProcessorServer() )
		{
			return ( *grabbableProcessor )->avGetNextGrabEvent( grabbableNodeId, grabEvent );
		}
		else
		{
		return EAvSceneGraphResult::NoEvents;
		}
	}

	EAvSceneGraphResult avPushGrabEventFromGrabber( aardvark::CAardvarkClient *pClient,
		AvGadget::Client *gadget, uint32_t grabberNodeId,
		uint64_t grabbableId, uint64_t hookId, EGrabEventType type )
	{
		auto reqPushEvent = gadget->pushGrabEventRequest();
		reqPushEvent.setGrabberNodeId( grabberNodeId );
		AvGrabEvent::Builder bldEvent = reqPushEvent.initEvent();
		bldEvent.setGrabbableId( grabbableId );
		bldEvent.setHookId( hookId );
		bldEvent.setType( protoTypeFromGrabType( type ) );
		pClient->addRequestToTasks( std::move( reqPushEvent ) );
		return EAvSceneGraphResult::Success;
	}


	EAvSceneGraphResult avSendHapticEventFromPanel( aardvark::CAardvarkClient *pClient, 
		AvGadget::Client *gadget, uint32_t panelNodeId,
		float amplitude, float frequency, float duration )
	{
		KJ_IF_MAYBE( panelHandler, pClient->getPanelProcessorServer() )
		{
			auto req = gadget->sendHapticEventRequest();
			req.setNodeGlobalId( ( *panelHandler )->getLastPoker() );
			req.setAmplitude( amplitude );
			req.setFrequency( frequency );
			req.setDuration( duration );
			pClient->addRequestToTasks( std::move( req ) );
			return EAvSceneGraphResult::Success;
		}
		else
		{
			return EAvSceneGraphResult::RequestFailed;
		}
	}

	AvGrabEvent::Type protoTypeFromGrabType( EGrabEventType type )
	{
		switch ( type )
		{
		case EGrabEventType::EnterRange:
			return AvGrabEvent::Type::ENTER_RANGE;
		case EGrabEventType::LeaveRange:
			return AvGrabEvent::Type::LEAVE_RANGE;
		case EGrabEventType::StartGrab:
			return AvGrabEvent::Type::START_GRAB;
		case EGrabEventType::EndGrab:
			return AvGrabEvent::Type::END_GRAB;
		case EGrabEventType::EnterHookRange:
			return AvGrabEvent::Type::ENTER_HOOK_RANGE;
		case EGrabEventType::LeaveHookRange:
			return AvGrabEvent::Type::LEAVE_HOOK_RANGE;
		case EGrabEventType::RequestGrab:
			return AvGrabEvent::Type::REQUEST_GRAB;
		case EGrabEventType::RequestGrabResponse:
			return AvGrabEvent::Type::REQUEST_GRAB_RESPONSE;
		case EGrabEventType::CancelGrab:
			return AvGrabEvent::Type::CANCEL_GRAB;
		case EGrabEventType::GrabStarted:
			return AvGrabEvent::Type::GRAB_STARTED;

		default:
			return AvGrabEvent::Type::INVALID;
		}
	}

	EGrabEventType grabTypeFromProtoType( AvGrabEvent::Type type )
	{
		switch ( type )
		{
		case AvGrabEvent::Type::ENTER_RANGE:
			return EGrabEventType::EnterRange;
		case AvGrabEvent::Type::LEAVE_RANGE:
			return EGrabEventType::LeaveRange;
		case AvGrabEvent::Type::START_GRAB:
			return EGrabEventType::StartGrab;
		case AvGrabEvent::Type::END_GRAB:
			return EGrabEventType::EndGrab;
		case AvGrabEvent::Type::ENTER_HOOK_RANGE:
			return EGrabEventType::EnterHookRange;
		case AvGrabEvent::Type::LEAVE_HOOK_RANGE:
			return EGrabEventType::LeaveHookRange;
		case AvGrabEvent::Type::REQUEST_GRAB:
			return EGrabEventType::RequestGrab;
		case AvGrabEvent::Type::REQUEST_GRAB_RESPONSE:
			return EGrabEventType::RequestGrabResponse;
		case AvGrabEvent::Type::CANCEL_GRAB:
			return EGrabEventType::CancelGrab;
		case AvGrabEvent::Type::GRAB_STARTED:
			return EGrabEventType::GrabStarted;

		default:
			return EGrabEventType::Unknown;
		}
	}

	void protoGrabEventToLocalEvent( AvGrabEvent::Reader inEvent, GrabEvent_t *outEvent )
	{
		outEvent->grabbableId = inEvent.getGrabbableId();
		outEvent->grabberId = inEvent.getGrabberId();
		outEvent->hookId = inEvent.getHookId();
		outEvent->requestId = inEvent.getRequestId();
		outEvent->allowed = inEvent.getAllowed();
		outEvent->useIdentityTransform = inEvent.getUseIdentityTransform();
		outEvent->type = grabTypeFromProtoType( inEvent.getType() );
	}
}


