#pragma once

#include "include/cef_app.h"

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
};

