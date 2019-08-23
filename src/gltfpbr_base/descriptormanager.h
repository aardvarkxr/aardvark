#pragma once

#include <functional>

#include "vulkan/vulkan.h"


namespace vks
{
	struct VulkanDevice;

	class CDescriptorSet;

	typedef std::function< void( VulkanDevice *vulkanDevice, CDescriptorSet * ) > FnUpdateDescriptor;

	enum class EDescriptorLayout
	{
		Scene,
		Material,
		Node,
		Varggles,
	};

	class CDescriptorManager
	{
	public:
		CDescriptorManager( VulkanDevice *vulkanDevice );
		~CDescriptorManager();

		bool init();

		CDescriptorSet *createUniformBufferDescriptorSet( VkBuffer buffer, uint32_t bufferSize );
		CDescriptorSet *createDescriptorSet( FnUpdateDescriptor fnUpdate, EDescriptorLayout eLayout );

		VkDescriptorSetLayout getLayout( EDescriptorLayout eLayout );

		void updateDescriptors();

	private:

		VkDescriptorPool m_descriptorPool = nullptr;
		VulkanDevice *m_vulkanDevice = nullptr;
		VkDescriptorSetLayout m_layoutScene;
		VkDescriptorSetLayout m_layoutMaterial;
		VkDescriptorSetLayout m_layoutNode;
		VkDescriptorSetLayout m_layoutVarggles;

		std::list<std::unique_ptr<CDescriptorSet>> m_uniformBuffers;
		std::list<std::unique_ptr<CDescriptorSet>> m_generalDescriptors;
	};

	class CDescriptorSet
	{
		friend class CDescriptorManager;
	public:

		VkDescriptorSet set() const { return m_descriptorSet; }

	public:
		CDescriptorSet( VkDescriptorSetLayout layout, FnUpdateDescriptor fnUpdate );

		void createDescriptor( VulkanDevice *vulkanDevice, VkDescriptorPool pool );

	protected:
		VkDescriptorSetLayout m_layout;
		FnUpdateDescriptor m_fnUpdate;
		VkDescriptorSet m_descriptorSet;
	};
}
