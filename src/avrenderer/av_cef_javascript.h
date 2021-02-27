#pragma once

#include <include/cef_render_process_handler.h>

#include <functional>
#include <memory>
#include <set>

#include <aardvark/aardvark_gadget_manifest.h>
#include <aardvark/aardvark_scene_graph.h>
#include <aardvark/input_types.h>

#include "uri_request_handler.h"
#include "javascript_object.h"
#include <openvr.h>

class CAardvarkObject;

class CAardvarkRenderProcessHandler : public CefRenderProcessHandler
{
public:
	CAardvarkRenderProcessHandler();

	virtual void OnContextCreated(
		CefRefPtr<CefBrowser> browser,
		CefRefPtr<CefFrame> frame,
		CefRefPtr<CefV8Context> context ) override;
	virtual void OnContextReleased( CefRefPtr<CefBrowser> browser,
		CefRefPtr<CefFrame> frame,
		CefRefPtr<CefV8Context> context ) override;
	virtual bool OnProcessMessageReceived( CefRefPtr<CefBrowser> browser,
		CefRefPtr<CefFrame> frame,
		CefProcessId source_process,
		CefRefPtr<CefProcessMessage> message ) override;

	virtual void OnBrowserDestroyed( CefRefPtr<CefBrowser> browser ) override;


	void sendBrowserMessage( CefRefPtr< CefProcessMessage > msg );

	bool hasPermission( const std::string & permission );
	void requestStartGadget( const aardvark::GadgetParams_t & params );
	void requestUri( const std::string & uri, std::function<void( CUriRequestHandler::Result_t & result ) > callback );
	void requestTextureInfo();
	void requestClose();
	const aardvark::AardvarkConfig_t & getConfig() const { return m_config; }

	void registerInput( CefRefPtr<CefV8Value> manifestJS, CefString *exception );
	void registerSceneApplicationNotification( CefRefPtr<CefV8Value> fn, CefRefPtr<CefV8Context> context );

	vr::EVRInitError InitOpenVR();

	vr::EVRInitError PrepareForVRInit();

	void ParseInputManifest( CefRefPtr<CefV8Value> manifestJS, CefString* exception );

	void syncInput( CefRefPtr<CefV8Value> infoJS, CefRefPtr<CefV8Value>* retVal, CefString* exception );

	void runFrame();

	bool updateSceneAppInfo();
	uint32_t getCurrentSceneAppPid() { return m_currentSceneAppPid; }
	std::string getCurrentSceneAppId() { return m_currentSceneAppId; }
	std::string getCurrentSceneAppName() { return m_currentSceneAppName; }
private:
	void pollVrEvents();

	struct PerContextInfo_t
	{
		CefRefPtr<CefBrowser> browser;
		CefRefPtr<CefFrame> frame;
		CefRefPtr<CefV8Context> context;
		JsObjectPtr< CAardvarkObject > aardvarkObject;
	};
	std::vector< PerContextInfo_t > m_contexts;
	void InitAardvarkForContext( PerContextInfo_t &contextInfo );

	aardvark::GadgetParams_t m_params;
	std::unique_ptr<CWebAppManifest> m_gadgetManifest;
	aardvark::AardvarkConfig_t m_config;
	CUriRequestHandler m_uriRequestHandler;
	bool m_needRunFrame = true;

	struct AppChangeCallback_t
	{
		CefRefPtr<CefV8Value> fn;
		CefRefPtr<CefV8Context> context;
	};
	std::vector<AppChangeCallback_t> m_appChangeCallbacks;
	std::string m_currentSceneAppId;
	std::string m_currentSceneAppName;
	uint32_t m_currentSceneAppPid = 0;

	std::unique_ptr<CInputManifest> m_inputManifest;
	std::string m_gadgetId;
	bool m_preparedForVRInit = false;
	bool m_vrInitialized = false;

	// Include the default reference counting implementation.
	IMPLEMENT_REFCOUNTING( CAardvarkRenderProcessHandler );
};
