/*
* Vulkan glTF model and texture loading class based on tinyglTF (https://github.com/syoyo/tinygltf)
*
* Copyright (C) 2018 by Sascha Willems - www.saschawillems.de
*
* This code is licensed under the MIT license (MIT) (http://opensource.org/licenses/MIT)
*/

#pragma once

#include <stdlib.h>
#include <string>
#include <fstream>
#include <vector>
#include <memory>

#include "vulkan/vulkan.h"
#include "VulkanDevice.hpp"

#define GLM_FORCE_RADIANS
#define GLM_FORCE_DEPTH_ZERO_TO_ONE
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>
#include <gli/gli.hpp>
#include <glm/gtx/string_cast.hpp>
#include <glm/gtx/spline.hpp>


// ERROR is already defined in wingdi.h and collides with a define in the Draco headers
#if defined(_WIN32) && defined(ERROR) && defined(TINYGLTF_ENABLE_DRACO) 
#undef ERROR
#pragma message ("ERROR constant already defined, undefining")
#endif

#define TINYGLTF_IMPLEMENTATION
#define TINYGLTF_NO_STB_IMAGE_WRITE
#define STB_IMAGE_IMPLEMENTATION
#define STBI_MSC_SECURE_CRT
#include "tiny_gltf.h"

#if defined(__ANDROID__)
#include <android/asset_manager.h>
#endif

// Changing this value here also requires changing it in the vertex shader
#define MAX_NUM_JOINTS 128u

namespace vkglTF
{
	struct Node;

	struct BoundingBox {
		glm::vec3 min;
		glm::vec3 max;
		bool valid = false;
		BoundingBox() {};
		BoundingBox(glm::vec3 min, glm::vec3 max) : min(min), max(max) {}
		BoundingBox getAABB(glm::mat4 m) {
			glm::vec3 min = glm::vec3(m[3]);
			glm::vec3 max = min;
			glm::vec3 v0, v1;
			
			glm::vec3 right = glm::vec3(m[0]);
			v0 = right * this->min.x;
			v1 = right * this->max.x;
			min += glm::min(v0, v1);
			max += glm::max(v0, v1);

			glm::vec3 up = glm::vec3(m[1]);
			v0 = up * this->min.y;
			v1 = up * this->max.y;
			min += glm::min(v0, v1);
			max += glm::max(v0, v1);

			glm::vec3 back = glm::vec3(m[2]);
			v0 = back * this->min.z;
			v1 = back * this->max.z;
			min += glm::min(v0, v1);
			max += glm::max(v0, v1);

			return BoundingBox(min, max);
		}
	};

	/*
		glTF texture sampler		
	*/
	struct TextureSampler {
		VkFilter magFilter;
		VkFilter minFilter;
		VkSamplerAddressMode addressModeU;
		VkSamplerAddressMode addressModeV;
		VkSamplerAddressMode addressModeW;
	};

	/*
		glTF texture loading class
	*/
	struct Texture {
		vks::VulkanDevice *device;
		VkImage image;
		VkImageLayout imageLayout;
		VkDeviceMemory deviceMemory;
		VkImageView view;
		uint32_t width, height;
		uint32_t mipLevels;
		uint32_t layerCount;
		VkDescriptorImageInfo descriptor;
		VkSampler sampler;

		void updateDescriptor()
		{
			descriptor.sampler = sampler;
			descriptor.imageView = view;
			descriptor.imageLayout = imageLayout;
		}

		~Texture()
		{
			vkDestroyImageView(device->logicalDevice, view, nullptr);
			vkDestroyImage(device->logicalDevice, image, nullptr);
			vkFreeMemory(device->logicalDevice, deviceMemory, nullptr);
			vkDestroySampler(device->logicalDevice, sampler, nullptr);
		}

