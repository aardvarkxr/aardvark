#pragma once

#include "javascript_object.h"
#include "scene_listener.h"

class CAardvarkRenderProcessHandler;

class CJavascriptRenderer : public CJavascriptObjectWithFunctions
{
public:
	CJavascriptRenderer( CAardvarkRenderProcessHandler *pRenderProcessHandler );

	virtual bool init() override;
	void cleanup() override;

	bool hasPermission( const std::string & permission );
	void runFrame();

private:
	CAardvarkRenderProcessHandler *m_handler = nullptr;
	std::unique_ptr<CSceneListener> m_listener;
	bool m_quitting = false;
};
