/*
* Vulkan texture loader
*
* Copyright(C) 2016-2017 by Sascha Willems - www.saschawillems.de
*
* This code is licensed under the MIT license(MIT) (http://opensource.org/licenses/MIT)
*/

#pragma once

#include <stdlib.h>
#include <string>
#include <fstream>
#include <vector>

#include "vulkan/vulkan.h"
#include "macros.h"
#include "VulkanDevice.hpp"

#include <gli/gli.hpp>

#define TINYGLTF_NO_STB_IMAGE_WRITE
#define STBI_MSC_SECURE_CRT
#include "tiny_gltf.h"


#if defined(__ANDROID__)
#include <android/asset_manager.h>
#endif

namespace vks
{
	class Texture {
	public:
		vks::VulkanDevice *device;
		VkImage image = VK_NULL_HANDLE;
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

		void destroy()
		{
			vkDestroyImageView(device->logicalDevice, view, nullptr);
			vkDestroyImage(device->logicalDevice, image, nullptr);
			if (sampler)
			{
				vkDestroySampler(device->logicalDevice, sampler, nullptr);
			}
			vkFreeMemory(device->logicalDevice, deviceMemory, nullptr);
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

	class Texture2D : public Texture {
	public:
		void loadFromFile(
			std::string filename, 
			VkFormat format,
			vks::VulkanDevice *device,
			VkQueue copyQueue,
			VkImageUsageFlags imageUsageFlags = VK_IMAGE_USAGE_SAMPLED_BIT,
			VkImageLayout imageLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL)
		{
#if defined(__ANDROID__)
			// Textures are stored inside the apk on Android (compressed)
			// So they need to be loaded via the asset manager
			AAsset* asset = AAssetManager_open(androidApp->activity->assetManager, filename.c_str(), AASSET_MODE_STREAMING);
			if (!asset) {
				LOGE("Could not load texture %s", filename.c_str());
				exit(-1);
			}
			size_t size = AAsset_getLength(asset);
			assert(size > 0);

			void *textureData = malloc(size);
			AAsset_read(asset, textureData, size);
			AAsset_close(asset);

			gli::texture2d tex2D(gli::load((const char*)textureData, size));

			free(textureData);
#else
			auto loadedTexture = gli::load( filename );
			assert( !loadedTexture.empty() );
			gli::texture2d tex2D( loadedTexture );
#endif		
			assert(!tex2D.empty());

			this->device = device;
			width = static_cast<uint32_t>(tex2D[0].extent().x);
			height = static_cast<uint32_t>(tex2D[0].extent().y);
			mipLevels = static_cast<uint32_t>(tex2D.levels());

			// Get device properites for the requested texture format
			VkFormatProperties formatProperties;
			vkGetPhysicalDeviceFormatProperties(device->physicalDevice, format, &formatProperties);

			VkMemoryAllocateInfo memAllocInfo{};
			memAllocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;
			VkMemoryRequirements memReqs;

			// Use a separate command buffer for texture loading
			VkCommandBuffer copyCmd = device->createCommandBuffer(VK_COMMAND_BUFFER_LEVEL_PRIMARY, true);

			// Create a host-visible staging buffer that contains the raw image data
			VkBuffer stagingBuffer;
			VkDeviceMemory stagingMemory;

			VkBufferCreateInfo bufferCreateInfo{};
			bufferCreateInfo.sType = VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO;
			bufferCreateInfo.size = tex2D.size();
			// This buffer is used as a transfer source for the buffer copy
			bufferCreateInfo.usage = VK_BUFFER_USAGE_TRANSFER_SRC_BIT;
			bufferCreateInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;

			VK_CHECK_RESULT(vkCreateBuffer(device->logicalDevice, &bufferCreateInfo, nullptr, &stagingBuffer));

			// Get memory requirements for the staging buffer (alignment, memory type bits)
			vkGetBufferMemoryRequirements(device->logicalDevice, stagingBuffer, &memReqs);

			memAllocInfo.allocationSize = memReqs.size;
			// Get memory type index for a host visible buffer
			memAllocInfo.memoryTypeIndex = device->getMemoryType(memReqs.memoryTypeBits, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT);

			VK_CHECK_RESULT(vkAllocateMemory(device->logicalDevice, &memAllocInfo, nullptr, &stagingMemory));
			VK_CHECK_RESULT(vkBindBufferMemory(device->logicalDevice, stagingBuffer, stagingMemory, 0));

			// Copy texture data into staging buffer
			uint8_t *data;
			VK_CHECK_RESULT(vkMapMemory(device->logicalDevice, stagingMemory, 0, memReqs.size, 0, (void **)&data));
			memcpy(data, tex2D.data(), tex2D.size());
			vkUnmapMemory(device->logicalDevice, stagingMemory);

			// Setup buffer copy regions for each mip level
			std::vector<VkBufferImageCopy> bufferCopyRegions;
			uint32_t offset = 0;

			for (uint32_t i = 0; i < mipLevels; i++)
			{
				VkBufferImageCopy bufferCopyRegion = {};
				bufferCopyRegion.imageSubresource.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
				bufferCopyRegion.imageSubresource.mipLevel = i;
				bufferCopyRegion.imageSubresource.baseArrayLayer = 0;
				bufferCopyRegion.imageSubresource.layerCount = 1;
				bufferCopyRegion.imageExtent.width = static_cast<uint32_t>(tex2D[i].extent().x);
				bufferCopyRegion.imageExtent.height = static_cast<uint32_t>(tex2D[i].extent().y);
				bufferCopyRegion.imageExtent.depth = 1;
				bufferCopyRegion.bufferOffset = offset;

				bufferCopyRegions.push_back(bufferCopyRegion);

				offset += static_cast<uint32_t>(tex2D[i].size());
			}

			// Create optimal tiled target image
			VkImageCreateInfo imageCreateInfo{};
			imageCreateInfo.sType = VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO;
			imageCreateInfo.imageType = VK_IMAGE_TYPE_2D;
			imageCreateInfo.format = format;
			imageCreateInfo.mipLevels = mipLevels;
			imageCreateInfo.arrayLayers = 1;
			imageCreateInfo.samples = VK_SAMPLE_COUNT_1_BIT;
			imageCreateInfo.tiling = VK_IMAGE_TILING_OPTIMAL;
			imageCreateInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;
			imageCreateInfo.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
			imageCreateInfo.extent = { width, height, 1 };
			imageCreateInfo.usage = imageUsageFlags;
			// Ensure that the TRANSFER_DST bit is set for staging
			if (!(imageCreateInfo.usage & VK_IMAGE_USAGE_TRANSFER_DST_BIT))
			{
				imageCreateInfo.usage |= VK_IMAGE_USAGE_TRANSFER_DST_BIT;
			}
			VK_CHECK_RESULT(vkCreateImage(device->logicalDevice, &imageCreateInfo, nullptr, &image));
			printf( "Image 0x%llX function %s\n", (size_t)image, __FUNCTION__ );

			vkGetImageMemoryRequirements(device->logicalDevice, image, &memReqs);

			memAllocInfo.allocationSize = memReqs.size;

			memAllocInfo.memoryTypeIndex = device->getMemoryType(memReqs.memoryTypeBits, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT);
			VK_CHECK_RESULT(vkAllocateMemory(device->logicalDevice, &memAllocInfo, nullptr, &deviceMemory));
			VK_CHECK_RESULT(vkBindImageMemory(device->logicalDevice, image, deviceMemory, 0));

			VkImageSubresourceRange subresourceRange = {};
			subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
			subresourceRange.baseMipLevel = 0;
			subresourceRange.levelCount = mipLevels;
			subresourceRange.layerCount = 1;

			// Image barrier for optimal image (target)
			// Optimal image will be used as destination for the copy
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

			// Copy mip levels from staging buffer
			vkCmdCopyBufferToImage(
				copyCmd,
				stagingBuffer,
				image,
				VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL,
				static_cast<uint32_t>(bufferCopyRegions.size()),
				bufferCopyRegions.data()
			);

			// Change texture image layout to shader read after all mip levels have been copied
			this->imageLayout = imageLayout;
			{
				VkImageMemoryBarrier imageMemoryBarrier{};
				imageMemoryBarrier.sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER;
				imageMemoryBarrier.oldLayout = VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL;
				imageMemoryBarrier.newLayout = imageLayout;
				imageMemoryBarrier.srcAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;
				imageMemoryBarrier.dstAccessMask = VK_ACCESS_TRANSFER_READ_BIT;
				imageMemoryBarrier.image = image;
				imageMemoryBarrier.subresourceRange = subresourceRange;
				vkCmdPipelineBarrier(copyCmd, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, 0, 0, nullptr, 0, nullptr, 1, &imageMemoryBarrier);
			}

			device->flushCommandBuffer(copyCmd, copyQueue);

			// Clean up staging resources
			vkFreeMemory(device->logicalDevice, stagingMemory, nullptr);
			vkDestroyBuffer(device->logicalDevice, stagingBuffer, nullptr);

			VkSamplerCreateInfo samplerCreateInfo{};
			samplerCreateInfo.sType = VK_STRUCTURE_TYPE_SAMPLER_CREATE_INFO;
			samplerCreateInfo.magFilter = VK_FILTER_LINEAR;
			samplerCreateInfo.minFilter = VK_FILTER_LINEAR;
			samplerCreateInfo.mipmapMode = VK_SAMPLER_MIPMAP_MODE_LINEAR;
			samplerCreateInfo.addressModeU = VK_SAMPLER_ADDRESS_MODE_REPEAT;
			samplerCreateInfo.addressModeV = VK_SAMPLER_ADDRESS_MODE_REPEAT;
			samplerCreateInfo.addressModeW = VK_SAMPLER_ADDRESS_MODE_REPEAT;
			samplerCreateInfo.mipLodBias = 0.0f;
			samplerCreateInfo.compareOp = VK_COMPARE_OP_NEVER;
			samplerCreateInfo.minLod = 0.0f;
			samplerCreateInfo.maxLod = (float)mipLevels;
			samplerCreateInfo.maxAnisotropy = device->enabledFeatures.samplerAnisotropy ? device->properties.limits.maxSamplerAnisotropy : 1.0f;
			samplerCreateInfo.anisotropyEnable = device->enabledFeatures.samplerAnisotropy;
			samplerCreateInfo.borderColor = VK_BORDER_COLOR_FLOAT_OPAQUE_WHITE;
			VK_CHECK_RESULT(vkCreateSampler(device->logicalDevice, &samplerCreateInfo, nullptr, &sampler));

			VkImageViewCreateInfo viewCreateInfo{};
			viewCreateInfo.sType = VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;
			viewCreateInfo.viewType = VK_IMAGE_VIEW_TYPE_2D;
			viewCreateInfo.format = format;
			viewCreateInfo.components = { VK_COMPONENT_SWIZZLE_R, VK_COMPONENT_SWIZZLE_G, VK_COMPONENT_SWIZZLE_B, VK_COMPONENT_SWIZZLE_A };
			viewCreateInfo.subresourceRange = { VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1 };
			viewCreateInfo.subresourceRange.levelCount = mipLevels;
			viewCreateInfo.image = image;
			VK_CHECK_RESULT(vkCreateImageView(device->logicalDevice, &viewCreateInfo, nullptr, &view));

			updateDescriptor();
		}

		void loadFromBuffer(
			void* buffer,
			VkDeviceSize bufferSize,
			VkFormat format,
			uint32_t width,
			uint32_t height,
			vks::VulkanDevice *device,
			VkQueue copyQueue,
			VkFilter filter = VK_FILTER_LINEAR,
			VkImageUsageFlags imageUsageFlags = VK_IMAGE_USAGE_SAMPLED_BIT,
			VkImageLayout imageLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL)
		{
			assert(buffer);

			this->device = device;
			width = width;
			height = height;
			mipLevels = 1;

			VkMemoryAllocateInfo memAllocInfo{};
			memAllocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;
			VkMemoryRequirements memReqs;
			// Use a separate command buffer for texture loading
			VkCommandBuffer copyCmd = device->createCommandBuffer(VK_COMMAND_BUFFER_LEVEL_PRIMARY, true);

			// Create a host-visible staging buffer that contains the raw image data
			VkBuffer stagingBuffer;
			VkDeviceMemory stagingMemory;

			VkBufferCreateInfo bufferCreateInfo{};
			bufferCreateInfo.sType = VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO;
			bufferCreateInfo.size = bufferSize;
			// This buffer is used as a transfer source for the buffer copy
			bufferCreateInfo.usage = VK_BUFFER_USAGE_TRANSFER_SRC_BIT;
			bufferCreateInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;

			VK_CHECK_RESULT(vkCreateBuffer(device->logicalDevice, &bufferCreateInfo, nullptr, &stagingBuffer));

			// Get memory requirements for the staging buffer (alignment, memory type bits)
			vkGetBufferMemoryRequirements(device->logicalDevice, stagingBuffer, &memReqs);

			memAllocInfo.allocationSize = memReqs.size;
			// Get memory type index for a host visible buffer
			memAllocInfo.memoryTypeIndex = device->getMemoryType(memReqs.memoryTypeBits, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT);

			VK_CHECK_RESULT(vkAllocateMemory(device->logicalDevice, &memAllocInfo, nullptr, &stagingMemory));
			VK_CHECK_RESULT(vkBindBufferMemory(device->logicalDevice, stagingBuffer, stagingMemory, 0));

			// Copy texture data into staging buffer
			uint8_t *data;
			VK_CHECK_RESULT(vkMapMemory(device->logicalDevice, stagingMemory, 0, memReqs.size, 0, (void **)&data));
			memcpy(data, buffer, bufferSize);
			vkUnmapMemory(device->logicalDevice, stagingMemory);

			VkBufferImageCopy bufferCopyRegion = {};
			bufferCopyRegion.imageSubresource.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
			bufferCopyRegion.imageSubresource.mipLevel = 0;
			bufferCopyRegion.imageSubresource.baseArrayLayer = 0;
			bufferCopyRegion.imageSubresource.layerCount = 1;
			bufferCopyRegion.imageExtent.width = width;
			bufferCopyRegion.imageExtent.height = height;
			bufferCopyRegion.imageExtent.depth = 1;
			bufferCopyRegion.bufferOffset = 0;

			// Create optimal tiled target image
			VkImageCreateInfo imageCreateInfo{};
			imageCreateInfo.sType = VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO;
			imageCreateInfo.imageType = VK_IMAGE_TYPE_2D;
			imageCreateInfo.format = format;
			imageCreateInfo.mipLevels = mipLevels;
			imageCreateInfo.arrayLayers = 1;
			imageCreateInfo.samples = VK_SAMPLE_COUNT_1_BIT;
			imageCreateInfo.tiling = VK_IMAGE_TILING_OPTIMAL;
			imageCreateInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;
			imageCreateInfo.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
			imageCreateInfo.extent = { width, height, 1 };
			imageCreateInfo.usage = imageUsageFlags;
			// Ensure that the TRANSFER_DST bit is set for staging
			if (!(imageCreateInfo.usage & VK_IMAGE_USAGE_TRANSFER_DST_BIT))
			{
				imageCreateInfo.usage |= VK_IMAGE_USAGE_TRANSFER_DST_BIT;
			}
			VK_CHECK_RESULT(vkCreateImage(device->logicalDevice, &imageCreateInfo, nullptr, &image));
			printf( "Image 0x%llX function %s\n", (size_t)image, __FUNCTION__ );

			vkGetImageMemoryRequirements(device->logicalDevice, image, &memReqs);

			memAllocInfo.allocationSize = memReqs.size;

			memAllocInfo.memoryTypeIndex = device->getMemoryType(memReqs.memoryTypeBits, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT);
			VK_CHECK_RESULT(vkAllocateMemory(device->logicalDevice, &memAllocInfo, nullptr, &deviceMemory));
			VK_CHECK_RESULT(vkBindImageMemory(device->logicalDevice, image, deviceMemory, 0));

			VkImageSubresourceRange subresourceRange = {};
			subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
			subresourceRange.baseMipLevel = 0;
			subresourceRange.levelCount = mipLevels;
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

			vkCmdCopyBufferToImage(
				copyCmd,
				stagingBuffer,
				image,
				VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL,
				1,
				&bufferCopyRegion
			);

			this->imageLayout = imageLayout;
			{
				VkImageMemoryBarrier imageMemoryBarrier{};
				imageMemoryBarrier.sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER;
				imageMemoryBarrier.oldLayout = VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL;
				imageMemoryBarrier.newLayout = imageLayout;
				imageMemoryBarrier.srcAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;
				imageMemoryBarrier.dstAccessMask = VK_ACCESS_TRANSFER_READ_BIT;
				imageMemoryBarrier.image = image;
				imageMemoryBarrier.subresourceRange = subresourceRange;
				vkCmdPipelineBarrier(copyCmd, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, 0, 0, nullptr, 0, nullptr, 1, &imageMemoryBarrier);
			}

			device->flushCommandBuffer(copyCmd, copyQueue);

			// Clean up staging resources
			vkFreeMemory(device->logicalDevice, stagingMemory, nullptr);
			vkDestroyBuffer(device->logicalDevice, stagingBuffer, nullptr);

			// Create sampler
			VkSamplerCreateInfo samplerCreateInfo = {};
			samplerCreateInfo.sType = VK_STRUCTURE_TYPE_SAMPLER_CREATE_INFO;
			samplerCreateInfo.magFilter = filter;
			samplerCreateInfo.minFilter = filter;
			samplerCreateInfo.mipmapMode = VK_SAMPLER_MIPMAP_MODE_LINEAR;
			samplerCreateInfo.addressModeU = VK_SAMPLER_ADDRESS_MODE_REPEAT;
			samplerCreateInfo.addressModeV = VK_SAMPLER_ADDRESS_MODE_REPEAT;
			samplerCreateInfo.addressModeW = VK_SAMPLER_ADDRESS_MODE_REPEAT;
			samplerCreateInfo.mipLodBias = 0.0f;
			samplerCreateInfo.compareOp = VK_COMPARE_OP_NEVER;
			samplerCreateInfo.minLod = 0.0f;
			samplerCreateInfo.maxLod = 0.0f;
			samplerCreateInfo.maxAnisotropy = 1.0f;
			VK_CHECK_RESULT(vkCreateSampler(device->logicalDevice, &samplerCreateInfo, nullptr, &sampler));

			// Create image view
			VkImageViewCreateInfo viewCreateInfo = {};
			viewCreateInfo.sType = VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;
			viewCreateInfo.pNext = NULL;
			viewCreateInfo.viewType = VK_IMAGE_VIEW_TYPE_2D;
			viewCreateInfo.format = format;
			viewCreateInfo.components = { VK_COMPONENT_SWIZZLE_R, VK_COMPONENT_SWIZZLE_G, VK_COMPONENT_SWIZZLE_B, VK_COMPONENT_SWIZZLE_A };
			viewCreateInfo.subresourceRange = { VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1 };
			viewCreateInfo.subresourceRange.levelCount = 1;
			viewCreateInfo.image = image;
			VK_CHECK_RESULT(vkCreateImageView(device->logicalDevice, &viewCreateInfo, nullptr, &view));

			// Update descriptor image info member that can be used for setting up descriptor sets
			updateDescriptor();
		}

		void loadFromDxgiSharedHandle(
			void *sharedTextureHandle,
			VkFormat format,
			VkFormat viewFormat,
			uint32_t width, uint32_t height,
			vks::VulkanDevice *device,
			VkQueue queue,
			VkImageUsageFlags imageUsageFlags = VK_IMAGE_USAGE_SAMPLED_BIT,
			VkImageLayout imageLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL )
		{
			this->device = device;
			mipLevels = 1;
			this->width = width;
			this->height = height;

			VkExternalMemoryHandleTypeFlagBits handleType = VK_EXTERNAL_MEMORY_HANDLE_TYPE_D3D11_TEXTURE_KMT_BIT;

			// Get device properties for the requested texture format
			VkPhysicalDeviceImageFormatInfo2 formatInfo{};
			formatInfo.sType = VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_IMAGE_FORMAT_INFO_2;
			formatInfo.format = format;
			formatInfo.usage = imageUsageFlags;
			formatInfo.tiling = VK_IMAGE_TILING_OPTIMAL;

			VkPhysicalDeviceExternalImageFormatInfo externalFormatInfo{};
			externalFormatInfo.sType = VK_STRUCTURE_TYPE_PHYSICAL_DEVICE_EXTERNAL_IMAGE_FORMAT_INFO;
			formatInfo.pNext = &externalFormatInfo;
			externalFormatInfo.handleType = handleType;

			VkImageFormatProperties2 imageFormatProperties{};
			VkExternalImageFormatProperties externalImageFormatProperties{};
			imageFormatProperties.sType = VK_STRUCTURE_TYPE_IMAGE_FORMAT_PROPERTIES_2;
			imageFormatProperties.pNext = &externalImageFormatProperties;
			externalImageFormatProperties.sType = VK_STRUCTURE_TYPE_EXTERNAL_IMAGE_FORMAT_PROPERTIES;
			VK_CHECK_RESULT( vkGetPhysicalDeviceImageFormatProperties2( device->physicalDevice, &formatInfo, &imageFormatProperties ) );
			assert( ( externalImageFormatProperties.externalMemoryProperties.externalMemoryFeatures & VK_EXTERNAL_MEMORY_FEATURE_IMPORTABLE_BIT ) != 0 );

			VkMemoryRequirements2 memReqs{};
			memReqs.sType = VK_STRUCTURE_TYPE_MEMORY_REQUIREMENTS_2;
			VkImageMemoryRequirementsInfo2 memInfo{ VK_STRUCTURE_TYPE_IMAGE_MEMORY_REQUIREMENTS_INFO_2 };

			VkMemoryDedicatedRequirements dedicatedReqs{};
			if ( externalImageFormatProperties.externalMemoryProperties.externalMemoryFeatures & VK_EXTERNAL_MEMORY_FEATURE_DEDICATED_ONLY_BIT )
			{
				dedicatedReqs.sType = VK_STRUCTURE_TYPE_MEMORY_DEDICATED_REQUIREMENTS;
				memReqs.pNext = &dedicatedReqs;
			}

			// Create optimal tiled target image
			VkImageCreateInfo imageCreateInfo{};
			imageCreateInfo.sType = VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO;
			imageCreateInfo.imageType = VK_IMAGE_TYPE_2D;
			imageCreateInfo.format = format;
			imageCreateInfo.flags = 0;
			imageCreateInfo.mipLevels = mipLevels;
			imageCreateInfo.arrayLayers = 1;
			imageCreateInfo.samples = VK_SAMPLE_COUNT_1_BIT;
			imageCreateInfo.tiling = VK_IMAGE_TILING_OPTIMAL;
			imageCreateInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;
			imageCreateInfo.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
			imageCreateInfo.extent = { width, height, 1 };
			imageCreateInfo.usage = imageUsageFlags;

			if ( format != viewFormat )
			{
				imageCreateInfo.flags |= VK_IMAGE_CREATE_MUTABLE_FORMAT_BIT;
			}

			VkExternalMemoryImageCreateInfo externalCreateInfo{};
			externalCreateInfo.sType = VK_STRUCTURE_TYPE_EXTERNAL_MEMORY_IMAGE_CREATE_INFO;
			externalCreateInfo.handleTypes = handleType;
			imageCreateInfo.pNext = &externalCreateInfo;

			VkDedicatedAllocationImageCreateInfoNV dedicatedAllocationImageCreateInfo = { VK_STRUCTURE_TYPE_DEDICATED_ALLOCATION_IMAGE_CREATE_INFO_NV };
			if ( externalImageFormatProperties.externalMemoryProperties.externalMemoryFeatures & VK_EXTERNAL_MEMORY_FEATURE_DEDICATED_ONLY_BIT )
			{
				externalCreateInfo.pNext = &dedicatedAllocationImageCreateInfo;
				dedicatedAllocationImageCreateInfo.dedicatedAllocation = VK_TRUE;
			}

			VK_CHECK_RESULT( vkCreateImage( device->logicalDevice, &imageCreateInfo, nullptr, &image ) );
			printf( "Image 0x%llX function %s\n", (size_t)image, __FUNCTION__ );

			memInfo.image = image;

			vkGetImageMemoryRequirements2( device->logicalDevice, &memInfo, &memReqs );

			VkMemoryAllocateInfo memAllocInfo{};
			memAllocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;

			memAllocInfo.allocationSize = memReqs.memoryRequirements.size;
			memAllocInfo.memoryTypeIndex = device->getMemoryType( memReqs.memoryRequirements.memoryTypeBits, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT );

			VkImportMemoryWin32HandleInfoKHR memAllocInfoWin32{ VK_STRUCTURE_TYPE_IMPORT_MEMORY_WIN32_HANDLE_INFO_KHR };
			memAllocInfoWin32.handleType = handleType;
			memAllocInfoWin32.handle = sharedTextureHandle;
			memAllocInfo.pNext = &memAllocInfoWin32;

			VkMemoryDedicatedAllocateInfo dedicatedAllocInfo{};
			if ( dedicatedReqs.requiresDedicatedAllocation )
			{
				dedicatedAllocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_DEDICATED_ALLOCATE_INFO;
				memAllocInfoWin32.pNext = &dedicatedAllocInfo;
				dedicatedAllocInfo.image = image;
			}

			VK_CHECK_RESULT( vkAllocateMemory( device->logicalDevice, &memAllocInfo, nullptr, &deviceMemory ) );
			VK_CHECK_RESULT( vkBindImageMemory( device->logicalDevice, image, deviceMemory, 0 ) );

			VkImageSubresourceRange subresourceRange = {};
			subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
			subresourceRange.baseMipLevel = 0;
			subresourceRange.levelCount = mipLevels;
			subresourceRange.layerCount = 1;

			// Change texture image layout to shader read after all mip levels have been copied
			this->imageLayout = imageLayout;

			VkSamplerCreateInfo samplerCreateInfo{};
			samplerCreateInfo.sType = VK_STRUCTURE_TYPE_SAMPLER_CREATE_INFO;
			samplerCreateInfo.magFilter = VK_FILTER_LINEAR;
			samplerCreateInfo.minFilter = VK_FILTER_LINEAR;
			samplerCreateInfo.mipmapMode = VK_SAMPLER_MIPMAP_MODE_LINEAR;
			samplerCreateInfo.addressModeU = VK_SAMPLER_ADDRESS_MODE_REPEAT;
			samplerCreateInfo.addressModeV = VK_SAMPLER_ADDRESS_MODE_REPEAT;
			samplerCreateInfo.addressModeW = VK_SAMPLER_ADDRESS_MODE_REPEAT;
			samplerCreateInfo.mipLodBias = 0.0f;
			samplerCreateInfo.compareOp = VK_COMPARE_OP_NEVER;
			samplerCreateInfo.minLod = 0.0f;
			samplerCreateInfo.maxLod = (float)mipLevels;
			samplerCreateInfo.maxAnisotropy = device->enabledFeatures.samplerAnisotropy ? device->properties.limits.maxSamplerAnisotropy : 1.0f;
			samplerCreateInfo.anisotropyEnable = device->enabledFeatures.samplerAnisotropy;
			samplerCreateInfo.borderColor = VK_BORDER_COLOR_FLOAT_OPAQUE_WHITE;
			VK_CHECK_RESULT( vkCreateSampler( device->logicalDevice, &samplerCreateInfo, nullptr, &sampler ) );

			VkImageViewCreateInfo viewCreateInfo{};
			viewCreateInfo.sType = VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;
			viewCreateInfo.viewType = VK_IMAGE_VIEW_TYPE_2D;
			viewCreateInfo.format = viewFormat;
			viewCreateInfo.components = { VK_COMPONENT_SWIZZLE_R, VK_COMPONENT_SWIZZLE_G, VK_COMPONENT_SWIZZLE_B, VK_COMPONENT_SWIZZLE_A };
			viewCreateInfo.subresourceRange = { VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1 };
			viewCreateInfo.subresourceRange.levelCount = mipLevels;
			viewCreateInfo.image = image;
			VK_CHECK_RESULT( vkCreateImageView( device->logicalDevice, &viewCreateInfo, nullptr, &view ) );

			VkCommandBuffer layoutCmd = device->createCommandBuffer( VK_COMMAND_BUFFER_LEVEL_PRIMARY, true );

			this->imageLayout = imageLayout;
			{
				VkImageMemoryBarrier imageMemoryBarrier{};
				imageMemoryBarrier.sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER;
				imageMemoryBarrier.oldLayout = VK_IMAGE_LAYOUT_UNDEFINED;
				imageMemoryBarrier.newLayout = imageLayout;
				imageMemoryBarrier.srcAccessMask = 0;
				imageMemoryBarrier.dstAccessMask = VK_ACCESS_TRANSFER_READ_BIT;
				imageMemoryBarrier.image = image;
				imageMemoryBarrier.subresourceRange = subresourceRange;
				vkCmdPipelineBarrier( layoutCmd, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, 0, 0, nullptr, 0, nullptr, 1, &imageMemoryBarrier );
			}

			device->flushCommandBuffer( layoutCmd, queue, true );

			updateDescriptor();
		}

		/*
	Load a texture from a glTF image (stored as vector of chars loaded via stb_image)
	Also generates the mip chain as glTF images are stored as jpg or png without any mips
*/
		void fromglTfImage( tinygltf::Image &gltfimage, TextureSampler textureSampler, vks::VulkanDevice *device, VkQueue copyQueue )
		{
			this->device = device;

			unsigned char* buffer = nullptr;
			VkDeviceSize bufferSize = 0;
			bool deleteBuffer = false;
			if ( gltfimage.component == 3 ) {
				// Most devices don't support RGB only on Vulkan so convert if necessary
				// TODO: Check actual format support and transform only if required
				bufferSize = gltfimage.width * gltfimage.height * 4;
				buffer = new unsigned char[bufferSize];
				unsigned char* rgba = buffer;
				unsigned char* rgb = &gltfimage.image[0];
				for ( int32_t i = 0; i < gltfimage.width * gltfimage.height; ++i ) {
					for ( int32_t j = 0; j < 3; ++j ) {
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
			mipLevels = static_cast<uint32_t>( floor( log2( std::max( width, height ) ) ) + 1.0 );

			vkGetPhysicalDeviceFormatProperties( device->physicalDevice, format, &formatProperties );
			assert( formatProperties.optimalTilingFeatures & VK_FORMAT_FEATURE_BLIT_SRC_BIT );
			assert( formatProperties.optimalTilingFeatures & VK_FORMAT_FEATURE_BLIT_DST_BIT );

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
			VK_CHECK_RESULT( vkCreateBuffer( device->logicalDevice, &bufferCreateInfo, nullptr, &stagingBuffer ) );
			vkGetBufferMemoryRequirements( device->logicalDevice, stagingBuffer, &memReqs );
			memAllocInfo.allocationSize = memReqs.size;
			memAllocInfo.memoryTypeIndex = device->getMemoryType( memReqs.memoryTypeBits, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT );
			VK_CHECK_RESULT( vkAllocateMemory( device->logicalDevice, &memAllocInfo, nullptr, &stagingMemory ) );
			VK_CHECK_RESULT( vkBindBufferMemory( device->logicalDevice, stagingBuffer, stagingMemory, 0 ) );

			uint8_t *data;
			VK_CHECK_RESULT( vkMapMemory( device->logicalDevice, stagingMemory, 0, memReqs.size, 0, (void **)&data ) );
			memcpy( data, buffer, bufferSize );
			vkUnmapMemory( device->logicalDevice, stagingMemory );

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
			VK_CHECK_RESULT( vkCreateImage( device->logicalDevice, &imageCreateInfo, nullptr, &image ) );
			printf( "Image 0x%llX function %s\n", (size_t)image, __FUNCTION__ );

			vkGetImageMemoryRequirements( device->logicalDevice, image, &memReqs );
			memAllocInfo.allocationSize = memReqs.size;
			memAllocInfo.memoryTypeIndex = device->getMemoryType( memReqs.memoryTypeBits, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT );
			VK_CHECK_RESULT( vkAllocateMemory( device->logicalDevice, &memAllocInfo, nullptr, &deviceMemory ) );
			VK_CHECK_RESULT( vkBindImageMemory( device->logicalDevice, image, deviceMemory, 0 ) );

			VkCommandBuffer copyCmd = device->createCommandBuffer( VK_COMMAND_BUFFER_LEVEL_PRIMARY, true );

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
				vkCmdPipelineBarrier( copyCmd, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, 0, 0, nullptr, 0, nullptr, 1, &imageMemoryBarrier );
			}

			VkBufferImageCopy bufferCopyRegion = {};
			bufferCopyRegion.imageSubresource.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
			bufferCopyRegion.imageSubresource.mipLevel = 0;
			bufferCopyRegion.imageSubresource.baseArrayLayer = 0;
			bufferCopyRegion.imageSubresource.layerCount = 1;
			bufferCopyRegion.imageExtent.width = width;
			bufferCopyRegion.imageExtent.height = height;
			bufferCopyRegion.imageExtent.depth = 1;

			vkCmdCopyBufferToImage( copyCmd, stagingBuffer, image, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL, 1, &bufferCopyRegion );

			{
				VkImageMemoryBarrier imageMemoryBarrier{};
				imageMemoryBarrier.sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER;
				imageMemoryBarrier.oldLayout = VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL;
				imageMemoryBarrier.newLayout = VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL;
				imageMemoryBarrier.srcAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;
				imageMemoryBarrier.dstAccessMask = VK_ACCESS_TRANSFER_READ_BIT;
				imageMemoryBarrier.image = image;
				imageMemoryBarrier.subresourceRange = subresourceRange;
				vkCmdPipelineBarrier( copyCmd, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, 0, 0, nullptr, 0, nullptr, 1, &imageMemoryBarrier );
			}

			device->flushCommandBuffer( copyCmd, copyQueue, true );

			vkFreeMemory( device->logicalDevice, stagingMemory, nullptr );
			vkDestroyBuffer( device->logicalDevice, stagingBuffer, nullptr );

			// Generate the mip chain (glTF uses jpg and png, so we need to create this manually)
			VkCommandBuffer blitCmd = device->createCommandBuffer( VK_COMMAND_BUFFER_LEVEL_PRIMARY, true );
			for ( uint32_t i = 1; i < mipLevels; i++ ) {
				VkImageBlit imageBlit{};

				imageBlit.srcSubresource.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
				imageBlit.srcSubresource.layerCount = 1;
				imageBlit.srcSubresource.mipLevel = i - 1;
				imageBlit.srcOffsets[1].x = int32_t( width >> ( i - 1 ) );
				imageBlit.srcOffsets[1].y = int32_t( height >> ( i - 1 ) );
				imageBlit.srcOffsets[1].z = 1;

				imageBlit.dstSubresource.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
				imageBlit.dstSubresource.layerCount = 1;
				imageBlit.dstSubresource.mipLevel = i;
				imageBlit.dstOffsets[1].x = int32_t( width >> i );
				imageBlit.dstOffsets[1].y = int32_t( height >> i );
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
					vkCmdPipelineBarrier( blitCmd, VK_PIPELINE_STAGE_TRANSFER_BIT, VK_PIPELINE_STAGE_TRANSFER_BIT, 0, 0, nullptr, 0, nullptr, 1, &imageMemoryBarrier );
				}

				vkCmdBlitImage( blitCmd, image, VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL, image, VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL, 1, &imageBlit, VK_FILTER_LINEAR );

				{
					VkImageMemoryBarrier imageMemoryBarrier{};
					imageMemoryBarrier.sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER;
					imageMemoryBarrier.oldLayout = VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL;
					imageMemoryBarrier.newLayout = VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL;
					imageMemoryBarrier.srcAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;
					imageMemoryBarrier.dstAccessMask = VK_ACCESS_TRANSFER_READ_BIT;
					imageMemoryBarrier.image = image;
					imageMemoryBarrier.subresourceRange = mipSubRange;
					vkCmdPipelineBarrier( blitCmd, VK_PIPELINE_STAGE_TRANSFER_BIT, VK_PIPELINE_STAGE_TRANSFER_BIT, 0, 0, nullptr, 0, nullptr, 1, &imageMemoryBarrier );
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
				vkCmdPipelineBarrier( blitCmd, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, 0, 0, nullptr, 0, nullptr, 1, &imageMemoryBarrier );
			}

			device->flushCommandBuffer( blitCmd, copyQueue, true );

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
			VK_CHECK_RESULT( vkCreateSampler( device->logicalDevice, &samplerInfo, nullptr, &sampler ) );

			VkImageViewCreateInfo viewInfo{};
			viewInfo.sType = VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;
			viewInfo.image = image;
			viewInfo.viewType = VK_IMAGE_VIEW_TYPE_2D;
			viewInfo.format = format;
			viewInfo.components = { VK_COMPONENT_SWIZZLE_R, VK_COMPONENT_SWIZZLE_G, VK_COMPONENT_SWIZZLE_B, VK_COMPONENT_SWIZZLE_A };
			viewInfo.subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
			viewInfo.subresourceRange.layerCount = 1;
			viewInfo.subresourceRange.levelCount = mipLevels;
			VK_CHECK_RESULT( vkCreateImageView( device->logicalDevice, &viewInfo, nullptr, &view ) );

			descriptor.sampler = sampler;
			descriptor.imageView = view;
			descriptor.imageLayout = imageLayout;

			if ( deleteBuffer )
				delete[] buffer;

		}

	};

	class TextureCubeMap : public Texture {
	public:
		void loadFromFile(
			std::string filename,
			VkFormat format,
			vks::VulkanDevice *device,
			VkQueue copyQueue,
			VkImageUsageFlags imageUsageFlags = VK_IMAGE_USAGE_SAMPLED_BIT,
			VkImageLayout imageLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL)
		{
#if defined(__ANDROID__)
			// Textures are stored inside the apk on Android (compressed)
			// So they need to be loaded via the asset manager
			AAsset* asset = AAssetManager_open(androidApp->activity->assetManager, filename.c_str(), AASSET_MODE_STREAMING);
			if (!asset) {
				LOGE("Could not load texture %s", filename.c_str());
				exit(-1);
			}
			size_t size = AAsset_getLength(asset);
			assert(size > 0);

			void *textureData = malloc(size);
			AAsset_read(asset, textureData, size);
			AAsset_close(asset);

			gli::texture_cube texCube(gli::load((const char*)textureData, size));

			free(textureData);
#else
			gli::texture_cube texCube(gli::load(filename));
#endif	
			assert(!texCube.empty());

			this->device = device;
			width = static_cast<uint32_t>(texCube.extent().x);
			height = static_cast<uint32_t>(texCube.extent().y);
			mipLevels = static_cast<uint32_t>(texCube.levels());

			VkMemoryAllocateInfo memAllocInfo{};
			memAllocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;
			VkMemoryRequirements memReqs;

			// Create a host-visible staging buffer that contains the raw image data
			VkBuffer stagingBuffer;
			VkDeviceMemory stagingMemory;

			VkBufferCreateInfo bufferCreateInfo{};
			bufferCreateInfo.sType = VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO;
			bufferCreateInfo.size = texCube.size();
			// This buffer is used as a transfer source for the buffer copy
			bufferCreateInfo.usage = VK_BUFFER_USAGE_TRANSFER_SRC_BIT;
			bufferCreateInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;

			VK_CHECK_RESULT(vkCreateBuffer(device->logicalDevice, &bufferCreateInfo, nullptr, &stagingBuffer));

			// Get memory requirements for the staging buffer (alignment, memory type bits)
			vkGetBufferMemoryRequirements(device->logicalDevice, stagingBuffer, &memReqs);

			memAllocInfo.allocationSize = memReqs.size;
			// Get memory type index for a host visible buffer
			memAllocInfo.memoryTypeIndex = device->getMemoryType(memReqs.memoryTypeBits, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT);

			VK_CHECK_RESULT(vkAllocateMemory(device->logicalDevice, &memAllocInfo, nullptr, &stagingMemory));
			VK_CHECK_RESULT(vkBindBufferMemory(device->logicalDevice, stagingBuffer, stagingMemory, 0));

			// Copy texture data into staging buffer
			uint8_t *data;
			VK_CHECK_RESULT(vkMapMemory(device->logicalDevice, stagingMemory, 0, memReqs.size, 0, (void **)&data));
			memcpy(data, texCube.data(), texCube.size());
			vkUnmapMemory(device->logicalDevice, stagingMemory);

			// Setup buffer copy regions for each face including all of it's miplevels
			std::vector<VkBufferImageCopy> bufferCopyRegions;
			size_t offset = 0;

			for (uint32_t face = 0; face < 6; face++) {
				for (uint32_t level = 0; level < mipLevels; level++) {
					VkBufferImageCopy bufferCopyRegion = {};
					bufferCopyRegion.imageSubresource.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
					bufferCopyRegion.imageSubresource.mipLevel = level;
					bufferCopyRegion.imageSubresource.baseArrayLayer = face;
					bufferCopyRegion.imageSubresource.layerCount = 1;
					bufferCopyRegion.imageExtent.width = static_cast<uint32_t>(texCube[face][level].extent().x);
					bufferCopyRegion.imageExtent.height = static_cast<uint32_t>(texCube[face][level].extent().y);
					bufferCopyRegion.imageExtent.depth = 1;
					bufferCopyRegion.bufferOffset = offset;

					bufferCopyRegions.push_back(bufferCopyRegion);

					// Increase offset into staging buffer for next level / face
					offset += texCube[face][level].size();
				}
			}

			// Create optimal tiled target image
			VkImageCreateInfo imageCreateInfo{};
			imageCreateInfo.sType = VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO;
			imageCreateInfo.imageType = VK_IMAGE_TYPE_2D;
			imageCreateInfo.format = format;
			imageCreateInfo.mipLevels = mipLevels;
			imageCreateInfo.samples = VK_SAMPLE_COUNT_1_BIT;
			imageCreateInfo.tiling = VK_IMAGE_TILING_OPTIMAL;
			imageCreateInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;
			imageCreateInfo.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
			imageCreateInfo.extent = { width, height, 1 };
			imageCreateInfo.usage = imageUsageFlags;
			// Ensure that the TRANSFER_DST bit is set for staging
			if (!(imageCreateInfo.usage & VK_IMAGE_USAGE_TRANSFER_DST_BIT)) {
				imageCreateInfo.usage |= VK_IMAGE_USAGE_TRANSFER_DST_BIT;
			}
			// Cube faces count as array layers in Vulkan
			imageCreateInfo.arrayLayers = 6;
			// This flag is required for cube map images
			imageCreateInfo.flags = VK_IMAGE_CREATE_CUBE_COMPATIBLE_BIT;


			VK_CHECK_RESULT(vkCreateImage(device->logicalDevice, &imageCreateInfo, nullptr, &image));
			printf( "Image 0x%llX function %s\n", (size_t)image, __FUNCTION__ );

			vkGetImageMemoryRequirements(device->logicalDevice, image, &memReqs);

			memAllocInfo.allocationSize = memReqs.size;
			memAllocInfo.memoryTypeIndex = device->getMemoryType(memReqs.memoryTypeBits, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT);

			VK_CHECK_RESULT(vkAllocateMemory(device->logicalDevice, &memAllocInfo, nullptr, &deviceMemory));
			VK_CHECK_RESULT(vkBindImageMemory(device->logicalDevice, image, deviceMemory, 0));

			// Use a separate command buffer for texture loading
			VkCommandBuffer copyCmd = device->createCommandBuffer(VK_COMMAND_BUFFER_LEVEL_PRIMARY, true);

			// Image barrier for optimal image (target)
			// Set initial layout for all array layers (faces) of the optimal (target) tiled texture
			VkImageSubresourceRange subresourceRange = {};
			subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
			subresourceRange.baseMipLevel = 0;
			subresourceRange.levelCount = mipLevels;
			subresourceRange.layerCount = 6;

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

			// Copy the cube map faces from the staging buffer to the optimal tiled image
			vkCmdCopyBufferToImage(
				copyCmd,
				stagingBuffer,
				image,
				VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL,
				static_cast<uint32_t>(bufferCopyRegions.size()),
				bufferCopyRegions.data());

			// Change texture image layout to shader read after all faces have been copied
			this->imageLayout = imageLayout;
			{
				VkImageMemoryBarrier imageMemoryBarrier{};
				imageMemoryBarrier.sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER;
				imageMemoryBarrier.oldLayout = VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL;
				imageMemoryBarrier.newLayout = imageLayout;
				imageMemoryBarrier.srcAccessMask = VK_ACCESS_TRANSFER_WRITE_BIT;
				imageMemoryBarrier.dstAccessMask = VK_ACCESS_TRANSFER_READ_BIT;
				imageMemoryBarrier.image = image;
				imageMemoryBarrier.subresourceRange = subresourceRange;
				vkCmdPipelineBarrier(copyCmd, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, 0, 0, nullptr, 0, nullptr, 1, &imageMemoryBarrier);
			}

			device->flushCommandBuffer(copyCmd, copyQueue);

			// Create sampler
			VkSamplerCreateInfo samplerCreateInfo{};
			samplerCreateInfo.sType = VK_STRUCTURE_TYPE_SAMPLER_CREATE_INFO;
			samplerCreateInfo.magFilter = VK_FILTER_LINEAR;
			samplerCreateInfo.minFilter = VK_FILTER_LINEAR;
			samplerCreateInfo.mipmapMode = VK_SAMPLER_MIPMAP_MODE_LINEAR;
			samplerCreateInfo.addressModeU = VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE;
			samplerCreateInfo.addressModeV = samplerCreateInfo.addressModeU;
			samplerCreateInfo.addressModeW = samplerCreateInfo.addressModeU;
			samplerCreateInfo.mipLodBias = 0.0f;
			samplerCreateInfo.maxAnisotropy = device->enabledFeatures.samplerAnisotropy ? device->properties.limits.maxSamplerAnisotropy : 1.0f;
			samplerCreateInfo.anisotropyEnable = device->enabledFeatures.samplerAnisotropy;
			samplerCreateInfo.compareOp = VK_COMPARE_OP_NEVER;
			samplerCreateInfo.minLod = 0.0f;
			samplerCreateInfo.maxLod = (float)mipLevels;
			samplerCreateInfo.borderColor = VK_BORDER_COLOR_FLOAT_OPAQUE_WHITE;
			VK_CHECK_RESULT(vkCreateSampler(device->logicalDevice, &samplerCreateInfo, nullptr, &sampler));

			// Create image view
			VkImageViewCreateInfo viewCreateInfo{};
			viewCreateInfo.sType = VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;
			viewCreateInfo.viewType = VK_IMAGE_VIEW_TYPE_CUBE;
			viewCreateInfo.format = format;
			viewCreateInfo.components = { VK_COMPONENT_SWIZZLE_R, VK_COMPONENT_SWIZZLE_G, VK_COMPONENT_SWIZZLE_B, VK_COMPONENT_SWIZZLE_A };
			viewCreateInfo.subresourceRange = { VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1 };
			viewCreateInfo.subresourceRange.layerCount = 6;
			viewCreateInfo.subresourceRange.levelCount = mipLevels;
			viewCreateInfo.image = image;
			VK_CHECK_RESULT(vkCreateImageView(device->logicalDevice, &viewCreateInfo, nullptr, &view));

			// Clean up staging resources
			vkFreeMemory(device->logicalDevice, stagingMemory, nullptr);
			vkDestroyBuffer(device->logicalDevice, stagingBuffer, nullptr);

			// Update descriptor image info member that can be used for setting up descriptor sets
			updateDescriptor();
		}
	};

	class RenderTarget
	{
	public:
		vks::VulkanDevice *vulkanDevice;
		Texture color;
		Texture colorMultisample;
		Texture depthStencil;
		Texture depthStencilMultisample;
		VkRenderPass renderPass = VK_NULL_HANDLE;
		VkFramebuffer frameBuffer = VK_NULL_HANDLE;
		VkImageLayout colorLayout = VK_IMAGE_LAYOUT_UNDEFINED;
		VkImageLayout depthStencilLayout = VK_IMAGE_LAYOUT_UNDEFINED;
		bool multiSample = false;
		void destroy()
		{
			color.destroy();
			depthStencil.destroy();

			vkDestroyRenderPass( vulkanDevice->logicalDevice, renderPass, nullptr );
			vkDestroyFramebuffer( vulkanDevice->logicalDevice, frameBuffer, nullptr );
		}

		bool formatHasStencil( VkFormat format )
		{
			switch ( format )
			{
			case VK_FORMAT_S8_UINT:
			case VK_FORMAT_D16_UNORM_S8_UINT:
			case VK_FORMAT_D24_UNORM_S8_UINT:
			case VK_FORMAT_D32_SFLOAT_S8_UINT:
				return true;

			default: 
				return false;
			}
		}

		void init(
			VkFormat colorFormat,
			VkFormat depthFormat,
			uint32_t width,
			uint32_t height,
			vks::VulkanDevice *vulkanDevice,
			VkQueue setupQueue,
			bool multiSample,
			VkFilter filter = VK_FILTER_LINEAR,
			VkImageUsageFlags imageUsageFlags = ( VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT | VK_IMAGE_USAGE_SAMPLED_BIT | VK_IMAGE_USAGE_TRANSFER_SRC_BIT ),
			VkImageLayout imageLayout = VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL )
		{
			this->vulkanDevice = vulkanDevice;
			this->multiSample = multiSample;

			//-----------------------------//
			//      Create color target    //
			//-----------------------------//

			color.device = vulkanDevice;
			color.width = width;
			color.height = height;
			color.mipLevels = 1;

			VkMemoryAllocateInfo memAllocInfo{};
			memAllocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;
			VkMemoryRequirements memReqs;

			// Create optimal tiled target image
			VkImageCreateInfo imageCreateInfo{};
			imageCreateInfo.sType = VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO;
			imageCreateInfo.imageType = VK_IMAGE_TYPE_2D;
			imageCreateInfo.format = colorFormat;
			imageCreateInfo.mipLevels = color.mipLevels;
			imageCreateInfo.arrayLayers = 1;
			imageCreateInfo.samples = VK_SAMPLE_COUNT_1_BIT;
			imageCreateInfo.tiling = VK_IMAGE_TILING_OPTIMAL;
			imageCreateInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;
			imageCreateInfo.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
			imageCreateInfo.extent = { width, height, 1 };
			imageCreateInfo.usage = imageUsageFlags;
			// Ensure that the TRANSFER_DST bit is set for staging
			if ( !( imageCreateInfo.usage & VK_IMAGE_USAGE_TRANSFER_DST_BIT ) )
			{
				imageCreateInfo.usage |= VK_IMAGE_USAGE_TRANSFER_DST_BIT;
			}
			VK_CHECK_RESULT( vkCreateImage( vulkanDevice->logicalDevice, &imageCreateInfo, nullptr, &color.image ) );
			printf( "Image 0x%llX function %s\n", (size_t)color.image, __FUNCTION__ );

			vkGetImageMemoryRequirements( vulkanDevice->logicalDevice, color.image, &memReqs );

			memAllocInfo.allocationSize = memReqs.size;

			memAllocInfo.memoryTypeIndex = vulkanDevice->getMemoryType( memReqs.memoryTypeBits, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT );
			VK_CHECK_RESULT( vkAllocateMemory( vulkanDevice->logicalDevice, &memAllocInfo, nullptr, &color.deviceMemory ) );
			VK_CHECK_RESULT( vkBindImageMemory( vulkanDevice->logicalDevice, color.image, color.deviceMemory, 0 ) );

			VkImageSubresourceRange subresourceRange = {};
			subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
			subresourceRange.baseMipLevel = 0;
			subresourceRange.levelCount = color.mipLevels;
			subresourceRange.layerCount = 1;

			color.imageLayout = imageLayout;

			// Create image view
			VkImageViewCreateInfo viewCreateInfo = {};
			viewCreateInfo.sType = VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;
			viewCreateInfo.pNext = NULL;
			viewCreateInfo.viewType = VK_IMAGE_VIEW_TYPE_2D;
			viewCreateInfo.format = colorFormat;
			viewCreateInfo.components = { VK_COMPONENT_SWIZZLE_IDENTITY, VK_COMPONENT_SWIZZLE_IDENTITY, VK_COMPONENT_SWIZZLE_IDENTITY, VK_COMPONENT_SWIZZLE_IDENTITY };
			viewCreateInfo.subresourceRange = { VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1 };
			viewCreateInfo.subresourceRange.levelCount = 1;
			viewCreateInfo.image = color.image;
			VK_CHECK_RESULT( vkCreateImageView( vulkanDevice->logicalDevice, &viewCreateInfo, nullptr, &color.view ) );

			// Update descriptor image info member that can be used for setting up descriptor sets
			color.updateDescriptor();

			//-----------------------------//
			// Create depth/stencil target //
			//-----------------------------//

			depthStencil.device = vulkanDevice;
			depthStencil.width = width;
			depthStencil.height = height;
			depthStencil.mipLevels = 1;

			imageCreateInfo.imageType = VK_IMAGE_TYPE_2D;
			imageCreateInfo.format = depthFormat;
			imageCreateInfo.usage = VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT;
			VK_CHECK_RESULT( vkCreateImage( vulkanDevice->logicalDevice, &imageCreateInfo, nullptr, &depthStencil.image ) );
			printf( "Image 0x%llX function %s\n", (size_t)depthStencil.image, __FUNCTION__ );

			vkGetImageMemoryRequirements( vulkanDevice->logicalDevice, depthStencil.image, &memReqs );

			memAllocInfo.allocationSize = memReqs.size;
			memAllocInfo.memoryTypeIndex = vulkanDevice->getMemoryType( memReqs.memoryTypeBits, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT );
			VK_CHECK_RESULT( vkAllocateMemory( vulkanDevice->logicalDevice, &memAllocInfo, nullptr, &depthStencil.deviceMemory ) );
			VkResult result = vkBindImageMemory( vulkanDevice->logicalDevice, depthStencil.image, depthStencil.deviceMemory, 0 );
			VK_CHECK_RESULT( result );

			viewCreateInfo.image = depthStencil.image;
			viewCreateInfo.format = imageCreateInfo.format;
			viewCreateInfo.subresourceRange.aspectMask = VK_IMAGE_ASPECT_DEPTH_BIT;
			VK_CHECK_RESULT( vkCreateImageView( vulkanDevice->logicalDevice, &viewCreateInfo, nullptr, &depthStencil.view ) );

			if ( multiSample )
			{
				//-------------------------------------//
				//  Create multisample color target    //
				//-------------------------------------//
				colorMultisample.device = vulkanDevice;
				colorMultisample.width = width;
				colorMultisample.height = height;
				colorMultisample.mipLevels = 1;

				VkImageCreateInfo imageCI{};
				imageCI.sType = VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO;
				imageCI.imageType = VK_IMAGE_TYPE_2D;
				imageCI.format = colorFormat;
				imageCI.extent.width = width;
				imageCI.extent.height = height;
				imageCI.extent.depth = 1;
				imageCI.mipLevels = 1;
				imageCI.arrayLayers = 1;
				imageCI.sharingMode = VK_SHARING_MODE_EXCLUSIVE;
				imageCI.tiling = VK_IMAGE_TILING_OPTIMAL;
				imageCI.samples = VK_SAMPLE_COUNT_4_BIT;
				imageCI.usage = VK_IMAGE_USAGE_TRANSIENT_ATTACHMENT_BIT | VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT;
				imageCI.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
				VK_CHECK_RESULT( vkCreateImage( vulkanDevice->logicalDevice, &imageCI, nullptr, &colorMultisample.image ) );
				printf( "Image 0x%llX function %s\n", (size_t)colorMultisample.image, __FUNCTION__ );

				VkMemoryRequirements memReqs;
				vkGetImageMemoryRequirements( vulkanDevice->logicalDevice, colorMultisample.image, &memReqs );
				VkMemoryAllocateInfo memAllocInfo{};
				memAllocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;
				memAllocInfo.allocationSize = memReqs.size;
				VkBool32 lazyMemTypePresent;
				memAllocInfo.memoryTypeIndex = vulkanDevice->getMemoryType( memReqs.memoryTypeBits, VK_MEMORY_PROPERTY_LAZILY_ALLOCATED_BIT, &lazyMemTypePresent );
				if ( !lazyMemTypePresent ) {
					memAllocInfo.memoryTypeIndex = vulkanDevice->getMemoryType( memReqs.memoryTypeBits, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT );
				}
				VK_CHECK_RESULT( vkAllocateMemory( vulkanDevice->logicalDevice, &memAllocInfo, nullptr, &colorMultisample.deviceMemory ) );
				vkBindImageMemory( vulkanDevice->logicalDevice, colorMultisample.image, colorMultisample.deviceMemory, 0 );

				// Create image view for the MSAA target
				VkImageViewCreateInfo imageViewCI{};
				imageViewCI.sType = VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;
				imageViewCI.image = colorMultisample.image;
				imageViewCI.viewType = VK_IMAGE_VIEW_TYPE_2D;
				imageViewCI.format = colorFormat;
				imageViewCI.components.r = VK_COMPONENT_SWIZZLE_R;
				imageViewCI.components.g = VK_COMPONENT_SWIZZLE_G;
				imageViewCI.components.b = VK_COMPONENT_SWIZZLE_B;
				imageViewCI.components.a = VK_COMPONENT_SWIZZLE_A;
				imageViewCI.subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
				imageViewCI.subresourceRange.levelCount = 1;
				imageViewCI.subresourceRange.layerCount = 1;
				VK_CHECK_RESULT( vkCreateImageView( vulkanDevice->logicalDevice, &imageViewCI, nullptr, &colorMultisample.view ) );

				//-----------------------------------------//
				// Create multisample depth/stencil target //
				//-----------------------------------------//
				depthStencilMultisample.device = vulkanDevice;
				depthStencilMultisample.width = width;
				depthStencilMultisample.height = height;
				depthStencilMultisample.mipLevels = 1;

				imageCI.imageType = VK_IMAGE_TYPE_2D;
				imageCI.format = depthFormat;
				imageCI.extent.width = width;
				imageCI.extent.height = height;
				imageCI.extent.depth = 1;
				imageCI.mipLevels = 1;
				imageCI.arrayLayers = 1;
				imageCI.sharingMode = VK_SHARING_MODE_EXCLUSIVE;
				imageCI.tiling = VK_IMAGE_TILING_OPTIMAL;
				imageCI.samples = VK_SAMPLE_COUNT_4_BIT;
				imageCI.usage = VK_IMAGE_USAGE_TRANSIENT_ATTACHMENT_BIT | VK_IMAGE_USAGE_DEPTH_STENCIL_ATTACHMENT_BIT;
				imageCI.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
				VK_CHECK_RESULT( vkCreateImage( vulkanDevice->logicalDevice, &imageCI, nullptr, &depthStencilMultisample.image ) );
				printf( "Image 0x%llX function %s\n", (size_t)depthStencilMultisample.image, __FUNCTION__ );

				vkGetImageMemoryRequirements( vulkanDevice->logicalDevice, depthStencilMultisample.image, &memReqs );
				memAllocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;
				memAllocInfo.allocationSize = memReqs.size;
				memAllocInfo.memoryTypeIndex = vulkanDevice->getMemoryType( memReqs.memoryTypeBits, VK_MEMORY_PROPERTY_LAZILY_ALLOCATED_BIT, &lazyMemTypePresent );
				if ( !lazyMemTypePresent ) {
					memAllocInfo.memoryTypeIndex = vulkanDevice->getMemoryType( memReqs.memoryTypeBits, VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT );
				}
				VK_CHECK_RESULT( vkAllocateMemory( vulkanDevice->logicalDevice, &memAllocInfo, nullptr, &depthStencilMultisample.deviceMemory ) );
				vkBindImageMemory( vulkanDevice->logicalDevice, depthStencilMultisample.image, depthStencilMultisample.deviceMemory, 0 );

				// Create image view for the MSAA target
				imageViewCI.image = depthStencilMultisample.image;
				imageViewCI.viewType = VK_IMAGE_VIEW_TYPE_2D;
				imageViewCI.format = depthFormat;
				imageViewCI.components.r = VK_COMPONENT_SWIZZLE_R;
				imageViewCI.components.g = VK_COMPONENT_SWIZZLE_G;
				imageViewCI.components.b = VK_COMPONENT_SWIZZLE_B;
				imageViewCI.components.a = VK_COMPONENT_SWIZZLE_A;
				imageViewCI.subresourceRange.aspectMask = VK_IMAGE_ASPECT_DEPTH_BIT;
				if ( formatHasStencil( depthFormat ) )
				{
					imageViewCI.subresourceRange.aspectMask |= VK_IMAGE_ASPECT_STENCIL_BIT;
				}
				imageViewCI.subresourceRange.levelCount = 1;
				imageViewCI.subresourceRange.layerCount = 1;
				VK_CHECK_RESULT( vkCreateImageView( vulkanDevice->logicalDevice, &imageViewCI, nullptr, &depthStencilMultisample.view ) );
			}

			//-----------------------------//
			// Create a renderpass         //
			//-----------------------------//

			if ( multiSample )
			{
				std::array<VkAttachmentDescription, 4> attachments = {};

				// Multisampled attachment that we render to
				attachments[0].format = colorFormat;
				attachments[0].samples = VK_SAMPLE_COUNT_4_BIT;
				attachments[0].loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
				attachments[0].storeOp = VK_ATTACHMENT_STORE_OP_STORE;
				attachments[0].stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
				attachments[0].stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
				attachments[0].initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
				attachments[0].finalLayout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;

				// This is the frame buffer attachment to where the multisampled image
				// will be resolved to and which will be presented to the swapchain
				attachments[1].format = colorFormat;
				attachments[1].samples = VK_SAMPLE_COUNT_1_BIT;
				attachments[1].loadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
				attachments[1].storeOp = VK_ATTACHMENT_STORE_OP_STORE;
				attachments[1].stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
				attachments[1].stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
				attachments[1].initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
				attachments[1].finalLayout = VK_IMAGE_LAYOUT_PRESENT_SRC_KHR;

				// Multisampled depth attachment we render to
				attachments[2].format = depthFormat;
				attachments[2].samples = VK_SAMPLE_COUNT_4_BIT;
				attachments[2].loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
				attachments[2].storeOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
				attachments[2].stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
				attachments[2].stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
				attachments[2].initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
				attachments[2].finalLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;

				// Depth resolve attachment
				attachments[3].format = depthFormat;
				attachments[3].samples = VK_SAMPLE_COUNT_1_BIT;
				attachments[3].loadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
				attachments[3].storeOp = VK_ATTACHMENT_STORE_OP_STORE;
				attachments[3].stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
				attachments[3].stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
				attachments[3].initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
				attachments[3].finalLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;

				VkAttachmentReference colorReference = {};
				colorReference.attachment = 0;
				colorReference.layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;

				VkAttachmentReference depthReference = {};
				depthReference.attachment = 2;
				depthReference.layout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;

				// Resolve attachment reference for the color attachment
				VkAttachmentReference resolveReference = {};
				resolveReference.attachment = 1;
				resolveReference.layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;

				VkSubpassDescription subpass = {};
				subpass.pipelineBindPoint = VK_PIPELINE_BIND_POINT_GRAPHICS;
				subpass.colorAttachmentCount = 1;
				subpass.pColorAttachments = &colorReference;
				// Pass our resolve attachments to the sub pass
				subpass.pResolveAttachments = &resolveReference;
				subpass.pDepthStencilAttachment = &depthReference;

				std::array<VkSubpassDependency, 2> dependencies;

				dependencies[0].srcSubpass = VK_SUBPASS_EXTERNAL;
				dependencies[0].dstSubpass = 0;
				dependencies[0].srcStageMask = VK_PIPELINE_STAGE_BOTTOM_OF_PIPE_BIT;
				dependencies[0].dstStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
				dependencies[0].srcAccessMask = VK_ACCESS_MEMORY_READ_BIT;
				dependencies[0].dstAccessMask = VK_ACCESS_COLOR_ATTACHMENT_READ_BIT | VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
				dependencies[0].dependencyFlags = VK_DEPENDENCY_BY_REGION_BIT;

				dependencies[1].srcSubpass = 0;
				dependencies[1].dstSubpass = VK_SUBPASS_EXTERNAL;
				dependencies[1].srcStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
				dependencies[1].dstStageMask = VK_PIPELINE_STAGE_BOTTOM_OF_PIPE_BIT;
				dependencies[1].srcAccessMask = VK_ACCESS_COLOR_ATTACHMENT_READ_BIT | VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
				dependencies[1].dstAccessMask = VK_ACCESS_MEMORY_READ_BIT;
				dependencies[1].dependencyFlags = VK_DEPENDENCY_BY_REGION_BIT;

				VkRenderPassCreateInfo renderPassCI = {};
				renderPassCI.sType = VK_STRUCTURE_TYPE_RENDER_PASS_CREATE_INFO;
				renderPassCI.attachmentCount = static_cast<uint32_t>( attachments.size() );
				renderPassCI.pAttachments = attachments.data();
				renderPassCI.subpassCount = 1;
				renderPassCI.pSubpasses = &subpass;
				renderPassCI.dependencyCount = 2;
				renderPassCI.pDependencies = dependencies.data();
				VK_CHECK_RESULT( vkCreateRenderPass( vulkanDevice->logicalDevice, &renderPassCI, nullptr, &renderPass ) );
			}
			else
			{
				uint32_t nTotalAttachments = 2;
				VkAttachmentDescription attachmentDescs[2];
				VkAttachmentReference attachmentReferences[2];
				attachmentReferences[0].attachment = 0;
				attachmentReferences[0].layout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;
				attachmentReferences[1].attachment = 1;
				attachmentReferences[1].layout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;

				attachmentDescs[0].format = colorFormat;
				attachmentDescs[0].samples = imageCreateInfo.samples;
				attachmentDescs[0].loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
				attachmentDescs[0].storeOp = VK_ATTACHMENT_STORE_OP_STORE;
				attachmentDescs[0].stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
				attachmentDescs[0].stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
				attachmentDescs[0].initialLayout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;
				attachmentDescs[0].finalLayout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;
				attachmentDescs[0].flags = 0;

				attachmentDescs[1].format = depthFormat;
				attachmentDescs[1].samples = imageCreateInfo.samples;
				attachmentDescs[1].loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
				attachmentDescs[1].storeOp = VK_ATTACHMENT_STORE_OP_STORE;
				attachmentDescs[1].stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
				attachmentDescs[1].stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
				attachmentDescs[1].initialLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;
				attachmentDescs[1].finalLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;
				attachmentDescs[1].flags = 0;

				VkSubpassDescription subPassCreateInfo = { };
				subPassCreateInfo.pipelineBindPoint = VK_PIPELINE_BIND_POINT_GRAPHICS;
				subPassCreateInfo.flags = 0;
				subPassCreateInfo.inputAttachmentCount = 0;
				subPassCreateInfo.pInputAttachments = NULL;
				subPassCreateInfo.colorAttachmentCount = 1;
				subPassCreateInfo.pColorAttachments = &attachmentReferences[0];
				subPassCreateInfo.pResolveAttachments = NULL;
				subPassCreateInfo.pDepthStencilAttachment = &attachmentReferences[1];
				subPassCreateInfo.preserveAttachmentCount = 0;
				subPassCreateInfo.pPreserveAttachments = NULL;

				VkRenderPassCreateInfo renderPassCreateInfo = { };
				renderPassCreateInfo.sType = VK_STRUCTURE_TYPE_RENDER_PASS_CREATE_INFO;
				renderPassCreateInfo.flags = 0;
				renderPassCreateInfo.attachmentCount = 2;
				renderPassCreateInfo.pAttachments = &attachmentDescs[0];
				renderPassCreateInfo.subpassCount = 1;
				renderPassCreateInfo.pSubpasses = &subPassCreateInfo;
				renderPassCreateInfo.dependencyCount = 0;
				renderPassCreateInfo.pDependencies = NULL;

				VK_CHECK_RESULT( vkCreateRenderPass( vulkanDevice->logicalDevice, &renderPassCreateInfo, NULL, &renderPass ) );

			}

			//-----------------------------//
			// Create a frame buffer       //
			//-----------------------------//

			VkImageView attachments[4];
			if ( multiSample ) {
				attachments[0] = colorMultisample.view;
				attachments[1] = color.view;
				attachments[2] = depthStencilMultisample.view;
				attachments[3] = depthStencil.view;
			}
			else {
				attachments[0] = color.view;
				attachments[1] = depthStencil.view;
			}

			VkFramebufferCreateInfo framebufferCreateInfo = { VK_STRUCTURE_TYPE_FRAMEBUFFER_CREATE_INFO };
			framebufferCreateInfo.renderPass = renderPass;
			framebufferCreateInfo.attachmentCount = multiSample ? 4 : 2;
			framebufferCreateInfo.pAttachments = attachments;
			framebufferCreateInfo.width = width;
			framebufferCreateInfo.height = height;
			framebufferCreateInfo.layers = 1;
			VK_CHECK_RESULT( vkCreateFramebuffer( vulkanDevice->logicalDevice, &framebufferCreateInfo, NULL, &frameBuffer ) );

			colorLayout = VK_IMAGE_LAYOUT_UNDEFINED;
			depthStencilLayout = VK_IMAGE_LAYOUT_UNDEFINED;

			// set textures to be writable
			VkCommandBuffer layoutCmd = vulkanDevice->createCommandBuffer( VK_COMMAND_BUFFER_LEVEL_PRIMARY, true );
			VkImageMemoryBarrier imageMemoryBarrier{};
			imageMemoryBarrier.sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER;
			imageMemoryBarrier.image = color.image;
			imageMemoryBarrier.oldLayout = VK_IMAGE_LAYOUT_UNDEFINED;
			imageMemoryBarrier.newLayout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL;
			imageMemoryBarrier.srcAccessMask = 0;
			imageMemoryBarrier.dstAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
			imageMemoryBarrier.subresourceRange = { VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1 };
			vkCmdPipelineBarrier( layoutCmd, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, 0, 0, nullptr, 0, nullptr, 1, &imageMemoryBarrier );
			imageMemoryBarrier.newLayout = VK_IMAGE_LAYOUT_DEPTH_STENCIL_ATTACHMENT_OPTIMAL;
			imageMemoryBarrier.subresourceRange = { VK_IMAGE_ASPECT_DEPTH_BIT, 0, 1, 0, 1 };
			if ( formatHasStencil( depthFormat ) )
			{
				imageMemoryBarrier.subresourceRange.aspectMask |= VK_IMAGE_ASPECT_STENCIL_BIT;
			}
			imageMemoryBarrier.image = depthStencil.image;
			vkCmdPipelineBarrier( layoutCmd, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, 0, 0, nullptr, 0, nullptr, 1, &imageMemoryBarrier );
			vulkanDevice->flushCommandBuffer( layoutCmd, setupQueue, true );
			
		}

		void transitionColorLayout( VkCommandBuffer buffer, VkImageLayout newLayout )
		{
			VkImageMemoryBarrier imageMemoryBarrier{};
			imageMemoryBarrier.sType = VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER;
			imageMemoryBarrier.image = color.image;
			imageMemoryBarrier.oldLayout = colorLayout;
			imageMemoryBarrier.newLayout = newLayout;
			imageMemoryBarrier.srcAccessMask = 0;
			imageMemoryBarrier.dstAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
			imageMemoryBarrier.subresourceRange = { VK_IMAGE_ASPECT_COLOR_BIT, 0, 1, 0, 1 };
			vkCmdPipelineBarrier( buffer, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, VK_PIPELINE_STAGE_ALL_COMMANDS_BIT, 0, 0, nullptr, 0, nullptr, 1, &imageMemoryBarrier );
			colorLayout = newLayout;
		}

	};
}