		/*
			Load a texture from a glTF image (stored as vector of chars loaded via stb_image)
			Also generates the mip chain as glTF images are stored as jpg or png without any mips
		*/
		void fromglTfImage(tinygltf::Image &gltfimage, TextureSampler textureSampler, vks::VulkanDevice *device, VkQueue copyQueue)
		{
			this->device = device;

			unsigned char* buffer = nullptr;
			VkDeviceSize bufferSize = 0;
			bool deleteBuffer = false;
			if (gltfimage.component == 3) {
				// Most devices don't support RGB only on Vulkan so convert if necessary
				// TODO: Check actual format support and transform only if required
				bufferSize = gltfimage.width * gltfimage.height * 4;
				buffer = new unsigned char[bufferSize];
				unsigned char* rgba = buffer;
				unsigned char* rgb = &gltfimage.image[0];
				for (int32_t i = 0; i< gltfimage.width * gltfimage.height; ++i) {
					for (int32_t j = 0; j < 3; ++j) {
						rgba[j] = rgb[j];
					}
					rgba += 4;
					rgb += 3;
				}
				deleteBuffer = true;
			}
			else {
				buffer = &gltfimage.image[0];
				bufferSize = gltfimage.image.size();
			}

			VkFormat format = VK_FORMAT_R8G8B8A8_UNORM;

			VkFormatProperties formatProperties;

			width = gltfimage.width;
			height = gltfimage.height;
			mipLevels = static_cast<uint32_t>(floor(log2(std::max(width, height))) + 1.0);

			vkGetPhysicalDeviceFormatProperties(device->physicalDevice, format, &formatProperties);
			assert(formatProperties.optimalTilingFeatures & VK_FORMAT_FEATURE_BLIT_SRC_BIT);
			assert(formatProperties.optimalTilingFeatures & VK_FORMAT_FEATURE_BLIT_DST_BIT);

			VkMemoryAllocateInfo memAllocInfo{};
			memAllocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;
			VkMemoryRequirements memReqs{};

			VkBuffer stagingBuffer;
			VkDeviceMemory stagingMemory;

			VkBufferCreateInfo bufferCreateInfo{};
			bufferCreateInfo.sType = VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO;
			bufferCreateInfo.size = bufferSize;
			bufferCreateInfo.usage = VK_BUFFER_USAGE_TRANSFER_SRC_BIT;
			bufferCreateInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;
			VK_CHECK_RESULT(vkCreateBuffer(device->logicalDevice, &bufferCreateInfo, nullptr, &stagingBuffer));
			vkGetBufferMemoryRequirements(device->logicalDevice, stagingBuffer, &memReqs);
			memAllocInfo.allocationSize = memReqs.size;
			memAllocInfo.memoryTypeIndex = device->getMemoryType(memReqs.memoryTypeBits, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT);
			VK_CHECK_RESULT(vkAllocateMemory(device->logicalDevice, &memAllocInfo, nullptr, &stagingMemory));
			VK_CHECK_RESULT(vkBindBufferMemory(device->logicalDevice, stagingBuffer, stagingMemory, 0));

			uint8_t *data;
			VK_CHECK_RESULT(vkMapMemory(device->logicalDevice, stagingMemory, 0, memReqs.size, 0, (void **)&data));
			memcpy(data, buffer, bufferSize);
			vkUnmapMemory(device->logicalDevice, stagingMemory);

			VkImageCreateInfo imageCreateInfo{};
			imageCreateInfo.sType = VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO;
			imageCreateInfo.imageType = VK_IMAGE_TYPE_2D;
			imageCreateInfo.format = format;
			imageCreateInfo.mipLevels = mipLevels;
			imageCreateInfo.arrayLayers = 1;
			imageCreateInfo.samples = VK_SAMPLE_COUNT_1_BIT;
			imageCreateInfo.tiling = VK_IMAGE_TILING_OPTIMAL;
			imageCreateInfo.usage = VK_IMAGE_USAGE_SAMPLED_BIT;
			imageCreateInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;
			imageCreateInfo.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
			imageCreateInfo.extent = { width, height, 1 };
			imageCreateInfo.usage = VK_IMAGE_USAGE_TRANSFER_DST_BIT | VK_IMAGE_USAGE_TRANSFER_SRC_BIT | VK_IMAGE_USAGE_SAMPLED_BIT;
			VK_CHECK_RESULT(vkCreateImage(device->logicalDevice, &imageCreateInfo, nullptr, &image));
			vkGetImageMemoryRequirements(device->logicalDevice, image, &memReqs);
			memAllocInfo.allocationSize = memReqs.size;
			memAllocInfo.memoryTypeIndex = device->getMemoryType(memReqs.memoryTypeBits, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT);
			VK_CHECK_RESULT(vkAllocateMemory(device->logicalDevice, &memAllocInfo, nullptr, &deviceMemory));
			VK_CHECK_RESULT(vkBindImageMemory(device->logicalDevice, image, deviceMemory, 0));

			VkCommandBuffer copyCmd = device->createCommandBuffer(VK_COMMAND_BUFFER_LEVEL_PRIMARY, true);

			VkImageSubresourceRange subresourceRange = {};
			subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
			subresourceRange.levelCount = 1;
			subresourceRange.layerCount = 1;

			{
				VkImageMemoryBarrier imageMemoryBarrier{};
				imageMemoryBarrier.sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER;
				imageMemoryBarrier.oldLayout = VK_IMAGE_LAYOUT_UNDEFINED;
				imageMemoryBarrier.newLayout = VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL;
				imageMemoryBarrier.srcAccessMask = 0;
				imageMemoryBarrier.dstAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;
				imageMemoryBarrier.image = image;
				imageMemoryBarrier.subresourceRange = subresourceRange;
				vkCmdPipelineBarrier(copyCmd, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, 0, 0, nullptr, 0, nullptr, 1, &imageMemoryBarrier);
			}

			VkBufferImageCopy bufferCopyRegion = {};
			bufferCopyRegion.imageSubresource.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
			bufferCopyRegion.imageSubresource.mipLevel = 0;
			bufferCopyRegion.imageSubresource.baseArrayLayer = 0;
			bufferCopyRegion.imageSubresource.layerCount = 1;
			bufferCopyRegion.imageExtent.width = width;
			bufferCopyRegion.imageExtent.height = height;
			bufferCopyRegion.imageExtent.depth = 1;

			vkCmdCopyBufferToImage(copyCmd, stagingBuffer, image, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL, 1, &bufferCopyRegion);

			{
				VkImageMemoryBarrier imageMemoryBarrier{};
				imageMemoryBarrier.sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER;
				imageMemoryBarrier.oldLayout = VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL;
				imageMemoryBarrier.newLayout = VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL;
				imageMemoryBarrier.srcAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;
				imageMemoryBarrier.dstAccessMask = VK_ACCESS_TRANSFER_READ_BIT;
				imageMemoryBarrier.image = image;
				imageMemoryBarrier.subresourceRange = subresourceRange;
				vkCmdPipelineBarrier(copyCmd, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, 0, 0, nullptr, 0, nullptr, 1, &imageMemoryBarrier);
			}

			device->flushCommandBuffer(copyCmd, copyQueue, true);

			vkFreeMemory(device->logicalDevice, stagingMemory, nullptr);
			vkDestroyBuffer(device->logicalDevice, stagingBuffer, nullptr);

			// Generate the mip chain (glTF uses jpg and png, so we need to create this manually)
			VkCommandBuffer blitCmd = device->createCommandBuffer(VK_COMMAND_BUFFER_LEVEL_PRIMARY, true);
			for (uint32_t i = 1; i < mipLevels; i++) {
				VkImageBlit imageBlit{};

				imageBlit.srcSubresource.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
				imageBlit.srcSubresource.layerCount = 1;
				imageBlit.srcSubresource.mipLevel = i - 1;
				imageBlit.srcOffsets[1].x = int32_t(width >> (i - 1));
				imageBlit.srcOffsets[1].y = int32_t(height >> (i - 1));
				imageBlit.srcOffsets[1].z = 1;

				imageBlit.dstSubresource.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
				imageBlit.dstSubresource.layerCount = 1;
				imageBlit.dstSubresource.mipLevel = i;
				imageBlit.dstOffsets[1].x = int32_t(width >> i);
				imageBlit.dstOffsets[1].y = int32_t(height >> i);
				imageBlit.dstOffsets[1].z = 1;

				VkImageSubresourceRange mipSubRange = {};
				mipSubRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
				mipSubRange.baseMipLevel = i;
				mipSubRange.levelCount = 1;
				mipSubRange.layerCount = 1;

				{
					VkImageMemoryBarrier imageMemoryBarrier{};
					imageMemoryBarrier.sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER;
					imageMemoryBarrier.oldLayout = VK_IMAGE_LAYOUT_UNDEFINED;
					imageMemoryBarrier.newLayout = VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL;
					imageMemoryBarrier.srcAccessMask = 0;
					imageMemoryBarrier.dstAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;
					imageMemoryBarrier.image = image;
					imageMemoryBarrier.subresourceRange = mipSubRange;
					vkCmdPipelineBarrier(blitCmd, VK_PIPELINE_STAGE_TRANSFER_BIT, VK_PIPELINE_STAGE_TRANSFER_BIT, 0, 0, nullptr, 0, nullptr, 1, &imageMemoryBarrier);
				}

				vkCmdBlitImage(blitCmd, image, VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL, image, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL, 1, &imageBlit, VK_FILTER_LINEAR);

				{
					VkImageMemoryBarrier imageMemoryBarrier{};
					imageMemoryBarrier.sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER;
					imageMemoryBarrier.oldLayout = VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL;
					imageMemoryBarrier.newLayout = VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL;
					imageMemoryBarrier.srcAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;
					imageMemoryBarrier.dstAccessMask = VK_ACCESS_TRANSFER_READ_BIT;
					imageMemoryBarrier.image = image;
					imageMemoryBarrier.subresourceRange = mipSubRange;
					vkCmdPipelineBarrier(blitCmd, VK_PIPELINE_STAGE_TRANSFER_BIT, VK_PIPELINE_STAGE_TRANSFER_BIT, 0, 0, nullptr, 0, nullptr, 1, &imageMemoryBarrier);
				}
			}

			subresourceRange.levelCount = mipLevels;
			imageLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;

			{
				VkImageMemoryBarrier imageMemoryBarrier{};
				imageMemoryBarrier.sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER;
				imageMemoryBarrier.oldLayout = VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL;
				imageMemoryBarrier.newLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
				imageMemoryBarrier.srcAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;
				imageMemoryBarrier.dstAccessMask = VK_ACCESS_TRANSFER_READ_BIT;
				imageMemoryBarrier.image = image;
				imageMemoryBarrier.subresourceRange = subresourceRange;
				vkCmdPipelineBarrier(blitCmd, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, 0, 0, nullptr, 0, nullptr, 1, &imageMemoryBarrier);
			}

			device->flushCommandBuffer(blitCmd, copyQueue, true);

			VkSamplerCreateInfo samplerInfo{};
			samplerInfo.sType = VK_STRUCTURE_TYPE_SAMPLER_CREATE_INFO;
			samplerInfo.magFilter = textureSampler.magFilter;
			samplerInfo.minFilter = textureSampler.minFilter;
			samplerInfo.mipmapMode = VK_SAMPLER_MIPMAP_MODE_LINEAR;
			samplerInfo.addressModeU = textureSampler.addressModeU;
			samplerInfo.addressModeV = textureSampler.addressModeV;
			samplerInfo.addressModeW = textureSampler.addressModeW;
			samplerInfo.compareOp = VK_COMPARE_OP_NEVER;
			samplerInfo.borderColor = VK_BORDER_COLOR_FLOAT_OPAQUE_WHITE;
			samplerInfo.maxAnisotropy = 1.0;
			samplerInfo.anisotropyEnable = VK_FALSE;
			samplerInfo.maxLod = (float)mipLevels;
			samplerInfo.maxAnisotropy = 8.0f;
			samplerInfo.anisotropyEnable = VK_TRUE;
			VK_CHECK_RESULT(vkCreateSampler(device->logicalDevice, &samplerInfo, nullptr, &sampler));

			VkImageViewCreateInfo viewInfo{};
			viewInfo.sType = VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;
			viewInfo.image = image;
			viewInfo.viewType = VK_IMAGE_VIEW_TYPE_2D;
			viewInfo.format = format;
			viewInfo.components = { VK_COMPONENT_SWIZZLE_R, VK_COMPONENT_SWIZZLE_G, VK_COMPONENT_SWIZZLE_B, VK_COMPONENT_SWIZZLE_A };
			viewInfo.subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
			viewInfo.subresourceRange.layerCount = 1;
			viewInfo.subresourceRange.levelCount = mipLevels;
			VK_CHECK_RESULT(vkCreateImageView(device->logicalDevice, &viewInfo, nullptr, &view));

			descriptor.sampler = sampler;
			descriptor.imageView = view;
			descriptor.imageLayout = imageLayout;

			if (deleteBuffer)
				delete[] buffer;

		}
	};

