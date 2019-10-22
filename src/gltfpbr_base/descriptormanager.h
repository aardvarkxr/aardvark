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
	};

	class CDescriptorManager
	{
	public:
		CDescriptorManager( VulkanDevice *vulkanDevice );
		~CDescriptorManager();

		bool init();

		CDescriptorSet *createUniformBufferDescriptorSet( VkBuffer buffer, uint32_t bufferSize );
		CDescriptorSet *createDescriptorSet( FnUpdateDescriptor fnUpdate, EDescriptorLayout eLayout );
		void freeUniformBufferDescriptorSet( CDescriptorSet *descriptorSet );

		VkDescriptorSetLayout getLayout( EDescriptorLayout eLayout );

		void updateDescriptors();

	private:

		std::list<std::unique_ptr< CDescriptorSet>> * getFreeList( EDescriptorLayout layoutType );

		VkDescriptorPool m_descriptorPool = nullptr;
		VulkanDevice *m_vulkanDevice = nullptr;
		VkDescriptorSetLayout m_layoutScene;
		VkDescriptorSetLayout m_layoutMaterial;
		VkDescriptorSetLayout m_layoutNode;

		std::list<std::unique_ptr<CDescriptorSet>> m_sceneFreeList;
		std::list<std::unique_ptr<CDescriptorSet>> m_materialFreeList;
		std::list<std::unique_ptr<CDescriptorSet>> m_nodeFreeList;

		std::list<std::unique_ptr<CDescriptorSet>> m_uniformBuffers;
		std::list<std::unique_ptr<CDescriptorSet>> m_generalDescriptors;
	};

	class CDescriptorSet
	{
		friend class CDescriptorManager;
	public:

		VkDescriptorSet set() const { return m_descriptorSet; }

	public:
		CDescriptorSet( EDescriptorLayout layoutType, VkDescriptorSetLayout layout, FnUpdateDescriptor fnUpdate );

		void createDescriptor( VulkanDevice *vulkanDevice, VkDescriptorPool pool );

	protected:
		EDescriptorLayout m_layoutType;
		VkDescriptorSetLayout m_layout;
		FnUpdateDescriptor m_fnUpdate;
		VkDescriptorSet m_descriptorSet;
	};
}
