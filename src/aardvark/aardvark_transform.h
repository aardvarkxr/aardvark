#pragma once

#include "irenderer.h"

#include <memory>
#include <unordered_map>

class CTransform;

class CVulkanTransformManager
{
public:
	CVulkanTransformManager( IVrManager *vrManager );
	~CVulkanTransformManager();

	ITransform *getTransform( uint64_t transformId );

	void resolveAndAnimate( float elapsedTime );

private:
	std::unordered_map< uint64_t, std::unique_ptr< CTransform > > m_transforms;
};