	/*
		glTF material class
	*/
	struct Material {		
		enum AlphaMode{ ALPHAMODE_OPAQUE, ALPHAMODE_MASK, ALPHAMODE_BLEND };
		AlphaMode alphaMode = ALPHAMODE_OPAQUE;
		float alphaCutoff = 1.0f;
		float metallicFactor = 1.0f;
		float roughnessFactor = 1.0f;
		glm::vec4 baseColorFactor = glm::vec4(1.0f);
		glm::vec4 emissiveFactor = glm::vec4(1.0f);
		std::shared_ptr<vkglTF::Texture> baseColorTexture;
		std::shared_ptr<vkglTF::Texture> metallicRoughnessTexture;
		std::shared_ptr<vkglTF::Texture> normalTexture;
		std::shared_ptr<vkglTF::Texture> occlusionTexture;
		std::shared_ptr<vkglTF::Texture> emissiveTexture;
		struct TexCoordSets {
			uint8_t baseColor = 0;
			uint8_t metallicRoughness = 0;
			uint8_t specularGlossiness = 0;
			uint8_t normal = 0;
			uint8_t occlusion = 0;
			uint8_t emissive = 0;
		} texCoordSets;
		struct Extension {
			std::shared_ptr < vkglTF::Texture> specularGlossinessTexture;
			std::shared_ptr < vkglTF::Texture> diffuseTexture;
			glm::vec4 diffuseFactor = glm::vec4(1.0f);
			glm::vec3 specularFactor = glm::vec3(0.0f);
		} extension;
		struct PbrWorkflows {
			bool metallicRoughness = true;
			bool specularGlossiness = false;
		} pbrWorkflows;
		VkDescriptorSet descriptorSet = VK_NULL_HANDLE;
	};

	/*
		glTF primitive
	*/
	struct Primitive {
		uint32_t firstIndex;
		uint32_t indexCount;
		uint32_t vertexCount;
		Material &material;
		bool hasIndices;

		BoundingBox bb;

		Primitive(uint32_t firstIndex, uint32_t indexCount, uint32_t vertexCount, Material &material) : firstIndex(firstIndex), indexCount(indexCount), vertexCount(vertexCount), material(material) {
			hasIndices = indexCount > 0;
		};

		void setBoundingBox(glm::vec3 min, glm::vec3 max) {
			bb.min = min;
			bb.max = max;
			bb.valid = true;
		}
	};

	/*
		glTF mesh
	*/
	struct Mesh {
		vks::VulkanDevice *device;

		std::string name;
		std::vector<std::shared_ptr<Primitive>> primitives;

		BoundingBox bb;
		BoundingBox aabb;

		struct UniformBuffer {
			VkBuffer buffer;
			VkDeviceMemory memory;
			VkDescriptorBufferInfo descriptor;
			VkDescriptorSet descriptorSet;
			void *mapped;
		} uniformBuffer;

		struct UniformBlock {
			glm::mat4 matrix;
			glm::mat4 jointMatrix[MAX_NUM_JOINTS]{};
			float jointcount{ 0 };
		} uniformBlock;

		Mesh(vks::VulkanDevice *device, glm::mat4 matrix) {
			this->device = device;
			this->uniformBlock.matrix = matrix;
			VK_CHECK_RESULT(device->createBuffer(
				VK_BUFFER_USAGE_UNIFORM_BUFFER_BIT,
				VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT,
				sizeof(uniformBlock),
				&uniformBuffer.buffer,
				&uniformBuffer.memory,
				&uniformBlock));
			VK_CHECK_RESULT(vkMapMemory(device->logicalDevice, uniformBuffer.memory, 0, sizeof(uniformBlock), 0, &uniformBuffer.mapped));
			uniformBuffer.descriptor = { uniformBuffer.buffer, 0, sizeof(uniformBlock) };
		};

		~Mesh() {
			vkDestroyBuffer(device->logicalDevice, uniformBuffer.buffer, nullptr);
			vkFreeMemory(device->logicalDevice, uniformBuffer.memory, nullptr);
		}

		void setBoundingBox(glm::vec3 min, glm::vec3 max) {
			bb.min = min;
			bb.max = max;
			bb.valid = true;
		}
	};

	/*
		glTF skin
	*/
	struct Skin {
		std::string name;
		std::shared_ptr<Node> skeletonRoot = nullptr;
		std::vector<glm::mat4> inverseBindMatrices;
		std::vector<std::shared_ptr<Node>> joints;
	};

	/*
		Anything that can have a transform, which could be a node, model, or gadget
	*/
	struct Transformable
	{
		glm::vec3 translation{};
		glm::vec3 scale{ 1.0f };
		glm::quat rotation{};
		glm::mat4 matrix{ 1.0f };

		Transformable *parent = nullptr;

		glm::mat4 localMatrix() {
			return glm::translate( glm::mat4( 1.0f ), translation ) * glm::mat4( rotation ) * glm::scale( glm::mat4( 1.0f ), scale ) * matrix;
		}

	};

	/*
		glTF node
	*/
	struct Node : public Transformable
	{
		uint32_t index = 0;
		std::vector<std::shared_ptr<Node>> children;
		std::string name;
		std::shared_ptr<Mesh> mesh;
		std::shared_ptr<Skin> skin;
		int32_t skinIndex = -1;
		BoundingBox bvh;
		BoundingBox aabb;

		glm::mat4 getMatrix() {
			glm::mat4 m = localMatrix();
			vkglTF::Transformable *p = parent;
			while (p) {
				glm::mat4 mp = p->localMatrix();
				m = mp * m;
				p = p->parent;
			}
			return m;
		}

		void update() {
			if (mesh) {
				glm::mat4 m = getMatrix();
				if (skin) {
					mesh->uniformBlock.matrix = m;
					// Update join matrices
					glm::mat4 inverseTransform = glm::inverse(m);
					size_t numJoints = std::min((uint32_t)skin->joints.size(), MAX_NUM_JOINTS);
					for (size_t i = 0; i < numJoints; i++) {
						std::shared_ptr<Node> jointNode = skin->joints[i];
						glm::mat4 jointMat = jointNode->getMatrix() * skin->inverseBindMatrices[i];
						jointMat = inverseTransform * jointMat;
						mesh->uniformBlock.jointMatrix[i] = jointMat;
					}
					mesh->uniformBlock.jointcount = (float)numJoints;
					memcpy(mesh->uniformBuffer.mapped, &mesh->uniformBlock, sizeof(mesh->uniformBlock));
				} else {
					memcpy(mesh->uniformBuffer.mapped, &m, sizeof(glm::mat4));
				}
			}

			for (auto& child : children) {
				child->update();
			}
		}
	};

	/*
		glTF animation channel
	*/
	struct AnimationChannel {
		enum PathType { TRANSLATION, ROTATION, SCALE };
		PathType path;
		std::shared_ptr<Node> node;
		uint32_t samplerIndex;
	};

	/*
		glTF animation sampler
	*/
	struct AnimationSampler {
		enum InterpolationType { LINEAR, STEP, CUBICSPLINE };
		InterpolationType interpolation;
		std::vector<float> inputs;
		std::vector<glm::vec4> outputsVec4;
	};

	/*
		glTF animation
	*/
	struct Animation {
		std::string name;
		std::vector<AnimationSampler> samplers;
		std::vector<AnimationChannel> channels;
		float start = std::numeric_limits<float>::max();
		float end = std::numeric_limits<float>::min();
		float time = 0;
	};

	struct ModelBuffers
	{
		vks::VulkanDevice *device;

		struct Vertices {
			VkBuffer buffer = VK_NULL_HANDLE;
			VkDeviceMemory memory;
		} vertices;
		struct Indices {
			int count;
			VkBuffer buffer = VK_NULL_HANDLE;
			VkDeviceMemory memory;
		} indices;

		ModelBuffers( vks::VulkanDevice *device )
		{
			this->device = device;
		}

