#include <process.hpp>
#include <tools/pathtools.h>
#include <tools/stringtools.h>

#include <windows.h>
#include <shellapi.h>

static TinyProcessLib::Process *g_pServerProcess = nullptr;

std::filesystem::path getNodeExePath()
{
	return tools::GetDataPath() / "server" / "bin" / "Node.exe";
}

std::filesystem::path getServerJsPath()
{
	return tools::GetDataPath() / "server" / "server_bundle.js";
}

std::filesystem::path getAvCmdJsPath()
{
	return tools::GetDataPath() / "avcmd" / "avcmd.js";
}

bool StartServer( HINSTANCE hInstance )
{
	// TODO( Joe ): Move getting command line args into a library
	LPWSTR cmdLine = GetCommandLineW();
	int numArgs;
	LPWSTR *rawArgs = CommandLineToArgvW( cmdLine, &numArgs );

	std::vector< std::string > args;
	for ( int i = 0; i < numArgs; i++ )
	{
		args.push_back( tools::WStringToUtf8( std::wstring( rawArgs[i] ) ) );
	}

	bool bShowConsole = false;
	bool bRunServer = true;
	for ( auto & i : args )
	{
		if ( i == "--noserver" )
		{
			bRunServer = false;
		}
		else if ( i == "--showconsole" )
		{
			bShowConsole = true;
		}
	}

	if ( !bRunServer )
		return true; // not an error to obey the command line

	// start the server
	std::vector<std::string> vecServerArgs = { getNodeExePath().u8string(), getServerJsPath().u8string() };

	std::function< void( const char *, size_t )> fnToUse;
	if ( !bShowConsole )
	{
		fnToUse = []( const char *bytes, size_t n ) {};
	}

	g_pServerProcess = new TinyProcessLib::Process( vecServerArgs, "", fnToUse, fnToUse );

	int exitCode = 0;
	if ( g_pServerProcess->try_get_exit_status( exitCode ) )
	{
		// the process exited, which means we failed to start it
		delete g_pServerProcess;
		return false;
	}
	else
	{
		return true;
	}
}

void StopServer()
{
	// "shut down" the server
	if ( g_pServerProcess )
	{
		g_pServerProcess->kill();
		delete g_pServerProcess;
		g_pServerProcess = nullptr;
	}
}

