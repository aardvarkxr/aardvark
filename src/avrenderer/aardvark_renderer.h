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

#define GLM_FORCE_RADIANS
#define GLM_FORCE_DEPTH_ZERO_TO_ONE
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>

#include "include/cef_sandbox_win.h"
#include "av_cef_app.h"
#include "av_cef_handler.h"
#include "uri_request_handler.h"
#include <aardvark/irenderer.h>

#include <aardvark/aardvark_scene_graph.h>


class IVrManager;
class VulkanExample;

class CVulkanRendererModelInstance : public IModelInstance
{
public:
	friend VulkanExample;

	CVulkanRendererModelInstance( VulkanExample *renderer, const std::string & uri, std::shared_ptr< vkglTF::Model > model );
	virtual void setUniverseFromModel( const glm::mat4 & universeFromModel ) override;
	virtual void setOverrideTexture( void *textureHandle, ETextureType type, ETextureFormat format,
		uint32_t width, uint32_t height ) override;
	virtual void setBaseColor( const glm::vec4 & color ) override;

	void animate( float animationTimeElapsed );
protected:
	VulkanExample *m_renderer;
	std::string m_modelUri;
	std::shared_ptr<vkglTF::Model> m_model;
	vkglTF::Transformable m_modelParent;

	void *m_lastDxgiHandle = nullptr;
	glm::vec4 m_lastBaseColor = { 0, 0, 0, 0 };
	std::shared_ptr< vks::Texture2D > m_overrideTexture;
};


class VulkanExample : public VulkanExampleBase, public IRenderer
{
	friend class CSceneListener;
	friend CVulkanRendererModelInstance;
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
	void UpdateDescriptorForScene( VkDescriptorSet descriptorSet,
		VkBuffer buffer, uint32_t bufferSize,
		VkBuffer paramsBuffer, uint32_t paramsBufferSize );
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

	std::shared_ptr<vkglTF::Model> VulkanExample::findOrLoadModel( std::string modelUri );

	glm::mat4 GetHMDMatrixProjectionEye( vr::Hmd_Eye nEye );

	glm::mat4 glmMatFromVrMat( const vr::HmdMatrix34_t & mat );
	glm::mat4 GetHMDMatrixPoseEye( vr::Hmd_Eye nEye );

	virtual void render();

	void submitEyeBuffers();

	// ----------- IRenderer implementation -------------
	virtual void init( HINSTANCE hInstance, IVrManager *vrManager ) override;
	virtual void runFrame( bool *shouldQuit, double frameTime ) override;
	virtual std::unique_ptr<IModelInstance> createModelInstance( const std::string & uri ) override;
	virtual void resetRenderList() override;
	virtual void addToRenderList( IModelInstance *modelInstance ) override;
	virtual void processRenderList() override;

protected:
	IVrManager *m_vrManager;

	bool m_updateDescriptors = false;

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

	uint32_t eyeWidth = 0;
	uint32_t eyeHeight = 0;
	glm::mat4 m_matProjection[2];
	glm::mat4 m_matEye[2];

	const uint32_t renderAhead = 2;
	uint32_t frameIndex = 0;

	bool animate = true;

	bool displayBackground = true;

	struct LightSource {
		glm::vec3 color = glm::vec3( 1.0f );
		glm::vec3 rotation = glm::vec3( 75.0f, 40.0f, 0.0f );
	} lightSource;

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

	CUriRequestHandler m_uriRequests;

	std::vector< CVulkanRendererModelInstance *> m_modelsToRender;

};
