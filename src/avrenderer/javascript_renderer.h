#pragma once

#include "javascript_object.h"
#include "scene_traverser.h"

class CAardvarkRenderProcessHandler;
class CJavascriptRenderer;

class AvFrameListenerImpl : public AvFrameListener::Server
{
public:
	virtual ::kj::Promise<void> newFrame( NewFrameContext context ) override;
	virtual ::kj::Promise<void> sendHapticEvent( SendHapticEventContext context ) override;
	virtual ::kj::Promise<void> grabEvent( GrabEventContext context ) override;

	CJavascriptRenderer *m_renderer = nullptr;
	CefRefPtr< CefV8Context > m_context;
};


class CJavascriptModelInstance : public CJavascriptObjectWithFunctions
{
	friend class CJavascriptRenderer;
public:
	CJavascriptModelInstance( std::unique_ptr<IModelInstance> modelInstance,
		std::unordered_map< uint32_t, tools::OwnCapnp< AvSharedTextureInfo > > &textureInfo );
	virtual bool init( CefRefPtr<CefV8Value > container ) override;

	IModelInstance *getModelInstance() { return m_modelInstance.get(); }

protected:

	std::unique_ptr<IModelInstance> m_modelInstance;
	std::unordered_map< uint32_t, tools::OwnCapnp< AvSharedTextureInfo > > & m_textureInfo;
};

class CJavascriptRenderer : public CJavascriptObjectWithFunctions
{
	friend AvFrameListenerImpl;
public:
	CJavascriptRenderer( CAardvarkRenderProcessHandler *pRenderProcessHandler );
	virtual ~CJavascriptRenderer() noexcept;

	virtual bool init( CefRefPtr<CefV8Value> container ) override;

	bool hasPermission( const std::string & permission );
	void runFrame();

	CefRefPtr<CefV8Value> frameToJsObject( AvVisualFrame::Reader & frame );
	CefRefPtr<CefV8Value> nodeRootToJsObject( AvNodeRoot::Reader & nodeRoot );
	CefRefPtr<CefV8Value> nodeToJsObject( AvNodeRoot::Reader & nodeRoot, 
		const std::unordered_map<uint32_t, uint32_t> & nodeIdToNodeIndex, uint32_t nodeIndex );

protected:
	CSceneTraverser m_traverser;

	kj::Own< AvFrameListenerImpl > m_frameListener;
	std::unique_ptr<IRenderer> m_renderer;
	std::unique_ptr<IVrManager> m_vrManager;
	std::unordered_map<uint32_t, tools::OwnCapnp< AvSharedTextureInfo > > m_textureInfo;

	CefRefPtr< CefV8Value > m_jsSceneProcessor;
	CefRefPtr< CefV8Value > m_jsTraverser;
	CefRefPtr< CefV8Value > m_jsHapticProcessor;
	CefRefPtr< CefV8Value > m_jsGrabEventProcessor;
	CIntersectionTester m_intersections;
	CCollisionTester m_collisions;

	CAardvarkRenderProcessHandler *m_handler = nullptr;
	bool m_quitting = false;
};
