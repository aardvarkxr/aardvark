#pragma once

#include <vector>
#include <map>
#include <set>
#include <filesystem>

#include <vulkan/vulkan.h>
#include "VulkanExampleBase.h"
#include "VulkanTexture.hpp"
#include "VulkanglTFModel.hpp"
#include "VulkanUtils.hpp"
#include "ui.hpp"

#define GLM_FORCE_RADIANS
#define GLM_FORCE_DEPTH_ZERO_TO_ONE
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>

#include "aardvark.capnp.h"

#include "include/cef_sandbox_win.h"
#include "av_cef_app.h"
#include "av_cef_handler.h"
#include "intersection_tester.h"
#include "collision_tester.h"
#include "pending_transform.h"
#include "uri_request_handler.h"

#include <tools/capnprototools.h>

#include <aardvark/aardvark_server.h>
#include <aardvark/aardvark_client.h>
#include <aardvark/aardvark_scene_graph.h>


class VulkanExample : public VulkanExampleBase, public IApplication, public AvFrameListener::Server
{
	friend class CSceneListener;
public:
	enum class EEye
	{
		Left,
		Right,
		Mirror
	};

	VulkanExample();
	~VulkanExample() noexcept;

	void renderNode( std::shared_ptr<vkglTF::Model> pModel, std::shared_ptr<vkglTF::Node> node, uint32_t cbIndex, vkglTF::Material::AlphaMode alphaMode, EEye eEye );

	void recordCommandBuffers( uint32_t cbIndex );
	void renderSceneToTarget( uint32_t cbIndex, vks::RenderTarget target, uint32_t targetWidth, uint32_t targetHeight, EEye eEye );

	void renderScene( uint32_t cbIndex, VkRenderPass targetRenderPass, VkFramebuffer targetFrameBuffer, uint32_t targetWidth, uint32_t targetHeight, EEye eEye );

	void recordCommandsForModels( VkCommandBuffer currentCB, uint32_t i, vkglTF::Material::AlphaMode eAlphaMode, EEye eEye );
	void loadEnvironment( std::string filename );

	vkglTF::Model m_skybox;

	void loadAssets();
	void UpdateDescriptorForScene( VkDescriptorSet descriptorSet, VkBuffer buffer, uint32_t bufferSize );
	void setupDescriptors();
	void setupDescriptorSetsForModel( std::shared_ptr<vkglTF::Model> pModel );
	void preparePipelines();
	void generateBRDFLUT();
	void generateCubemaps();
	void prepareUniformBuffers();
	void updateUniformBuffers();
	void updateParams();
	void windowResized();

	void prepare();

	virtual void onWindowClose() override;
	virtual void allBrowsersClosed() override;

	void TraverseSceneGraphs( float fFrameTime );

	uint64_t GetGlobalId( const AvNode::Reader & node );

	void TraverseNode( const AvNode::Reader & node, CPendingTransform *defaultParent );
	void TraverseOrigin( const AvNode::Reader & node, CPendingTransform *defaultParent );

	void setHookOrigin( std::string origin, const AvNode::Reader & node );

	void TraverseTransform( const AvNode::Reader & node, CPendingTransform *defaultParent );
	void TraverseModel( const AvNode::Reader & node, CPendingTransform *defaultParent );
	void TraversePanel( const AvNode::Reader & node, CPendingTransform *defaultParent );
	void TraversePoker( const AvNode::Reader & node, CPendingTransform *defaultParent );
	void TraverseGrabbable( const AvNode::Reader & node, CPendingTransform *defaultParent );
	void TraverseHandle( const AvNode::Reader & node, CPendingTransform *defaultParent );
	void TraverseGrabber( const AvNode::Reader & node, CPendingTransform *defaultParent );

	void applyFrame( AvVisualFrame::Reader & newFrame );
	void sendHapticEvent( uint64_t targetGlobalNodeId, float amplitude, float frequency, float duration );
	std::shared_ptr<vkglTF::Model> VulkanExample::findOrLoadModel( std::string modelUri );

	void updateOverlay();

