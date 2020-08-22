#pragma once

#include "include/cef_app.h"
#include <aardvark/aardvark_scene_graph.h>

class IApplication
{
public:
	virtual void quitRequested() = 0;
	virtual void browserClosed( CAardvarkCefHandler *handler ) = 0;
	virtual bool createTextureForBrowser( void **sharedHandle,
		int width, int height ) = 0;
	virtual void updateTexture( void *sharedHandle, const void *buffer, int width, int height ) = 0;

	virtual CefRefPtr<CefListValue> subscribeToWindowList( CAardvarkCefHandler* handler ) = 0;
	virtual void unsubscribeFromWindowList( CAardvarkCefHandler* handler ) = 0;
	virtual void subscribeToWindow( CAardvarkCefHandler* handler, const std::string & windowHandle ) = 0;
	virtual void unsubscribeFromWindow( CAardvarkCefHandler* handler, const std::string& windowHandle ) = 0;

	virtual const aardvark::AardvarkConfig_t& getConfig() const = 0;
};

