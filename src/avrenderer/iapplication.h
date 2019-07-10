#pragma once

class IApplication
{
public:
	virtual void quitRequested() = 0;
	virtual void browserClosed( CAardvarkCefHandler *handler ) = 0;
};

