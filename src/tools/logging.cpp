#include <tools/logging.h>
#include <tools/pathtools.h>

INITIALIZE_EASYLOGGINGPP

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

		std::filesystem::path logDirectory = GetUserDocumentsPath();
		logDirectory /= std::filesystem::path( "aardvark" ) / "logs";
		std::filesystem::create_directories( logDirectory );
		std::filesystem::path logFile = logDirectory / "aardvark.txt";

		defaultConf.set( el::Level::Global,
			el::ConfigurationType::Filename, logFile.generic_string() );
		el::Loggers::reconfigureLogger( "default", defaultConf );
	}

}