		~ModelBuffers()
		{
			if ( vertices.buffer != VK_NULL_HANDLE ) {
				vkDestroyBuffer( device->logicalDevice, vertices.buffer, nullptr );
				vkFreeMemory( device->logicalDevice, vertices.memory, nullptr );
				vertices.buffer = VK_NULL_HANDLE;
			}
			if ( indices.buffer != VK_NULL_HANDLE ) {
				vkDestroyBuffer( device->logicalDevice, indices.buffer, nullptr );
				vkFreeMemory( device->logicalDevice, indices.memory, nullptr );
				indices.buffer = VK_NULL_HANDLE;
			}
		}
	};

	/*
		glTF model loading and rendering class
	*/
	struct Model : public Transformable 
	{

		vks::VulkanDevice *device;

		struct Vertex {
			glm::vec3 pos;
			glm::vec3 normal;
			glm::vec2 uv0;
			glm::vec2 uv1;
			glm::vec4 joint0;
			glm::vec4 weight0;
		};

		std::shared_ptr<ModelBuffers> buffers;
		glm::mat4 aabb;

		std::vector<std::shared_ptr<Node>> nodes;
		std::vector<std::shared_ptr<Node>> linearNodes;

		std::vector<std::shared_ptr<Skin>> skins;

		std::vector<std::shared_ptr<Texture>> textures;
		std::vector<TextureSampler> textureSamplers;
		std::vector<Material> materials;
		std::vector<Animation> animations;
		std::vector<std::string> extensions;

		struct Dimensions {
			glm::vec3 min = glm::vec3(FLT_MAX);
			glm::vec3 max = glm::vec3(-FLT_MAX);
		} dimensions;

		Model() = default;
		Model( const Model & src )
		{
			copyFrom( src );
		}
		Model & operator=( const Model & src )
		{
			copyFrom( src );
		}
		void copyFrom( const Model & src )
		{
			device = src.device;
			buffers = src.buffers; // shallow copy so we reuse the vertex and index buffers
			aabb = src.aabb;

			// deep copy the nodes because they contain lots of dynamic state
			for ( auto pNode : src.nodes )
			{
				auto pNewNode = std::make_shared<Node>( *pNode );
				nodes.push_back( pNewNode );
				collectLinearNodes( pNewNode );
			}

			// Fix all the parent points on those nodes
			for ( auto pNode : linearNodes )
			{
				if ( !pNode->parent || pNode->parent == &src )
				{
					pNode->parent = this;
				}
				else
				{
					auto pParentNode = nodeFromIndex( static_cast<vkglTF::Node *>( pNode->parent )->index );
					pNode->parent = &*pParentNode;
				}
			}

			// copy the skins deeply and make them point at the new nodes
			for ( auto pSrcSkin : src.skins ) 
			{
				std::shared_ptr<Skin> newSkin = std::make_shared<Skin>();

				newSkin->name = pSrcSkin->name;
				newSkin->inverseBindMatrices = pSrcSkin->inverseBindMatrices;

				// Find skeleton root node
				if ( pSrcSkin->skeletonRoot ) 
				{
					newSkin->skeletonRoot = nodeFromIndex( pSrcSkin->skeletonRoot->index );
				}

				// Find joint nodes
				for ( auto pSrcJointNode : pSrcSkin->joints ) 
				{
					std::shared_ptr<Node> node = nodeFromIndex( pSrcJointNode->index );
					if ( node ) 
					{
						newSkin->joints.push_back( node );
					}
				}

				skins.push_back( newSkin );
			}

			// shallow copy textures and materials
			textures = src.textures;
			textureSamplers = src.textureSamplers;
			materials = src.materials;

			// extensions don't actually seem to be used, so shallow copy those
			extensions = src.extensions;

			for ( auto & srcAnimation : src.animations )
			{
				// everything but channels can just be copied
				Animation newAnim;
				newAnim.name = srcAnimation.name;
				newAnim.samplers = srcAnimation.samplers;
				newAnim.start = srcAnimation.start;
				newAnim.end = srcAnimation.end;

				// Channels need their nodes patched up
				for ( auto & srcChannel : srcAnimation.channels )
				{
					AnimationChannel newChannel;
					newChannel.path = srcChannel.path;
					newChannel.samplerIndex = srcChannel.samplerIndex;
					if ( srcChannel.node )
					{
						newChannel.node = nodeFromIndex( srcChannel.node->index );
					}
					newAnim.channels.push_back( newChannel );
				}

				animations.push_back( newAnim );
			}

		}

		// linearNodes just holds all the nodes in the hierarchy in a flat
		// list. Maybe just eliminate this concept?
		void collectLinearNodes( std::shared_ptr < Node> pNode )
		{
			linearNodes.push_back( pNode );
			for ( auto pChildNode : pNode->children )
			{
				collectLinearNodes( pChildNode );
			}
		}

