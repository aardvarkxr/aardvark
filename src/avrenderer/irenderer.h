#pragma once

#include <memory>

#include "aardvark.capnp.h"

#define GLM_FORCE_RADIANS
#define GLM_FORCE_DEPTH_ZERO_TO_ONE
#include <glm/glm.hpp>

namespace aardvark
{
	class CAardvarkClient;
}

class IVrManager;

class IModelInstance
{
public:
	virtual ~IModelInstance() {}

	virtual void setUniverseFromModel( const glm::mat4 & universeFromModel ) = 0;
	virtual void setOverrideTexture( AvSharedTextureInfo::Reader ) = 0;
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

