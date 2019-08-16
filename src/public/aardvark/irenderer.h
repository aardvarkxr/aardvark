#pragma once

#include <memory>

#include "aardvark.capnp.h"

#define GLM_FORCE_RADIANS
#define GLM_FORCE_DEPTH_ZERO_TO_ONE
#include <glm/glm.hpp>
#include <glm/gtc/quaternion.hpp>

#include <string>

namespace aardvark
{
	class CAardvarkClient;
}

enum class ETextureType
{
	Invalid = 0,
	D3D11Texture2D = 1,
};

enum class ETextureFormat
{
	R8G8B8A8 = 1,
	B8G8R8A8 = 2,
};


class IVrManager;

class ITransform
{
public:
	virtual ~ITransform() {}


	virtual void setNullTransform( uint64_t parentId) = 0;
	virtual void setOriginTransform( const std::string & originPath ) = 0;

	virtual void setParentFromThisMatrix( const glm::mat4 & parentFromTransform ) = 0;
	virtual void setParentFromThisTRS( const glm::vec3 & translation, const glm::vec3 & scale, const glm::quat & rot ) = 0;

	virtual void setTransitionTime( float time ) = 0;
};


class IModelInstance
{
public:
	virtual ~IModelInstance() {}

	virtual void setUniverseFromModel( const glm::mat4 & universeFromModel ) = 0;
	virtual void setOverrideTexture( void *textureHandle, ETextureType type, ETextureFormat format,
		uint32_t width, uint32_t height ) = 0;
};


#ifndef _WINDEF_
class HINSTANCE__; // Forward or never
typedef HINSTANCE__* HINSTANCE;
#endif

class IRenderer
{
public:
	virtual ~IRenderer() {}

	virtual void init( HINSTANCE hInstance, IVrManager *vrManager, aardvark::CAardvarkClient *client ) = 0;
	virtual void runFrame( bool *shouldQuit, double frameTime ) = 0;

	virtual std::unique_ptr<IModelInstance> createModelInstance( const std::string & uri ) = 0;
	virtual void resetRenderList() = 0;
	virtual void addToRenderList( IModelInstance *modelInstance ) = 0;
	virtual void processRenderList() = 0;
};

