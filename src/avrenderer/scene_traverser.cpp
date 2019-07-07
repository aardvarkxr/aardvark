#include "scene_traverser.h"

#include <glm/gtc/quaternion.hpp>

void CSceneTraverser::init( IRenderer *renderer, aardvark::CAardvarkClient *client )
{
	m_renderer = renderer;
	m_client = client;
}


void CSceneTraverser::cleanup()
{
	m_mapNodeData.clear();
}

void CSceneTraverser::TraverseSceneGraphs()
{
	m_inFrameTraversal = true;
	setVisitedNodes.clear();
	m_handDeviceForNode.clear();
	m_renderer->resetRenderList();
	m_intersections.reset();
	m_collisions.reset();
	m_currentHand = EHand::Invalid;
	m_currentGrabbableGlobalId = 0;
	m_nodeTransforms.clear();
	for ( auto & root : m_roots )
	{
		TraverseSceneGraph( root.get() );
	}
	m_pCurrentRoot = nullptr;

	m_lastFrameUniverseFromNode.clear();

	for ( auto & transform : m_nodeTransforms )
	{
		transform.second->resolve();
		m_lastFrameUniverseFromNode.insert_or_assign( transform.first, transform.second->getUniverseFromNode() );
	}

	m_inFrameTraversal = false;

	m_intersections.updatePokerProximity( m_client );
	m_collisions.updateGrabberIntersections( m_client );
}

uint64_t CSceneTraverser::GetGlobalId( const AvNode::Reader & node )
{
	assert( m_pCurrentRoot );
	if ( m_pCurrentRoot )
	{
		return ( (uint64_t)m_pCurrentRoot->gadgetId ) << 32 | node.getId();
	}
	else
	{
		return 0;
	}
}

CSceneTraverser::SgNodeData_t *CSceneTraverser::GetNodeData( const AvNode::Reader & node )
{
	// TODO(Joe): Figure out when to delete these
	uint64_t globalId = GetGlobalId( node );
	if ( !globalId )
		return nullptr;

	auto iData = m_mapNodeData.find( globalId );
	if ( iData != m_mapNodeData.end() )
	{
		return &*iData->second;
	}
	else
	{
		auto pData = std::make_unique<SgNodeData_t>();
		SgNodeData_t *pRetVal = &*pData;
		m_mapNodeData.insert( std::make_pair( globalId, std::move( pData ) ) );
		return pRetVal;
	}
}


void CSceneTraverser::TraverseSceneGraph( const SgRoot_t *root )
{
	if ( !root->nodes.empty() )
	{
		m_pCurrentRoot = root;

		// set the node 0 transform to its hook by default
		if ( !root->hook.empty() )
		{
			setHookOrigin( root->hook, root->nodes[0] );
		}

		// the 0th node is always the root
		TraverseNode( root->nodes[0], nullptr );
	}
}

void CSceneTraverser::TraverseNode( const AvNode::Reader & node, CPendingTransform *defaultParent )
{
	uint64_t globalId = GetGlobalId( node );
	if ( setVisitedNodes.find( globalId ) != setVisitedNodes.end() )
	{
		return;
	}
	setVisitedNodes.insert( globalId );

	EHand handBefore = m_currentHand;

	switch ( node.getType() )
	{
	case AvNode::Type::CONTAINER:
		// nothing special to do here
		break;

	case AvNode::Type::ORIGIN:
		TraverseOrigin( node, defaultParent );
		break;

	case AvNode::Type::TRANSFORM:
		TraverseTransform( node, defaultParent );
		break;

	case AvNode::Type::MODEL:
		TraverseModel( node, defaultParent );
		break;

	case AvNode::Type::PANEL:
		TraversePanel( node, defaultParent );
		break;

	case AvNode::Type::POKER:
		TraversePoker( node, defaultParent );
		break;

	case AvNode::Type::GRABBABLE:
		TraverseGrabbable( node, defaultParent );
		break;

	case AvNode::Type::HANDLE:
		TraverseHandle( node, defaultParent );
		break;

	case AvNode::Type::GRABBER:
		TraverseGrabber( node, defaultParent );
		break;

	case AvNode::Type::INVALID:
	default:
		assert( false );
	}

	uint64_t globalNodeId = GetGlobalId( node );
	CPendingTransform *thisNodeTransform = getTransform( globalNodeId );
	if ( thisNodeTransform->needsUpdate() )
	{
		thisNodeTransform->update( defaultParent, glm::mat4( 1.f ), nullptr );
	}

	m_handDeviceForNode.insert_or_assign( globalNodeId, m_currentHand );

	for ( const uint32_t unChildId : node.getChildren() )
	{
		auto iChild = m_pCurrentRoot->mapIdToIndex.find( unChildId );
		if ( iChild != m_pCurrentRoot->mapIdToIndex.end() && iChild->second < m_pCurrentRoot->nodes.size() )
		{
			TraverseNode( m_pCurrentRoot->nodes[iChild->second], thisNodeTransform );
		}
	}

	if ( AvNode::Type::GRABBABLE == node.getType() )
	{
		m_currentGrabbableGlobalId = 0;
	}

	m_currentHand = handBefore;
}

