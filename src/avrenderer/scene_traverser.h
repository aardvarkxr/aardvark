#pragma once

#include <vector>
#include <map>
#include <set>

#include <aardvark/aardvark_server.h>
#include <aardvark/aardvark_client.h>
#include <aardvark/aardvark_scene_graph.h>

#include <tools/capnprototools.h>

#include "intersection_tester.h"
#include "collision_tester.h"
#include "pending_transform.h"
#include "irenderer.h"
#include "ivrmanager.h"

#define GLM_FORCE_RADIANS
#define GLM_FORCE_DEPTH_ZERO_TO_ONE
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>

struct SgRoot_t
{
	std::unordered_map<uint32_t, size_t> mapIdToIndex;
	tools::OwnCapnp<AvNodeRoot> root = nullptr;
	std::vector<AvNode::Reader> nodes;
	std::string hook;
	uint32_t gadgetId;
};


class IVrManager;

class CSceneTraverser
{
public:
	void init( IRenderer *renderer, IVrManager *vrManager, aardvark::CAardvarkClient *client );
	void cleanup();


	void newSceneGraph( AvVisualFrame::Reader & newFrame );
	void TraverseSceneGraphs();


	uint64_t GetGlobalId( const AvNode::Reader & node );

	void setHookOrigin( std::string origin, const AvNode::Reader & node );

	void TraverseNode( const AvNode::Reader & node, CPendingTransform *defaultParent );
	void TraverseOrigin( const AvNode::Reader & node, CPendingTransform *defaultParent );
	void TraverseTransform( const AvNode::Reader & node, CPendingTransform *defaultParent );
	void TraverseModel( const AvNode::Reader & node, CPendingTransform *defaultParent );
	void TraversePanel( const AvNode::Reader & node, CPendingTransform *defaultParent );
	void TraversePoker( const AvNode::Reader & node, CPendingTransform *defaultParent );
	void TraverseGrabbable( const AvNode::Reader & node, CPendingTransform *defaultParent );
	void TraverseHandle( const AvNode::Reader & node, CPendingTransform *defaultParent );
	void TraverseGrabber( const AvNode::Reader & node, CPendingTransform *defaultParent );

	void startGrabImpl( uint64_t grabberGlobalId, uint64_t grabbableGlobalId );
	void endGrabImpl( uint64_t grabberGlobalId, uint64_t grabbableGlobalId );

	CPendingTransform *getTransform( uint64_t globalNodeId );
	CPendingTransform *updateTransform( uint64_t globalNodeId, CPendingTransform *parent,
		glm::mat4 parentFromNode, std::function<void( const glm::mat4 & universeFromNode )> applyFunction );

	void sendHapticEvent( uint64_t targetGlobalNodeId, float amplitude, float frequency, float duration );

	struct SgNodeData_t
	{
		std::string lastModelUri;
		std::shared_ptr<IModelInstance> model;
	};
	SgNodeData_t *GetNodeData( const AvNode::Reader & node );

	void TraverseSceneGraph( const SgRoot_t *root );

	bool m_inFrameTraversal = false;
	std::vector<std::unique_ptr< SgRoot_t > > m_roots;
	std::map< uint32_t, tools::OwnCapnp< AvSharedTextureInfo > > m_sharedTextureInfo;

	const SgRoot_t *m_pCurrentRoot = nullptr;
	std::unordered_map<uint64_t, std::unique_ptr<SgNodeData_t>> m_mapNodeData;
	std::set<uint64_t> setVisitedNodes;
	EHand m_currentHand = EHand::Invalid;
	std::unordered_map<uint64_t, glm::mat4> m_lastFrameUniverseFromNode;
	uint64_t m_currentGrabbableGlobalId = 0;
	std::map<uint64_t, EHand> m_handDeviceForNode;

	CIntersectionTester m_intersections;
	CCollisionTester m_collisions;

	std::unordered_map< uint64_t, std::unique_ptr< CPendingTransform > > m_nodeTransforms;

	IRenderer *m_renderer = nullptr;
	IVrManager *m_vrManager = nullptr;
	aardvark::CAardvarkClient *m_client = nullptr;

	struct NodeToNodeAnchor_t
	{
		uint64_t parentNodeId;
		glm::mat4 parentNodeFromThisNode;
	};
	std::unordered_map<uint64_t, NodeToNodeAnchor_t> m_nodeToNodeAnchors;


};