		void loadNode(std::shared_ptr<vkglTF::Node> parent, const tinygltf::Node &node, uint32_t nodeIndex, const tinygltf::Model &model, std::vector<uint32_t>& indexBuffer, std::vector<Vertex>& vertexBuffer, float globalscale)
		{
			std::shared_ptr<vkglTF::Node> newNode = std::make_shared<Node>();
			newNode->index = nodeIndex;
			newNode->parent = &*parent;
			newNode->name = node.name;
			newNode->skinIndex = node.skin;
			newNode->matrix = glm::mat4(1.0f);

			// Generate local node matrix
			glm::vec3 translation = glm::vec3(0.0f);
			if (node.translation.size() == 3) {
				translation = glm::make_vec3(node.translation.data());
				newNode->translation = translation;
			}
			glm::mat4 rotation = glm::mat4(1.0f);
			if (node.rotation.size() == 4) {
				glm::quat q = glm::make_quat(node.rotation.data());
				newNode->rotation = glm::mat4(q);
			}
			glm::vec3 scale = glm::vec3(1.0f);
			if (node.scale.size() == 3) {
				scale = glm::make_vec3(node.scale.data());
				newNode->scale = scale;
			}
			if (node.matrix.size() == 16) {
				newNode->matrix = glm::make_mat4x4(node.matrix.data());
			};

			// Node with children
			if (node.children.size() > 0) {
				for (size_t i = 0; i < node.children.size(); i++) {
					loadNode(newNode, model.nodes[node.children[i]], node.children[i], model, indexBuffer, vertexBuffer, globalscale);
				}
			}

			// Node contains mesh data
			if (node.mesh > -1) {
				const tinygltf::Mesh mesh = model.meshes[node.mesh];
				std::shared_ptr<Mesh> newMesh = std::make_shared<Mesh>(device, newNode->matrix);
				newMesh->name = mesh.name;
				for (size_t j = 0; j < mesh.primitives.size(); j++) {
					const tinygltf::Primitive &primitive = mesh.primitives[j];
					uint32_t indexStart = static_cast<uint32_t>(indexBuffer.size());
					uint32_t vertexStart = static_cast<uint32_t>(vertexBuffer.size());
					uint32_t indexCount = 0;
					uint32_t vertexCount = 0;
					glm::vec3 posMin{};
					glm::vec3 posMax{};
					bool hasSkin = false;
					bool hasIndices = primitive.indices > -1;
					// Vertices
					{
						const float *bufferPos = nullptr;
						const float *bufferNormals = nullptr;
						const float *bufferTexCoordSet0 = nullptr;
						const float *bufferTexCoordSet1 = nullptr;
						const uint16_t *bufferJoints = nullptr;
						const float *bufferWeights = nullptr;

						// Position attribute is required
						assert(primitive.attributes.find("POSITION") != primitive.attributes.end());

						const tinygltf::Accessor &posAccessor = model.accessors[primitive.attributes.find("POSITION")->second];
						const tinygltf::BufferView &posView = model.bufferViews[posAccessor.bufferView];
						bufferPos = reinterpret_cast<const float *>(&(model.buffers[posView.buffer].data[posAccessor.byteOffset + posView.byteOffset]));
						posMin = glm::vec3(posAccessor.minValues[0], posAccessor.minValues[1], posAccessor.minValues[2]);
						posMax = glm::vec3(posAccessor.maxValues[0], posAccessor.maxValues[1], posAccessor.maxValues[2]);
						vertexCount = static_cast<uint32_t>(posAccessor.count);

						if (primitive.attributes.find("NORMAL") != primitive.attributes.end()) {
							const tinygltf::Accessor &normAccessor = model.accessors[primitive.attributes.find("NORMAL")->second];
							const tinygltf::BufferView &normView = model.bufferViews[normAccessor.bufferView];
							bufferNormals = reinterpret_cast<const float *>(&(model.buffers[normView.buffer].data[normAccessor.byteOffset + normView.byteOffset]));
						}

						if (primitive.attributes.find("TEXCOORD_0") != primitive.attributes.end()) {
							const tinygltf::Accessor &uvAccessor = model.accessors[primitive.attributes.find("TEXCOORD_0")->second];
							const tinygltf::BufferView &uvView = model.bufferViews[uvAccessor.bufferView];
							bufferTexCoordSet0 = reinterpret_cast<const float *>(&(model.buffers[uvView.buffer].data[uvAccessor.byteOffset + uvView.byteOffset]));
						}
						if (primitive.attributes.find("TEXCOORD_1") != primitive.attributes.end()) {
							const tinygltf::Accessor &uvAccessor = model.accessors[primitive.attributes.find("TEXCOORD_1")->second];
							const tinygltf::BufferView &uvView = model.bufferViews[uvAccessor.bufferView];
							bufferTexCoordSet1 = reinterpret_cast<const float *>(&(model.buffers[uvView.buffer].data[uvAccessor.byteOffset + uvView.byteOffset]));
						}

						// Skinning
						// Joints
						if (primitive.attributes.find("JOINTS_0") != primitive.attributes.end()) {
							const tinygltf::Accessor &jointAccessor = model.accessors[primitive.attributes.find("JOINTS_0")->second];
							const tinygltf::BufferView &jointView = model.bufferViews[jointAccessor.bufferView];
							bufferJoints = reinterpret_cast<const uint16_t *>(&(model.buffers[jointView.buffer].data[jointAccessor.byteOffset + jointView.byteOffset]));
						}

						if (primitive.attributes.find("WEIGHTS_0") != primitive.attributes.end()) {
							const tinygltf::Accessor &uvAccessor = model.accessors[primitive.attributes.find("WEIGHTS_0")->second];
							const tinygltf::BufferView &uvView = model.bufferViews[uvAccessor.bufferView];
							bufferWeights = reinterpret_cast<const float *>(&(model.buffers[uvView.buffer].data[uvAccessor.byteOffset + uvView.byteOffset]));
						}

						hasSkin = (bufferJoints && bufferWeights);

						for (size_t v = 0; v < posAccessor.count; v++) {
							Vertex vert{};
							vert.pos = glm::vec4(glm::make_vec3(&bufferPos[v * 3]), 1.0f);
							vert.normal = glm::normalize(glm::vec3(bufferNormals ? glm::make_vec3(&bufferNormals[v * 3]) : glm::vec3(0.0f)));
							vert.uv0 = bufferTexCoordSet0 ? glm::make_vec2(&bufferTexCoordSet0[v * 2]) : glm::vec3(0.0f);
							vert.uv1 = bufferTexCoordSet1 ? glm::make_vec2(&bufferTexCoordSet1[v * 2]) : glm::vec3(0.0f);

							vert.joint0 = hasSkin ? glm::vec4(glm::make_vec4(&bufferJoints[v * 4])) : glm::vec4(0.0f);
							vert.weight0 = hasSkin ? glm::make_vec4(&bufferWeights[v * 4]) : glm::vec4(0.0f);
							vertexBuffer.push_back(vert);
						}
					}
					// Indices
					if (hasIndices)
					{
						const tinygltf::Accessor &accessor = model.accessors[primitive.indices > -1 ? primitive.indices : 0];
						const tinygltf::BufferView &bufferView = model.bufferViews[accessor.bufferView];
						const tinygltf::Buffer &buffer = model.buffers[bufferView.buffer];

						indexCount = static_cast<uint32_t>(accessor.count);
						const void *dataPtr = &(buffer.data[accessor.byteOffset + bufferView.byteOffset]);

						switch (accessor.componentType) {
						case TINYGLTF_PARAMETER_TYPE_UNSIGNED_INT: {
							const uint32_t *buf = static_cast<const uint32_t*>(dataPtr);
							for (size_t index = 0; index < accessor.count; index++) {
								indexBuffer.push_back(buf[index] + vertexStart);
							}
							break;
						}
						case TINYGLTF_PARAMETER_TYPE_UNSIGNED_SHORT: {
							const uint16_t *buf = static_cast<const uint16_t*>(dataPtr);
							for (size_t index = 0; index < accessor.count; index++) {
								indexBuffer.push_back(buf[index] + vertexStart);
							}
							break;
						}
						case TINYGLTF_PARAMETER_TYPE_UNSIGNED_BYTE: {
							const uint8_t *buf = static_cast<const uint8_t*>(dataPtr);
							for (size_t index = 0; index < accessor.count; index++) {
								indexBuffer.push_back(buf[index] + vertexStart);
							}
							break;
						}
						default:
							std::cerr << "Index component type " << accessor.componentType << " not supported!" << std::endl;
							return;
						}
					}					
					auto newPrimitive = std::make_shared<Primitive>(indexStart, indexCount, vertexCount, primitive.material > -1 ? materials[primitive.material] : materials.back());
					newPrimitive->setBoundingBox(posMin, posMax);
					newMesh->primitives.push_back(newPrimitive);
				}
				// Mesh BB from BBs of primitives
				for (auto p : newMesh->primitives) {
					if (p->bb.valid && !newMesh->bb.valid) {
						newMesh->bb = p->bb;
						newMesh->bb.valid = true;
					}
					newMesh->bb.min = glm::min(newMesh->bb.min, p->bb.min);
					newMesh->bb.max = glm::max(newMesh->bb.max, p->bb.max);
				}
				newNode->mesh.swap( newMesh );
			}
			if (parent) {
				parent->children.push_back(newNode);
			} else {
				nodes.push_back(newNode);
			}
			linearNodes.push_back(newNode);
		}

		void loadSkins(tinygltf::Model &gltfModel)
		{
			for (tinygltf::Skin &source : gltfModel.skins) {
				std::shared_ptr<Skin> newSkin = std::make_shared<Skin>();
				newSkin->name = source.name;
				
				// Find skeleton root node
				if (source.skeleton > -1) {
					newSkin->skeletonRoot = nodeFromIndex(source.skeleton);
				}

				// Find joint nodes
				for (int jointIndex : source.joints) {
					std::shared_ptr<Node> node = nodeFromIndex(jointIndex);
					if (node) {
						newSkin->joints.push_back(node);
					}
				}

				// Get inverse bind matrices from buffer
				if (source.inverseBindMatrices > -1) {
					const tinygltf::Accessor &accessor = gltfModel.accessors[source.inverseBindMatrices];
					const tinygltf::BufferView &bufferView = gltfModel.bufferViews[accessor.bufferView];
					const tinygltf::Buffer &buffer = gltfModel.buffers[bufferView.buffer];
					newSkin->inverseBindMatrices.resize(accessor.count);
					memcpy(newSkin->inverseBindMatrices.data(), &buffer.data[accessor.byteOffset + bufferView.byteOffset], accessor.count * sizeof(glm::mat4));
				}

				skins.push_back(newSkin);
			}
		}

		void loadTextures(tinygltf::Model &gltfModel, vks::VulkanDevice *device, VkQueue transferQueue)
		{
			for (tinygltf::Texture &tex : gltfModel.textures) {
				tinygltf::Image image = gltfModel.images[tex.source];
				vkglTF::TextureSampler textureSampler;
				if (tex.sampler == -1) {
					// No sampler specified, use a default one
					textureSampler.magFilter = VK_FILTER_LINEAR;
					textureSampler.minFilter = VK_FILTER_LINEAR;
					textureSampler.addressModeU = VK_SAMPLER_ADDRESS_MODE_REPEAT;
					textureSampler.addressModeV = VK_SAMPLER_ADDRESS_MODE_REPEAT;
					textureSampler.addressModeW = VK_SAMPLER_ADDRESS_MODE_REPEAT;
				}
				else {
					textureSampler = textureSamplers[tex.sampler];
				}
				auto pTexture = std::make_shared<vkglTF::Texture>();
				pTexture->fromglTfImage(image, textureSampler, device, transferQueue);
				textures.push_back( pTexture );
			}
		}

