#pragma once
#include <tools/capnprototools.h>

#include <aardvark/aardvark_server.h>
#include <aardvark/aardvark_client.h>
#include <aardvark/aardvark_scene_graph.h>

#include "av_cef_app.h"

class CSceneListener;
class VulkanExample;

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

	void earlyInit( CefRefPtr<CAardvarkCefApp> app );

	void init( HINSTANCE hinstance, WNDPROC wndproc );
	void cleanup();
	void run();

protected:

	kj::Own< AvFrameListenerImpl > m_frameListener;
	std::unique_ptr<VulkanExample> m_renderer;
	CefRefPtr<CAardvarkCefApp> m_app;

	kj::Own<aardvark::CAardvarkClient> m_pClient;
};

