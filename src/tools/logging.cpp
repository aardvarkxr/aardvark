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
	void initLogs()
	{
		el::Configurations defaultConf;
		defaultConf.setToDefault();
		// Values are always std::string
		defaultConf.set( el::Level::Info,
			el::ConfigurationType::Format, "%datetime %level %msg" );
		// default logger uses default configurations

		std::filesystem::path logDirectory = GetLogDirectory();
		std::filesystem::create_directories( logDirectory );
		std::filesystem::path logFile = logDirectory / "aardvark.txt";

		defaultConf.set( el::Level::Global,
			el::ConfigurationType::Filename, logFile.generic_string() );
		el::Loggers::reconfigureLogger( "default", defaultConf );

		el::Helpers::installLogDispatchCallback< CDebugConsoleLogger>( "debugConsole" );
	}

}