		VkSamplerAddressMode getVkWrapMode(int32_t wrapMode) 
		{
			switch (wrapMode) {
			default:
			case 10497:
				return VK_SAMPLER_ADDRESS_MODE_REPEAT;
			case 33071:
				return VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE;
			case 33648:
				return VK_SAMPLER_ADDRESS_MODE_MIRRORED_REPEAT;
			}
		}

		VkFilter getVkFilterMode(int32_t filterMode) 
		{
			switch (filterMode) {
			default:
			case 9728:
				return VK_FILTER_NEAREST;
			case 9729:
				return VK_FILTER_LINEAR;
			case 9984:
				return VK_FILTER_NEAREST;
			case 9985:
				return VK_FILTER_NEAREST;
			case 9986:
				return VK_FILTER_LINEAR;
			case 9987:
				return VK_FILTER_LINEAR;
			}
		}

		void loadTextureSamplers(tinygltf::Model &gltfModel)
		{
			for (tinygltf::Sampler smpl : gltfModel.samplers) {
				vkglTF::TextureSampler sampler{};
				sampler.minFilter = getVkFilterMode(smpl.minFilter);
				sampler.magFilter = getVkFilterMode(smpl.magFilter);
				sampler.addressModeU = getVkWrapMode(smpl.wrapS);
				sampler.addressModeV = getVkWrapMode(smpl.wrapT);
				sampler.addressModeW = sampler.addressModeV;
				textureSamplers.push_back(sampler);
			}
		}

		void loadMaterials(tinygltf::Model &gltfModel)
		{
			for (tinygltf::Material &mat : gltfModel.materials) {
				vkglTF::Material material{};
				if (mat.values.find("baseColorTexture") != mat.values.end()) {
					material.baseColorTexture = textures[mat.values["baseColorTexture"].TextureIndex()];
					material.texCoordSets.baseColor = mat.values["baseColorTexture"].TextureTexCoord();
				}
				if (mat.values.find("metallicRoughnessTexture") != mat.values.end()) {
					material.metallicRoughnessTexture = textures[mat.values["metallicRoughnessTexture"].TextureIndex()];
					material.texCoordSets.metallicRoughness = mat.values["metallicRoughnessTexture"].TextureTexCoord();
				}
				if (mat.values.find("roughnessFactor") != mat.values.end()) {
					material.roughnessFactor = static_cast<float>(mat.values["roughnessFactor"].Factor());
				}
				if (mat.values.find("metallicFactor") != mat.values.end()) {
					material.metallicFactor = static_cast<float>(mat.values["metallicFactor"].Factor());
				}
				if (mat.values.find("baseColorFactor") != mat.values.end()) {
					material.baseColorFactor = glm::make_vec4(mat.values["baseColorFactor"].ColorFactor().data());
				}				
				if (mat.additionalValues.find("normalTexture") != mat.additionalValues.end()) {
					material.normalTexture = textures[mat.additionalValues["normalTexture"].TextureIndex()];
					material.texCoordSets.normal = mat.additionalValues["normalTexture"].TextureTexCoord();
				}
				if (mat.additionalValues.find("emissiveTexture") != mat.additionalValues.end()) {
					material.emissiveTexture = textures[mat.additionalValues["emissiveTexture"].TextureIndex()];
					material.texCoordSets.emissive = mat.additionalValues["emissiveTexture"].TextureTexCoord();
				}
				if (mat.additionalValues.find("occlusionTexture") != mat.additionalValues.end()) {
					material.occlusionTexture = textures[mat.additionalValues["occlusionTexture"].TextureIndex()];
					material.texCoordSets.occlusion = mat.additionalValues["occlusionTexture"].TextureTexCoord();
				}
				if (mat.additionalValues.find("alphaMode") != mat.additionalValues.end()) {
					tinygltf::Parameter param = mat.additionalValues["alphaMode"];
					if (param.string_value == "BLEND") {
						material.alphaMode = Material::ALPHAMODE_BLEND;
					}
					if (param.string_value == "MASK") {
						material.alphaCutoff = 0.5f;
						material.alphaMode = Material::ALPHAMODE_MASK;
					}
				}
				if (mat.additionalValues.find("alphaCutoff") != mat.additionalValues.end()) {
					material.alphaCutoff = static_cast<float>(mat.additionalValues["alphaCutoff"].Factor());
				}
				if (mat.additionalValues.find("emissiveFactor") != mat.additionalValues.end()) {
					material.emissiveFactor = glm::vec4(glm::make_vec3(mat.additionalValues["emissiveFactor"].ColorFactor().data()), 1.0);
					material.emissiveFactor = glm::vec4(0.0f);
				}

				// Extensions
				// @TODO: Find out if there is a nicer way of reading these properties with recent tinygltf headers
				if (mat.extensions.find("KHR_materials_pbrSpecularGlossiness") != mat.extensions.end()) {
					auto ext = mat.extensions.find("KHR_materials_pbrSpecularGlossiness");
					if (ext->second.Has("specularGlossinessTexture")) {
						auto index = ext->second.Get("specularGlossinessTexture").Get("index");
						material.extension.specularGlossinessTexture = textures[index.Get<int>()];
						auto texCoordSet = ext->second.Get("specularGlossinessTexture").Get("texCoord");
						material.texCoordSets.specularGlossiness = texCoordSet.Get<int>();
						material.pbrWorkflows.specularGlossiness = true;
					}
					if (ext->second.Has("diffuseTexture")) {
						auto index = ext->second.Get("diffuseTexture").Get("index");
						material.extension.diffuseTexture = textures[index.Get<int>()];
					}
					if (ext->second.Has("diffuseFactor")) {
						auto factor = ext->second.Get("diffuseFactor");
						for (uint32_t i = 0; i < factor.ArrayLen(); i++) {
							auto val = factor.Get(i);
							material.extension.diffuseFactor[i] = val.IsNumber() ? (float)val.Get<double>() : (float)val.Get<int>();
						}
					}
					if (ext->second.Has("specularFactor")) {
						auto factor = ext->second.Get("specularFactor");
						for (uint32_t i = 0; i < factor.ArrayLen(); i++) {
							auto val = factor.Get(i);
							material.extension.specularFactor[i] = val.IsNumber() ? (float)val.Get<double>() : (float)val.Get<int>();
						}
					}
				}

				materials.push_back(material);
			}
			// Push a default material at the end of the list for meshes with no material assigned
			materials.push_back(Material());
		}

		void loadAnimations(tinygltf::Model &gltfModel)
		{
			for (tinygltf::Animation &anim : gltfModel.animations) {
				vkglTF::Animation animation{};
				animation.name = anim.name;
				if (anim.name.empty()) {
					animation.name = std::to_string(animations.size());
				}

				// Samplers
				for (auto &samp : anim.samplers) {
					vkglTF::AnimationSampler sampler{};

					if (samp.interpolation == "LINEAR") {
						sampler.interpolation = AnimationSampler::InterpolationType::LINEAR;
					}
					if (samp.interpolation == "STEP") {
						sampler.interpolation = AnimationSampler::InterpolationType::STEP;
					}
					if (samp.interpolation == "CUBICSPLINE") {
						sampler.interpolation = AnimationSampler::InterpolationType::CUBICSPLINE;
					}

					// Read sampler input time values
					{
						const tinygltf::Accessor &accessor = gltfModel.accessors[samp.input];
						const tinygltf::BufferView &bufferView = gltfModel.bufferViews[accessor.bufferView];
						const tinygltf::Buffer &buffer = gltfModel.buffers[bufferView.buffer];

						assert(accessor.componentType == TINYGLTF_COMPONENT_TYPE_FLOAT);

						const void *dataPtr = &buffer.data[accessor.byteOffset + bufferView.byteOffset];
						const float *buf = static_cast<const float*>(dataPtr);
						for (size_t index = 0; index < accessor.count; index++) {
							sampler.inputs.push_back(buf[index]);
						}

						for (auto input : sampler.inputs) {
							if (input < animation.start) {
								animation.start = input;
							};
							if (input > animation.end) {
								animation.end = input;
							}
						}
					}

					// Read sampler output T/R/S values 
					{
						const tinygltf::Accessor &accessor = gltfModel.accessors[samp.output];
						const tinygltf::BufferView &bufferView = gltfModel.bufferViews[accessor.bufferView];
						const tinygltf::Buffer &buffer = gltfModel.buffers[bufferView.buffer];

						assert(accessor.componentType == TINYGLTF_COMPONENT_TYPE_FLOAT);

						const void *dataPtr = &buffer.data[accessor.byteOffset + bufferView.byteOffset];

						switch (accessor.type) {
						case TINYGLTF_TYPE_VEC3: {
							const glm::vec3 *buf = static_cast<const glm::vec3*>(dataPtr);
							for (size_t index = 0; index < accessor.count; index++) {
								sampler.outputsVec4.push_back(glm::vec4(buf[index], 0.0f));
							}
							break;
						}
						case TINYGLTF_TYPE_VEC4: {
							const glm::vec4 *buf = static_cast<const glm::vec4*>(dataPtr);
							for (size_t index = 0; index < accessor.count; index++) {
								sampler.outputsVec4.push_back(buf[index]);
							}
							break;
						}
						default: {
							std::cout << "unknown type" << std::endl;
							break;
						}
						}
					}

					animation.samplers.push_back(sampler);
				}

				// Channels
				for (auto &source: anim.channels) {
					vkglTF::AnimationChannel channel{};

					if (source.target_path == "rotation") {
						channel.path = AnimationChannel::PathType::ROTATION;
					}
					if (source.target_path == "translation") {
						channel.path = AnimationChannel::PathType::TRANSLATION;
					}
					if (source.target_path == "scale") {
						channel.path = AnimationChannel::PathType::SCALE;
					}
					if (source.target_path == "weights") {
						std::cout << "weights not yet supported, skipping channel" << std::endl;
						continue;
					}
					channel.samplerIndex = source.sampler;
					channel.node = nodeFromIndex(source.target_node);
					if (!channel.node) {
						continue;
					}

					animation.channels.push_back(channel);
				}

				animations.push_back(animation);
			}
		}

