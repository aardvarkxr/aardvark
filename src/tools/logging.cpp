#include <tools/logging.h>
#include <tools/pathtools.h>

INITIALIZE_EASYLOGGINGPP

class CDebugConsoleLogger : public el::LogDispatchCallback
{
public:
	virtual void handle( const el::LogDispatchData* data )
	{
		el::base::type::string_t msg = data->logMessage()->logger()->logBuilder()->build( data->logMessage(), true );
		OutputDebugStringA( msg.c_str() );
	}

};

//CDebugConsoleLogger g_debugConsoleLogger;

namespace tools
{
	std::filesystem::path g_logFile;

	std::filesystem::path getAardvarkBasePath()
	{
		return GetUserDocumentsPath() / "aardvark";
	}

	std::filesystem::path getDumpDir()
	{
		return getAardvarkBasePath() / "dumps";
	}

	std::filesystem::path getLogDir()
	{
		return getAardvarkBasePath() / "logs";
	}

	std::filesystem::path getLogFile()
	{
		return getLogDir() / "aardvark.txt";
	}

	void initLogs()
	{
		el::Configurations defaultConf;
		defaultConf.setToDefault();
		// Values are always std::string
		defaultConf.set( el::Level::Info,
			el::ConfigurationType::Format, "%datetime %level %msg" );
		// default logger uses default configurations

		std::filesystem::create_directories( getDumpDir() );
		std::filesystem::create_directories( getLogDir() );
		g_logFile = getLogDir() / "aardvark.txt";

		defaultConf.set( el::Level::Global,
			el::ConfigurationType::Filename, g_logFile.generic_string() );
		el::Loggers::reconfigureLogger( "default", defaultConf );

		el::Helpers::installLogDispatchCallback< CDebugConsoleLogger>( "debugConsole" );
	}


}