	glm::mat4 GetHMDMatrixProjectionEye( vr::Hmd_Eye nEye );

	glm::mat4 glmMatFromVrMat( const vr::HmdMatrix34_t & mat );
	glm::mat4 GetHMDMatrixPoseEye( vr::Hmd_Eye nEye );

	virtual void render();

	void submitEyeBuffers();

	void doInputWork();
	bool isGrabPressed( vr::VRInputValueHandle_t whichHand );

	void startGrabImpl( uint64_t grabberGlobalId, uint64_t grabbableGlobalId );
	void endGrabImpl( uint64_t grabberGlobalId, uint64_t grabbableGlobalId );

protected:
	aardvark::CAardvarkClient *m_pClient;

	CPendingTransform *getTransform( uint64_t globalNodeId );
	CPendingTransform *updateTransform( uint64_t globalNodeId, CPendingTransform *parent, 
		glm::mat4 parentFromNode, std::function<void( const glm::mat4 & universeFromNode )> applyFunction );

	vr::VRActionSetHandle_t m_actionSet = vr::k_ulInvalidActionSetHandle;
	vr::VRActionHandle_t m_actionGrab = vr::k_ulInvalidActionHandle;
	vr::VRActionHandle_t m_actionHaptic = vr::k_ulInvalidActionHandle;
	vr::VRInputValueHandle_t m_leftHand = vr::k_ulInvalidInputValueHandle;
	vr::VRInputValueHandle_t m_rightHand = vr::k_ulInvalidInputValueHandle;
	bool m_leftPressed = false;
	bool m_rightPressed = false;

	struct SgRoot_t
	{
		std::unordered_map<uint32_t, size_t> mapIdToIndex;
		tools::OwnCapnp<AvNodeRoot> root = nullptr;
		std::vector<AvNode::Reader> nodes;
		std::string hook;
		uint32_t gadgetId;
	};

	struct SgNodeData_t
	{
		std::string lastModelUri;
		std::shared_ptr<vkglTF::Model> model;
		vkglTF::Transformable modelParent;

		void *lastDxgiHandle = nullptr;
		std::shared_ptr< vks::Texture2D > overrideTexture;
	};

	SgNodeData_t *GetNodeData( const AvNode::Reader & node );

	void TraverseSceneGraph( const SgRoot_t *root );

	std::unique_ptr< std::vector<std::unique_ptr< SgRoot_t > > > m_roots, m_nextRoots;
	bool inFrameTraversal = false;
	bool m_updateDescriptors = false;

	std::unique_ptr< std::map< uint32_t, tools::OwnCapnp< AvSharedTextureInfo > > > m_sharedTextureInfo, m_nextSharedTextureInfo;
	std::map<uint64_t, vr::VRInputValueHandle_t> m_handDeviceForNode;

	const SgRoot_t *m_pCurrentRoot = nullptr;
	std::unordered_map<std::string, glm::mat4> m_universeFromOriginTransforms;
	std::unordered_map<uint64_t, std::unique_ptr<SgNodeData_t>> m_mapNodeData;
	float m_fThisFrameTime = 0;
	std::vector<std::shared_ptr<vkglTF::Model>> m_vecModelsToRender;
	std::set<uint64_t> setVisitedNodes;
	vr::VRInputValueHandle_t m_currentHandDevice = vr::k_ulInvalidInputValueHandle;
	std::unordered_map<uint64_t, glm::mat4> m_lastFrameUniverseFromNode;
	uint64_t m_currentGrabbableGlobalId = 0;

	CIntersectionTester m_intersections;
	CCollisionTester m_collisions;

	struct Textures {
		vks::TextureCubeMap environmentCube;
		vks::Texture2D empty;
		vks::Texture2D lutBrdf;
		vks::TextureCubeMap irradianceCube;
		vks::TextureCubeMap prefilteredCube;
	} textures;

	struct UniformBufferSet {
		Buffer scene;
		Buffer skybox;
		Buffer params;
		Buffer leftEye;
		Buffer rightEye;
	};

