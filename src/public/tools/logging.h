#pragma once

#include "../thirdparty/easyloggingpp-9.96.7/src/easylogging++.h"



namespace tools
{
	inline el::Logger *LogDefault() { return el::Loggers::getLogger( "default" ); }
	std::filesystem::path getDefaultLogPath();

	void initLogs();

}
