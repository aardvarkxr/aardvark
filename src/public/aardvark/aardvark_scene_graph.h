#pragma once

#include <stdint.h>
#include "aardvark.capnp.h"
#include "aardvark_client.h"

namespace aardvark
{
	enum class EAvSceneGraphResult
	{
		Success = 0,

		InvalidParameter = 1,
		IllegalProperty = 2,
		InvalidContext = 3,
		NodeMismatch = 4,
		IdInUse = 5,
		InvalidNodeType = 6,
		RequestFailed = 7,
	};

	enum class EAvSceneGraphNodeType
	{
		Container = 0,	// no properties. Only contains other nodes
		Origin = 1,		// Sets the origin path for its children
		Transform = 2,	// Sets the transform for its children
		Model = 3,		// Draws a model
		Panel = 4,		// Draws a quad in the world with some texture
	};

	struct AvSceneContextStruct;
	typedef AvSceneContextStruct *AvSceneContext;

	EAvSceneGraphResult avStartSceneContext( AvSceneContext *pContext );
	EAvSceneGraphResult avFinishSceneContext( AvSceneContext context, AvApp::Client *pApp, aardvark::CAardvarkClient *pClient );

	// Starts a node as a child of the current node
	EAvSceneGraphResult avStartNode( AvSceneContext context, uint32_t id, const char *pchName, EAvSceneGraphNodeType type );
	EAvSceneGraphResult avFinishNode( AvSceneContext context );

	// 
	// These property setters modify the current node and must be called between 
	// an avStartNode and avFinishNode pair.
	//

	// valid for Origin nodes.
	EAvSceneGraphResult avSetOriginPath( AvSceneContext context, const char *pchOriginPath );

	// valid for Transform nodes
	EAvSceneGraphResult avSetTranslation( AvSceneContext context, float x, float y, float z );
	EAvSceneGraphResult avSetScale( AvSceneContext context, float x, float y, float z );
	EAvSceneGraphResult avSetRotation( AvSceneContext context, float x, float y, float z, float w );

	// valid for Model nodes
	EAvSceneGraphResult avSetModelUri( AvSceneContext context, const char *pchModelUri );

	// valid for Panel nodes
	EAvSceneGraphResult avSetPanelTextureSource( AvSceneContext context, const char *pchSourceName );

	// tells the renderer what DXGI to use for a scene graph app
	EAvSceneGraphResult avUpdateDxgiTextureForApps( aardvark::CAardvarkClient *pClient, const char **pchAppName, uint32_t unNameCount, uint32_t unWidth, uint32_t unHeight, void *pvSharedTextureHandle );

}