void CSceneTraverser::TraverseOrigin( const AvNode::Reader & node, CPendingTransform *defaultParent )
{
	std::string origin = node.getPropOrigin();
	setHookOrigin( origin, node );
}


void CSceneTraverser::setHookOrigin( std::string origin, const AvNode::Reader & node )
{
	glm::mat4 universeFromOrigin;
	if ( m_renderer->getUniverseFromOrigin( origin, &universeFromOrigin ) )
	{
		updateTransform( GetGlobalId( node ), nullptr, universeFromOrigin, nullptr );

		if ( origin == "/user/hand/left" )
		{
			m_currentHand = EHand::Left;
		}
		else if ( origin == "/user/hand/right" )
		{
			m_currentHand = EHand::Right;
		}
		else
		{
			m_currentHand = EHand::Invalid;
		}
	}
}


void CSceneTraverser::TraverseTransform( const AvNode::Reader & node, CPendingTransform *defaultParent )
{
	if ( node.hasPropTransform() )
	{
		const AvTransform::Reader & transform = node.getPropTransform();
		glm::vec3 vTrans;
		if ( transform.hasPosition() )
		{
			vTrans.x = transform.getPosition().getX();
			vTrans.y = transform.getPosition().getY();
			vTrans.z = transform.getPosition().getZ();
		}
		else
		{
			vTrans.x = vTrans.y = vTrans.z = 0.f;
		}
		glm::vec3 vScale;
		if ( transform.hasScale() )
		{
			vScale.x = transform.getScale().getX();
			vScale.y = transform.getScale().getY();
			vScale.z = transform.getScale().getZ();
		}
		else
		{
			vScale.x = vScale.y = vScale.z = 1.f;
		}
		glm::quat qRot;
		if ( transform.hasRotation() )
		{
			qRot.x = transform.getRotation().getX();
			qRot.y = transform.getRotation().getY();
			qRot.z = transform.getRotation().getZ();
			qRot.w = transform.getRotation().getW();
		}
		else
		{
			qRot.x = qRot.y = qRot.z = 0.f;
			qRot.w = 1.f;
		}

		glm::mat4 matParentFromNode = glm::translate( glm::mat4( 1.0f ), vTrans ) * glm::mat4( qRot ) * glm::scale( glm::mat4( 1.0f ), vScale );
		updateTransform( GetGlobalId( node ), defaultParent, matParentFromNode, nullptr );
	}
}

void CSceneTraverser::TraverseModel( const AvNode::Reader & node, CPendingTransform *defaultParent )
{
	SgNodeData_t *pData = GetNodeData( node );
	assert( pData );

	std::string modelUri = node.getPropModelUri();
	if ( pData->lastModelUri != modelUri )
	{
		pData->model = nullptr;
	}

	if ( !pData->model )
	{
		pData->model = m_renderer->createModelInstance( modelUri );
		if ( pData->model )
		{
			pData->lastModelUri = modelUri;
		}
	}

	if ( pData->model )
	{
		updateTransform( GetGlobalId( node ), defaultParent, glm::mat4( 1.f ),
			[this, pData]( const glm::mat4 & universeFromNode )
		{
			pData->model->setUniverseFromModel( universeFromNode );
			m_renderer->addToRenderList( pData->model.get() );
		} );
	}
}


