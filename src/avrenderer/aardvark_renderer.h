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

#include <tools/capnprototools.h>

#include <aardvark/aardvark_apps.h>
#include <aardvark/aardvark_server.h>
#include <aardvark/aardvark_client.h>
#include <aardvark/aardvark_scene_graph.h>

class AvFrameListenerImpl final : public AvFrameListener::Server
{
public:
	AvFrameListenerImpl( std::function<void( AvVisualFrame::Reader )> fn )
	{
		m_fn = fn;
	}

	virtual ::kj::Promise<void> newFrame( NewFrameContext context ) override
	{
		m_fn( context.getParams().getFrame() );
		return kj::READY_NOW;
	}

protected:

private:
	std::function<void( AvVisualFrame::Reader )> m_fn;
};

class VulkanExample : public VulkanExampleBase, public IApplication
{
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

	kj::Own< AvFrameListenerImpl > m_frameListener;

	void prepare();

	virtual void onWindowClose() override;
	virtual void allBrowsersClosed() override;

	void TraverseSceneGraphs( float fFrameTime );

	uint64_t GetGlobalId( const AvNode::Reader & node );



	void ConcatTransform( const glm::mat4 & matParentFromNode );

	void PushTransform( const glm::mat4 & matUniverseFromNode );
	const glm::mat4 & GetCurrentNodeFromUniverse();

	void TraverseNode( const AvNode::Reader & node );
	void TraverseOrigin( const AvNode::Reader & node );
	void TraverseTransform( const AvNode::Reader & node );
	void TraverseModel( const AvNode::Reader & node );
	void TraversePanel( const AvNode::Reader & node );
	void TraversePoker( const AvNode::Reader & node );

	void applyFrame( AvVisualFrame::Reader & newFrame );
	std::shared_ptr<vkglTF::Model> findOrLoadModel( AvModelSource::Client & source );

	void updateOverlay();

	glm::mat4 GetHMDMatrixProjectionEye( vr::Hmd_Eye nEye );

	glm::mat4 glmMatFromVrMat( const vr::HmdMatrix34_t & mat );
	glm::mat4 GetHMDMatrixPoseEye( vr::Hmd_Eye nEye );

	virtual void render();

	void submitEyeBuffers();

	struct SgRoot_t
	{
		std::unordered_map<uint32_t, size_t> mapIdToIndex;
		tools::OwnCapnp<AvNodeRoot> root = nullptr;
		std::vector<AvNode::Reader> nodes;
		uint32_t appId;
	};

	struct SgNodeData_t
	{
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


	const SgRoot_t *m_pCurrentRoot = nullptr;
	std::vector<glm::mat4> m_vecTransforms;
	bool m_bThisNodePushedTransform = false;
	std::unordered_map<std::string, glm::mat4> m_mapOriginFromUniverseTransforms;
	std::unordered_map<uint64_t, std::unique_ptr<SgNodeData_t>> m_mapNodeData;
	float m_fThisFrameTime = 0;
	std::vector<std::shared_ptr<vkglTF::Model>> m_vecModelsToRender;
	std::set<uint64_t> setVisitedNodes;

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

	aardvark::CServerThread m_serverThread;
	kj::Own<aardvark::CAardvarkClient> m_pClient;
	std::unordered_map < std::string, std::shared_ptr< vkglTF::Model > > m_mapModels;
	vks::RenderTarget leftEyeRT;
	vks::RenderTarget rightEyeRT;

	uint32_t eyeWidth = 0;
	uint32_t eyeHeight = 0;
	glm::mat4 m_matProjection[2];
	glm::mat4 m_matEye[2];
	glm::mat4 m_matHmdFromStage;

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


};
