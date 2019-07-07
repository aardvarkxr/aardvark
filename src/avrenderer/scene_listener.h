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

class CSceneListener : public IApplication
{
	friend AvFrameListenerImpl;
public:
	CSceneListener( );

	void earlyInit( CefRefPtr<CAardvarkCefApp> app );

	void init( HINSTANCE hinstance );
	void cleanup();
	void run();


	// ------------------ IApplication implementation -------------------------
	virtual void quitRequested() override;

protected:
	CSceneTraverser m_traverser;

	kj::Own< AvFrameListenerImpl > m_frameListener;
	std::unique_ptr<IRenderer> m_renderer;
	CefRefPtr<CAardvarkCefApp> m_app;

	kj::Own<aardvark::CAardvarkClient> m_pClient;

	bool m_wantsQuit = false;
};