void CSceneTraverser::TraversePanel( const AvNode::Reader & node, CPendingTransform *defaultParent )
{
	SgNodeData_t *pData = GetNodeData( node );
	assert( pData );

	auto iSharedTexture = m_sharedTextureInfo.find( m_pCurrentRoot->gadgetId );

	if ( !pData->model && iSharedTexture != m_sharedTextureInfo.end() )
	{
		std::string sPanelModelUri = "file:///e:/homedev/aardvark/data/models/panel/panel.glb";
		if ( iSharedTexture->second.getInvertY() )
		{
			sPanelModelUri = "file:///e:/homedev/aardvark/data/models/panel/panel_inverted.glb";
		}

		pData->model = m_renderer->createModelInstance( sPanelModelUri );
	}

	if ( pData->model )
	{

		if ( iSharedTexture != m_sharedTextureInfo.end() )
		{
			pData->model->setOverrideTexture( iSharedTexture->second );
		}

		uint64_t globalId = GetGlobalId( node );
		updateTransform( globalId, defaultParent, glm::mat4( 1.f ),
			[this, pData, node, globalId]( const glm::mat4 & universeFromNode )
		{
			pData->model->setUniverseFromModel( universeFromNode );
			m_renderer->addToRenderList( pData->model.get() );

			if ( node.getPropInteractive() )
			{
				glm::vec4 panelTangent = universeFromNode * glm::vec4( 0, 1.f, 0, 0 );
				float zScale = glm::length( panelTangent );
				m_intersections.addActivePanel(
					globalId,
					glm::inverse( universeFromNode ),
					zScale );
			}
		} );
	}
}

void CSceneTraverser::TraversePoker( const AvNode::Reader & node, CPendingTransform *defaultParent )
{
	uint64_t globalId = GetGlobalId( node );
	updateTransform( globalId, defaultParent, glm::mat4( 1.f ),
		[this, globalId]( const glm::mat4 & universeFromNode )
	{
		glm::vec4 vPokerInUniverse = universeFromNode * glm::vec4( 0, 0, 0, 1.f );
		m_intersections.addActivePoker( globalId, vPokerInUniverse );
	} );
}

void CSceneTraverser::TraverseGrabbable( const AvNode::Reader & node, CPendingTransform *defaultParent )
{
	uint64_t globalId = GetGlobalId( node );
	m_currentGrabbableGlobalId = globalId;
	auto iParentTransform = m_nodeToNodeAnchors.find( globalId );
	if ( iParentTransform != m_nodeToNodeAnchors.end() )
	{
		// we have a parent from grabbing. Need to update to that.
		CPendingTransform *parent = getTransform( iParentTransform->second.parentNodeId );
		updateTransform( globalId, parent, iParentTransform->second.parentNodeFromThisNode, nullptr );
	}
}


void CSceneTraverser::TraverseHandle( const AvNode::Reader & node, CPendingTransform *defaultParent )
{
	if ( !node.hasPropVolume() )
	{
		return;
	}


	updateTransform( GetGlobalId( node ), defaultParent, glm::mat4( 1.f ),
		[this, node, grabbableId = m_currentGrabbableGlobalId]( const glm::mat4 & universeFromNode )
	{
		m_collisions.addGrabbableHandle( grabbableId, universeFromNode, node.getPropVolume() );
	} );
}

void CSceneTraverser::TraverseGrabber( const AvNode::Reader & node, CPendingTransform *defaultParent )
{
	if ( !node.hasPropVolume() )
	{
		return;
	}

	uint64_t globalId = GetGlobalId( node );
	updateTransform( globalId, defaultParent, glm::mat4( 1.f ),
		[this, node, globalId, currentHand = m_currentHand ]( const glm::mat4 & universeFromNode )
	{
		m_collisions.addGrabber( globalId, glm::inverse( universeFromNode ),
			node.getPropVolume(), m_renderer->isGrabPressed( currentHand ) );
	} );
}


