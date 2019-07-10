#pragma once
#include <tools/capnprototools.h>

#include <aardvark/aardvark_server.h>
#include <aardvark/aardvark_client.h>
#include <aardvark/aardvark_scene_graph.h>

#include "av_cef_app.h"

#include "scene_traverser.h"
#include "iapplication.h"

class CSceneListener;
class VulkanExample;
class IVRManager;
struct SgRoot_t;

class AvFrameListenerImpl : public AvFrameListener::Server
{
public:
	virtual ::kj::Promise<void> newFrame( NewFrameContext context ) override;
	virtual ::kj::Promise<void> sendHapticEvent( SendHapticEventContext context ) override;
	virtual ::kj::Promise<void> startGrab( StartGrabContext context ) override;
	virtual ::kj::Promise<void> endGrab( EndGrabContext context ) override;

	CSceneListener *m_listener = nullptr;
};

class CSceneListener 
{
	friend AvFrameListenerImpl;
public:
	CSceneListener( );

	void init( HINSTANCE hinstance, aardvark::CAardvarkClient *client );
	void cleanup();
	void run();
	void runFrame();
	bool wantsQuit() { return m_wantsQuit; }

protected:
	CSceneTraverser m_traverser;

	kj::Own< AvFrameListenerImpl > m_frameListener;
	std::unique_ptr<IRenderer> m_renderer;
	std::unique_ptr<IVrManager> m_vrManager;

	aardvark::CAardvarkClient *m_pClient;

	bool m_wantsQuit = false;
};