	struct UBOMatrices {
		glm::mat4 matProjectionFromView;
		glm::mat4 matHmdFromStage;
		glm::mat4 matViewFromHmd;
		glm::vec3 camPos;
	} shaderValuesScene, shaderValuesSkybox, shaderValuesLeftEye, shaderValuesRightEye;

	struct shaderValuesParams {
		glm::vec4 lightDir;
		float exposure = 4.5f;
		float gamma = 2.2f;
		float prefilteredCubeMipLevels;
		float scaleIBLAmbient = 1.0f;
		float debugViewInputs = 1;
		float debugViewEquation = 0;
	} shaderValuesParams;

	VkPipelineLayout pipelineLayout;

	struct Pipelines {
		VkPipeline skybox;
		VkPipeline pbr;
		VkPipeline pbrAlphaBlend;
	} pipelines;

	struct DescriptorSets {
		vks::CDescriptorSet *scene;
		vks::CDescriptorSet *skybox;
		vks::CDescriptorSet *eye[2];
	};
	std::vector<DescriptorSets> descriptorSets;


	std::vector<VkCommandBuffer> commandBuffers;
	std::vector<UniformBufferSet> uniformBuffers;

	std::vector<VkFence> waitFences;
	std::vector<VkSemaphore> renderCompleteSemaphores;
	std::vector<VkSemaphore> presentCompleteSemaphores;

	std::unordered_map < std::string, std::shared_ptr< vkglTF::Model > > m_mapModels;
	std::set< std::string > m_modelRequestsInProgress;
	std::set< std::string > m_failedModelRequests;
	vks::RenderTarget leftEyeRT;
	vks::RenderTarget rightEyeRT;
	std::unordered_map< uint64_t, std::unique_ptr< CPendingTransform > > m_nodeTransforms;

	uint32_t eyeWidth = 0;
	uint32_t eyeHeight = 0;
	glm::mat4 m_matProjection[2];
	glm::mat4 m_matEye[2];
	glm::mat4 m_hmdFromUniverse;

	const uint32_t renderAhead = 2;
	uint32_t frameIndex = 0;

	bool animate = true;

	bool displayBackground = true;

	struct LightSource {
		glm::vec3 color = glm::vec3( 1.0f );
		glm::vec3 rotation = glm::vec3( 75.0f, 40.0f, 0.0f );
	} lightSource;

	UI *ui;

#if defined(VK_USE_PLATFORM_ANDROID_KHR)
	const std::string assetpath = "";
#else
	const std::string assetpath = std::string( VK_EXAMPLE_DATA_DIR ) + "/";
#endif

	bool rotateModel = false;
	glm::vec3 modelrot = glm::vec3( 0.0f );
	glm::vec3 modelPos = glm::vec3( 0.0f );

	enum PBRWorkflows
	{
		PBR_WORKFLOW_METALLIC_ROUGHNESS = 0,
		PBR_WORKFLOW_SPECULAR_GLOSINESS = 1,
		PBR_WORKFLOW_UNLIT = 2,
	};

	struct PushConstBlockMaterial
	{
		glm::vec4 baseColorFactor;
		glm::vec4 emissiveFactor;
		glm::vec4 diffuseFactor;
		glm::vec4 specularFactor;
		float workflow;
		int colorTextureSet;
		int PhysicalDescriptorTextureSet;
		int normalTextureSet;
		int occlusionTextureSet;
		int emissiveTextureSet;
		float metallicFactor;
		float roughnessFactor;
		float alphaMask;
		float alphaMaskCutoff;
		float padding[2]; // the vertex shader push constants need to be 16 byte aligned
	};

	struct PushConstBlockVertex
	{
		glm::vec4 uvScaleAndOffset;
	};

	std::map<std::string, std::string> environments;
	std::string selectedEnvironment = "papermill";

	int32_t debugViewInputs = 0;
	int32_t debugViewEquation = 0;

	struct NodeToNodeAnchor_t
	{
		uint64_t parentNodeId;
		glm::mat4 parentNodeFromThisNode;
	};
	std::unordered_map<uint64_t, NodeToNodeAnchor_t> m_nodeToNodeAnchors;

	CUriRequestHandler m_uriRequests;
};