void CSceneTraverser::startGrabImpl( uint64_t grabberGlobalId, uint64_t grabbableGlobalId )
{
	auto iGrabbable = m_lastFrameUniverseFromNode.find( grabbableGlobalId );
	if ( iGrabbable == m_lastFrameUniverseFromNode.end() )
	{
		assert( false );
		return;
	}
	glm::mat4 universeFromGrabbable = iGrabbable->second;

	auto iGrabber = m_lastFrameUniverseFromNode.find( grabberGlobalId );
	if ( iGrabber == m_lastFrameUniverseFromNode.end() )
	{
		assert( false );
		return;
	}
	glm::mat4 grabberFromUniverse = glm::inverse( iGrabber->second );

	glm::mat4 grabberFromGrabbable = grabberFromUniverse * universeFromGrabbable;
	m_nodeToNodeAnchors.insert_or_assign( grabbableGlobalId, NodeToNodeAnchor_t{ grabberGlobalId, grabberFromGrabbable } );
}

void CSceneTraverser::endGrabImpl( uint64_t grabberGlobalId, uint64_t grabbableGlobalId )
{
	m_nodeToNodeAnchors.erase( grabbableGlobalId );
}

CPendingTransform *CSceneTraverser::getTransform( uint64_t globalNodeId )
{
	auto i = m_nodeTransforms.find( globalNodeId );
	if ( i == m_nodeTransforms.end() )
	{
		auto newTransform = m_nodeTransforms.insert_or_assign( globalNodeId,
			std::make_unique<CPendingTransform>() );
		return newTransform.first->second.get();
	}
	else
	{
		return i->second.get();
	}
}

CPendingTransform *CSceneTraverser::updateTransform( uint64_t globalNodeId,
	CPendingTransform *parent, glm::mat4 parentFromNode,
	std::function<void( const glm::mat4 & universeFromNode )> applyFunction )
{
	CPendingTransform *transform = getTransform( globalNodeId );
	transform->update( parent, parentFromNode, applyFunction );
	return transform;
}

void CSceneTraverser::sendHapticEvent( uint64_t targetGlobalNodeId, float amplitude, float frequency, float duration )
{
	auto iHapticHand = m_handDeviceForNode.find( targetGlobalNodeId );
	if ( iHapticHand == m_handDeviceForNode.end() )
	{
		return;
	}

	m_renderer->sentHapticEventForHand( iHapticHand->second, amplitude, frequency, duration );
}


void CSceneTraverser::newSceneGraph( AvVisualFrame::Reader & newFrame )
{
	// if you're hitting this then you're probably waiting on something from
	// Cap'n Proto during traversal. Don't do that. It adds potentially unbounded
	// time to the frame
	assert( !m_inFrameTraversal );

	m_roots.clear();
	for ( auto & root : newFrame.getRoots() )
	{
		std::unique_ptr<SgRoot_t> rootStruct = std::make_unique<SgRoot_t>();
		rootStruct->root = tools::newOwnCapnp( root );
		rootStruct->nodes.reserve( root.getNodes().size() );
		rootStruct->gadgetId = root.getSourceId();
		rootStruct->hook = root.getHook();

		for ( auto & nodeWrapper : rootStruct->root.getNodes() )
		{
			auto node = nodeWrapper.getNode();
			rootStruct->mapIdToIndex[node.getId()] = rootStruct->nodes.size();
			rootStruct->nodes.push_back( node );
		}

		m_roots.push_back( std::move( rootStruct ) );
	}

	auto nextTextures = std::make_unique < std::map<uint32_t, tools::OwnCapnp< AvSharedTextureInfo > > >();
	for ( auto & texture : newFrame.getGadgetTextures() )
	{
		m_sharedTextureInfo.insert_or_assign( 
			texture.getGadgetId(), 
			tools::newOwnCapnp( texture.getSharedTextureInfo() ) );
	}
}