		void loadFromFile(std::string filename, vks::VulkanDevice *device, VkQueue transferQueue, float scale = 1.0f)
		{
			tinygltf::Model gltfModel;
			tinygltf::TinyGLTF gltfContext;
			std::string error;
			std::string warning;


			bool binary = false;
			size_t extpos = filename.rfind('.', filename.length());
			if (extpos != std::string::npos) {
				binary = (filename.substr(extpos + 1, filename.length() - extpos) == "glb");
			}  

			bool fileLoaded = binary ? gltfContext.LoadBinaryFromFile(&gltfModel, &error, &warning, filename.c_str()) : gltfContext.LoadASCIIFromFile(&gltfModel, &error, &warning, filename.c_str());
			if( !fileLoaded )
			{
				// TODO: throw
				std::cerr << "Could not load gltf file: " << error << std::endl;
				return;
			}

			loadFromGltfModel( device, gltfModel, transferQueue, scale );
		}

		bool loadFromMemory( const void *pvData, size_t unSize, vks::VulkanDevice *device, VkQueue transferQueue, float scale = 1.0f )
		{
			tinygltf::Model gltfModel;
			tinygltf::TinyGLTF gltfContext;
			std::string error;
			std::string warning;

			if ( unSize < 4 )
				return false;

			uint32_t *pData = (uint32_t *)pvData;
			bool bBinary = *pData == 0x46546C67;

			bool bLoaded;
			if ( bBinary )
			{
				bLoaded = gltfContext.LoadBinaryFromMemory( &gltfModel, &error, &warning, (const unsigned char*)pvData, (uint32_t)unSize );
			}
			else
			{
				bLoaded = gltfContext.LoadASCIIFromString( &gltfModel, &error, &warning, (const char*)pvData, (uint32_t)unSize, ""  );
			}
			if ( !bLoaded )
			{
				// TODO: throw
				std::cerr << "Could not load gltf model from memory: " << error << std::endl;
				return false;
			}

			loadFromGltfModel( device, gltfModel, transferQueue, scale );
			return true;
		}

		void loadFromGltfModel( vks::VulkanDevice * device, tinygltf::Model &gltfModel, VkQueue transferQueue, float scale )
		{
			this->device = device;

			std::vector<uint32_t> indexBuffer;
			std::vector<Vertex> vertexBuffer;

			loadTextureSamplers( gltfModel );
			loadTextures( gltfModel, device, transferQueue );
			loadMaterials( gltfModel );
			// TODO: scene handling with no default scene
			const tinygltf::Scene &scene = gltfModel.scenes[gltfModel.defaultScene > -1 ? gltfModel.defaultScene : 0];
			for ( size_t i = 0; i < scene.nodes.size(); i++ ) {
				const tinygltf::Node node = gltfModel.nodes[scene.nodes[i]];
				loadNode( nullptr, node, scene.nodes[i], gltfModel, indexBuffer, vertexBuffer, scale );
			}
			if ( gltfModel.animations.size() > 0 ) {
				loadAnimations( gltfModel );
			}
			loadSkins( gltfModel );

			for ( auto node : linearNodes ) {
				// Assign skins
				if ( node->skinIndex > -1 ) {
					node->skin = skins[node->skinIndex];
				}
				// Initial pose
				if ( node->mesh ) {
					node->update();
				}
			}

			extensions = gltfModel.extensionsUsed;

			size_t vertexBufferSize = vertexBuffer.size() * sizeof( Vertex );
			size_t indexBufferSize = indexBuffer.size() * sizeof( uint32_t );
			buffers = std::make_shared<ModelBuffers>( device );
			buffers->indices.count = static_cast<uint32_t>( indexBuffer.size() );

			assert( vertexBufferSize > 0 );

			struct StagingBuffer {
				VkBuffer buffer;
				VkDeviceMemory memory;
			} vertexStaging, indexStaging;

			// Create staging buffers
			// Vertex data
			VK_CHECK_RESULT( device->createBuffer(
				VK_BUFFER_USAGE_TRANSFER_SRC_BIT,
				VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT,
				vertexBufferSize,
				&vertexStaging.buffer,
				&vertexStaging.memory,
				vertexBuffer.data() ) );
			// Index data
			if ( indexBufferSize > 0 ) {
				VK_CHECK_RESULT( device->createBuffer(
					VK_BUFFER_USAGE_TRANSFER_SRC_BIT,
					VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT,
					indexBufferSize,
					&indexStaging.buffer,
					&indexStaging.memory,
					indexBuffer.data() ) );
			}

			// Create device local buffers
			// Vertex buffer
			VK_CHECK_RESULT( device->createBuffer(
				VK_BUFFER_USAGE_VERTEX_BUFFER_BIT | VK_BUFFER_USAGE_TRANSFER_DST_BIT,
				VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT,
				vertexBufferSize,
				&buffers->vertices.buffer,
				&buffers->vertices.memory ) );
			// Index buffer
			if ( indexBufferSize > 0 ) {
				VK_CHECK_RESULT( device->createBuffer(
					VK_BUFFER_USAGE_INDEX_BUFFER_BIT | VK_BUFFER_USAGE_TRANSFER_DST_BIT,
					VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT,
					indexBufferSize,
					&buffers->indices.buffer,
					&buffers->indices.memory ) );
			}

			// Copy from staging buffers
			VkCommandBuffer copyCmd = device->createCommandBuffer( VK_COMMAND_BUFFER_LEVEL_PRIMARY, true );

			VkBufferCopy copyRegion = {};

			copyRegion.size = vertexBufferSize;
			vkCmdCopyBuffer( copyCmd, vertexStaging.buffer, buffers->vertices.buffer, 1, &copyRegion );

			if ( indexBufferSize > 0 ) {
				copyRegion.size = indexBufferSize;
				vkCmdCopyBuffer( copyCmd, indexStaging.buffer, buffers->indices.buffer, 1, &copyRegion );
			}

			device->flushCommandBuffer( copyCmd, transferQueue, true );

			vkDestroyBuffer( device->logicalDevice, vertexStaging.buffer, nullptr );
			vkFreeMemory( device->logicalDevice, vertexStaging.memory, nullptr );
			if ( indexBufferSize > 0 ) {
				vkDestroyBuffer( device->logicalDevice, indexStaging.buffer, nullptr );
				vkFreeMemory( device->logicalDevice, indexStaging.memory, nullptr );
			}

			getSceneDimensions();
		}

