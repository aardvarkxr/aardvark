#pragma once

class IApplication
{
public:
	virtual void quitRequested() = 0;
	virtual void browserClosed( CAardvarkCefHandler *handler ) = 0;
	virtual bool createTextureForBrowser( void **sharedHandle,
		int width, int height ) = 0;
	virtual void updateTexture( void *sharedHandle, const void *buffer, int width, int height ) = 0;

};

