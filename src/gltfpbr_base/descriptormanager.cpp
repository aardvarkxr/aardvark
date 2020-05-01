#include "descriptormanager.h"
#include "macros.h"
#include "VulkanDevice.hpp"

#include <array>

using namespace vks;

// ==================
// CDescriptorManager
// ==================

CDescriptorManager::CDescriptorManager( VulkanDevice *vulkanDevice )
{
	m_vulkanDevice = vulkanDevice;
}

CDescriptorManager::~CDescriptorManager()
{
	if ( m_descriptorPool )
	{
		vkDestroyDescriptorPool( m_vulkanDevice->logicalDevice, m_descriptorPool, nullptr );
		vkDestroyDescriptorSetLayout( m_vulkanDevice->logicalDevice, m_layoutScene, nullptr );
		vkDestroyDescriptorSetLayout( m_vulkanDevice->logicalDevice, m_layoutMaterial, nullptr );
		vkDestroyDescriptorSetLayout( m_vulkanDevice->logicalDevice, m_layoutNode, nullptr );
	}
}

bool CDescriptorManager::init()
{
	static const uint32_t k_unUniformBufferDescriptorCount = 10000;
	static const uint32_t k_unImageSamplerDescriptorCount = 10000;
	static const uint32_t k_unMaxSets = 10000;

	std::array<VkDescriptorPoolSize, 2 > poolSizes = 
	{
		VkDescriptorPoolSize{ VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER, k_unUniformBufferDescriptorCount },
		VkDescriptorPoolSize{ VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER, k_unImageSamplerDescriptorCount }
	};

	VkDescriptorPoolCreateInfo descriptorPoolCI{};
	descriptorPoolCI.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_POOL_CREATE_INFO;
	descriptorPoolCI.poolSizeCount = 2;
	descriptorPoolCI.pPoolSizes = poolSizes.data();
	descriptorPoolCI.maxSets = k_unMaxSets;
	VK_CHECK_RESULT( vkCreateDescriptorPool( m_vulkanDevice->logicalDevice, &descriptorPoolCI, nullptr, &m_descriptorPool ) );

	{
		std::vector<VkDescriptorSetLayoutBinding> setLayoutBindings = {
		{ 0, VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER, 1, VK_SHADER_STAGE_VERTEX_BIT | VK_SHADER_STAGE_FRAGMENT_BIT, nullptr },
		{ 1, VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER, 1, VK_SHADER_STAGE_FRAGMENT_BIT, nullptr },
		{ 2, VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER, 1, VK_SHADER_STAGE_FRAGMENT_BIT, nullptr },
		{ 3, VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER, 1, VK_SHADER_STAGE_FRAGMENT_BIT, nullptr },
		{ 4, VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER, 1, VK_SHADER_STAGE_FRAGMENT_BIT, nullptr },
		};

		VkDescriptorSetLayoutCreateInfo descriptorSetLayoutCI{};
		descriptorSetLayoutCI.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_SET_LAYOUT_CREATE_INFO;
		descriptorSetLayoutCI.pBindings = setLayoutBindings.data();
		descriptorSetLayoutCI.bindingCount = static_cast<uint32_t>( setLayoutBindings.size() );
		VK_CHECK_RESULT( vkCreateDescriptorSetLayout( m_vulkanDevice->logicalDevice, &descriptorSetLayoutCI, nullptr, &m_layoutScene ) );
	}

	{
		std::vector<VkDescriptorSetLayoutBinding> setLayoutBindings = {
		{ 0, VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER, 1, VK_SHADER_STAGE_FRAGMENT_BIT, nullptr },
		{ 1, VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER, 1, VK_SHADER_STAGE_FRAGMENT_BIT, nullptr },
		{ 2, VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER, 1, VK_SHADER_STAGE_FRAGMENT_BIT, nullptr },
		{ 3, VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER, 1, VK_SHADER_STAGE_FRAGMENT_BIT, nullptr },
		{ 4, VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER, 1, VK_SHADER_STAGE_FRAGMENT_BIT, nullptr },
		};
		VkDescriptorSetLayoutCreateInfo descriptorSetLayoutCI{};
		descriptorSetLayoutCI.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_SET_LAYOUT_CREATE_INFO;
		descriptorSetLayoutCI.pBindings = setLayoutBindings.data();
		descriptorSetLayoutCI.bindingCount = static_cast<uint32_t>( setLayoutBindings.size() );
		VK_CHECK_RESULT( vkCreateDescriptorSetLayout( m_vulkanDevice->logicalDevice, &descriptorSetLayoutCI, nullptr, &m_layoutMaterial ) );
	}

	{
		std::vector<VkDescriptorSetLayoutBinding> setLayoutBindings = {
			{ 0, VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER, 1, VK_SHADER_STAGE_VERTEX_BIT, nullptr },
		};
		VkDescriptorSetLayoutCreateInfo descriptorSetLayoutCI{};
		descriptorSetLayoutCI.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_SET_LAYOUT_CREATE_INFO;
		descriptorSetLayoutCI.pBindings = setLayoutBindings.data();
		descriptorSetLayoutCI.bindingCount = static_cast<uint32_t>( setLayoutBindings.size() );
		VK_CHECK_RESULT( vkCreateDescriptorSetLayout( m_vulkanDevice->logicalDevice, &descriptorSetLayoutCI, nullptr, &m_layoutNode ) );
	}

	return true;
}