		void drawNode( std::shared_ptr<Node> node, VkCommandBuffer commandBuffer)
		{
			if (node->mesh) {
				for (auto primitive : node->mesh->primitives) {
					vkCmdDrawIndexed(commandBuffer, primitive->indexCount, 1, primitive->firstIndex, 0, 0);
				}
			}
			for (auto& child : node->children) {
				drawNode(child, commandBuffer);
			}
		}

		void draw(VkCommandBuffer commandBuffer)
		{
			const VkDeviceSize offsets[1] = { 0 };
			vkCmdBindVertexBuffers(commandBuffer, 0, 1, &buffers->vertices.buffer, offsets);
			vkCmdBindIndexBuffer(commandBuffer, buffers->indices.buffer, 0, VK_INDEX_TYPE_UINT32);
			for (auto& node : nodes) {
				drawNode(node, commandBuffer);
			}
		}

		void calculateBoundingBox( std::shared_ptr<Node> node, Node *parent) {
			BoundingBox parentBvh = parent ? parent->bvh : BoundingBox(dimensions.min, dimensions.max);

			if (node->mesh) {
				if (node->mesh->bb.valid) {
					node->aabb = node->mesh->bb.getAABB(node->getMatrix());
					if (node->children.size() == 0) {
						node->bvh.min = node->aabb.min;
						node->bvh.max = node->aabb.max;
						node->bvh.valid = true;
					}
				}
			}

			parentBvh.min = glm::min(parentBvh.min, node->bvh.min);
			parentBvh.max = glm::min(parentBvh.max, node->bvh.max);

			for (auto &child : node->children) {
				calculateBoundingBox(child, &*node);
			}
		}

		void getSceneDimensions()
		{
			// Calculate binary volume hierarchy for all nodes in the scene
			for (auto node : linearNodes) {
				calculateBoundingBox(node, nullptr);
			}

			dimensions.min = glm::vec3(FLT_MAX);
			dimensions.max = glm::vec3(-FLT_MAX);

			for (auto node : linearNodes) {
				if (node->bvh.valid) {
					dimensions.min = glm::min(dimensions.min, node->bvh.min);
					dimensions.max = glm::max(dimensions.max, node->bvh.max);
				}
			}

			// Calculate scene aabb
			aabb = glm::scale(glm::mat4(1.0f), glm::vec3(dimensions.max[0] - dimensions.min[0], dimensions.max[1] - dimensions.min[1], dimensions.max[2] - dimensions.min[2]));
			aabb[3][0] = dimensions.min[0];
			aabb[3][1] = dimensions.min[1];
			aabb[3][2] = dimensions.min[2];
		}

		void animate( float timeDelta )
		{
			if ( animations.empty() )
				return;

			bool updated = false;
			for ( auto &animation : animations )
			{
				animation.time += timeDelta;
				if ( animation.time > animation.end )
				{
					if ( animation.end > 0 )
					{
						animation.time = fmod( animation.time, animation.end );
					}
					else
					{
						animation.time = 0;
					}
				}

				for ( auto& channel : animation.channels ) {
					vkglTF::AnimationSampler &sampler = animation.samplers[channel.samplerIndex];
					if ( sampler.inputs.size() > sampler.outputsVec4.size() ) {
						continue;
					}

					size_t nStartFrame = 0, nEndFrame=0;
					for ( size_t i = 0; i < sampler.inputs.size() - 1; i++ )
					{
						if ( ( animation.time >= sampler.inputs[i] ) && ( animation.time < sampler.inputs[i + 1] ) )
						{
							nStartFrame = i;
							nEndFrame = i + 1;
						}
					}

					switch ( sampler.interpolation )
					{
						case AnimationSampler::LINEAR:
						{
							float u = 0;
							if ( nStartFrame != nEndFrame )
							{
								u = std::max( 0.0f, animation.time - sampler.inputs[nStartFrame] ) / ( sampler.inputs[nEndFrame] - sampler.inputs[nStartFrame] );
							}

							if ( u <= 1.0f )
							{
								switch ( channel.path )
								{
									case vkglTF::AnimationChannel::PathType::TRANSLATION:
									{
										glm::vec4 trans = glm::mix( sampler.outputsVec4[nStartFrame], sampler.outputsVec4[nEndFrame], u );
										channel.node->translation = glm::vec3( trans );
										break;
									}
									case vkglTF::AnimationChannel::PathType::SCALE:
									{
										glm::vec4 trans = glm::mix( sampler.outputsVec4[nStartFrame], sampler.outputsVec4[nEndFrame], u );
										channel.node->scale = glm::vec3( trans );
										break;
									}
									case vkglTF::AnimationChannel::PathType::ROTATION:
									{
										glm::quat q1;
										q1.x = sampler.outputsVec4[nStartFrame].x;
										q1.y = sampler.outputsVec4[nStartFrame].y;
										q1.z = sampler.outputsVec4[nStartFrame].z;
										q1.w = sampler.outputsVec4[nStartFrame].w;
										glm::quat q2;
										q2.x = sampler.outputsVec4[nEndFrame].x;
										q2.y = sampler.outputsVec4[nEndFrame].y;
										q2.z = sampler.outputsVec4[nEndFrame].z;
										q2.w = sampler.outputsVec4[nEndFrame].w;
										channel.node->rotation = glm::normalize( glm::slerp( q1, q2, u ) );
										break;
									}
								}
								updated = true;
							}
						}
						break;

						case AnimationSampler::STEP:
							switch ( channel.path ) 
							{
								case vkglTF::AnimationChannel::PathType::TRANSLATION: 
								{
									channel.node->translation = glm::vec3( sampler.outputsVec4[nStartFrame] );
									break;
								}

								case vkglTF::AnimationChannel::PathType::SCALE: 
								{
									channel.node->scale = glm::vec3( sampler.outputsVec4[nStartFrame] );
									break;
								}

								case vkglTF::AnimationChannel::PathType::ROTATION: 
								{
									channel.node->rotation = glm::quat( sampler.outputsVec4[nStartFrame] );
									break;
								}
							}
							updated = true;
							break;

						case AnimationSampler::CUBICSPLINE:
						{
							float u = 0;
							if ( nStartFrame != nEndFrame )
							{
								u = std::max( 0.0f, animation.time - sampler.inputs[nStartFrame] ) / ( sampler.inputs[nEndFrame] - sampler.inputs[nStartFrame] );
							}

							if ( u <= 1.0f )
							{
								glm::vec4 vInTangent = sampler.outputsVec4[nStartFrame * 3 + 0];
								glm::vec4 vStartPoint = sampler.outputsVec4[nStartFrame * 3 + 1];
								glm::vec4 vOutTangent = sampler.outputsVec4[nStartFrame * 3 + 2];
								glm::vec4 vEndPoint = sampler.outputsVec4[nEndFrame * 3 + 1];

								switch ( channel.path )
								{
								case vkglTF::AnimationChannel::PathType::TRANSLATION:
								{
									glm::vec4 trans = glm::hermite( vStartPoint, vInTangent, vEndPoint, vOutTangent, u );
									channel.node->translation = glm::vec3( trans );
									break;
								}
								case vkglTF::AnimationChannel::PathType::SCALE:
								{
									glm::vec4 scale = glm::hermite( vStartPoint, vInTangent, vEndPoint, vOutTangent, u );
									channel.node->scale = glm::vec3( scale );
									break;
								}
								case vkglTF::AnimationChannel::PathType::ROTATION:
								{
									glm::vec4 rot = glm::hermite( vStartPoint, vInTangent, vEndPoint, vOutTangent, u );
									channel.node->rotation = glm::normalize( glm::quat( rot ) );
									break;
								}
								}
								updated = true;
							}
							break;
						}
					}
				}
			}

			if (updated) {
				for (auto &node : nodes) {
					node->update();
				}
			}
		}

		/*
			Helper functions
		*/
		std::shared_ptr<Node> findNode(std::shared_ptr<Node> parent, uint32_t index) 
		{
			if (parent->index == index) {
				return parent;
			}
			for (auto& child : parent->children) {
				auto nodeFound = findNode(child, index);
				if (nodeFound) 
				{
					return nodeFound;
				}
			}
			return nullptr;
		}

		std::shared_ptr<Node> nodeFromIndex(uint32_t index)
		{
			for (auto &node : nodes) {
				auto nodeFound = findNode(node, index);
				if (nodeFound) {
					return nodeFound;
				}
			}
			return nullptr;
		}
	};
}