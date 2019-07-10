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
	virtual ::kj::Promise<void> startGrab( StartGrabContext context ) override;
	virtual ::kj::Promise<void> endGrab( EndGrabContext context ) override;

	CJavascriptRenderer *m_renderer = nullptr;
};


class CJavascriptRenderer : public CJavascriptObjectWithFunctions
{
	friend AvFrameListenerImpl;
public:
	CJavascriptRenderer( CAardvarkRenderProcessHandler *pRenderProcessHandler );

	virtual bool init() override;
	void cleanup() override;

	bool hasPermission( const std::string & permission );
	void runFrame();

protected:
	CSceneTraverser m_traverser;

	kj::Own< AvFrameListenerImpl > m_frameListener;
	std::unique_ptr<IRenderer> m_renderer;
	std::unique_ptr<IVrManager> m_vrManager;


	CAardvarkRenderProcessHandler *m_handler = nullptr;
	bool m_quitting = false;
};