CDescriptorSet *CDescriptorManager::createUniformBufferDescriptorSet( VkBuffer buffer, uint32_t bufferSize )
{
	return createDescriptorSet( [buffer, bufferSize]( VulkanDevice *vulkanDevice, CDescriptorSet *desc )
	{
		VkDescriptorBufferInfo bufferInfo = { buffer, 0, bufferSize };

		VkWriteDescriptorSet writeDescriptorSet{};
		writeDescriptorSet.sType = VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;
		writeDescriptorSet.descriptorType = VK_DESCRIPTOR_TYPE_UNIFORM_BUFFER;
		writeDescriptorSet.descriptorCount = 1;
		writeDescriptorSet.dstSet = desc->set();
		writeDescriptorSet.dstBinding = 0;
		writeDescriptorSet.pBufferInfo = &bufferInfo;

		vkUpdateDescriptorSets( vulkanDevice->logicalDevice, 1, &writeDescriptorSet, 0, nullptr );
	}, EDescriptorLayout::Node );
}

CDescriptorSet *CDescriptorManager::createDescriptorSet( FnUpdateDescriptor fnUpdate, EDescriptorLayout eLayout )
{
	auto freeList = getFreeList( eLayout );
	if ( !freeList )
		return nullptr;

	if ( !freeList->empty() )
	{
		std::unique_ptr< CDescriptorSet > desc = std::move( freeList->front() );
		freeList->pop_front();

		CDescriptorSet *pRetVal = desc.get();
		m_generalDescriptors.push_back( std::move( desc ) );
		pRetVal->m_fnUpdate = fnUpdate;
		fnUpdate( m_vulkanDevice, pRetVal );
		return pRetVal;
	}
	else
	{
		auto desc = std::make_unique<CDescriptorSet>( eLayout, getLayout( eLayout ), fnUpdate );
		desc->createDescriptor( m_vulkanDevice, m_descriptorPool );
		CDescriptorSet *pRetVal = desc.get();
		m_generalDescriptors.push_back( std::move( desc ) );
		return pRetVal;
	}
}


std::list<std::unique_ptr< CDescriptorSet>> * CDescriptorManager::getFreeList( EDescriptorLayout layoutType )
{
	switch ( layoutType )
	{
	case EDescriptorLayout::Node:
		return &m_nodeFreeList;
		break;

	case EDescriptorLayout::Material:
		return &m_materialFreeList;
		break;

	case EDescriptorLayout::Scene:
		return &m_sceneFreeList;
		break;

	default:
		assert( false );
		return nullptr;
	}
}


void CDescriptorManager::freeUniformBufferDescriptorSet( CDescriptorSet *descriptorSet )
{
	std::list<std::unique_ptr<CDescriptorSet>> * freeList = getFreeList( descriptorSet->m_layoutType );

	std::unique_ptr< CDescriptorSet > ptr;
	auto i = std::find_if( m_generalDescriptors.begin(), m_generalDescriptors.end(), 
		[descriptorSet]( std::unique_ptr< CDescriptorSet > & item )
		{
			return item.get() == descriptorSet;
		} );
	if ( i != m_generalDescriptors.end() )
	{
		freeList->push_back( std::move( *i ) );
		m_generalDescriptors.erase( i );
	}
}


VkDescriptorSetLayout CDescriptorManager::getLayout( EDescriptorLayout eLayout )
{
	switch ( eLayout )
	{
	case EDescriptorLayout::Node: return m_layoutNode;
	case EDescriptorLayout::Material: return m_layoutMaterial;
	case EDescriptorLayout::Scene: return m_layoutScene;
	default:
		assert( false );
		return nullptr;
	}
}


void CDescriptorManager::updateDescriptors()
{
	vkResetDescriptorPool( m_vulkanDevice->logicalDevice, m_descriptorPool, 0 );
	for ( auto & i : m_generalDescriptors )
	{
		i->createDescriptor( m_vulkanDevice, m_descriptorPool );
	}
}


// ========================
// CDescriptorSet
// ========================

CDescriptorSet::CDescriptorSet( EDescriptorLayout layoutType, VkDescriptorSetLayout layout, FnUpdateDescriptor fnUpdate)
{
	m_fnUpdate = fnUpdate;
	m_layout = layout;
	m_layoutType = layoutType;
}


void CDescriptorSet::createDescriptor( VulkanDevice *vulkanDevice, VkDescriptorPool pool )
{
	VkDescriptorSetAllocateInfo descriptorSetAllocInfo{};
	descriptorSetAllocInfo.sType = VK_STRUCTURE_TYPE_DESCRIPTOR_SET_ALLOCATE_INFO;
	descriptorSetAllocInfo.descriptorPool = pool;
	descriptorSetAllocInfo.pSetLayouts = &m_layout;
	descriptorSetAllocInfo.descriptorSetCount = 1;
	VK_CHECK_RESULT( vkAllocateDescriptorSets( vulkanDevice->logicalDevice, &descriptorSetAllocInfo, &m_descriptorSet ) );

	m_fnUpdate( vulkanDevice, this );
}

