#define TINYGLTF_IMPLEMENTATION
#define TINYGLTF_NO_STB_IMAGE_WRITE
#define STB_IMAGE_IMPLEMENTATION
#define STBI_MSC_SECURE_CRT
#include "tiny_gltf.h"

#include <tools/logging.h>

#include "av_cef_app.h"
#include "avserver.h"

#include <chrono>
#include <thread>
#include <tools/systools.h>
#include <tools/pathtools.h>
#include <tools/stringtools.h>
#include <sentry.h>
#include <openvr.h>

// OS specific macros for the example main entry points
int APIENTRY WinMain( HINSTANCE hInstance, HINSTANCE, LPSTR cmdLine, int )
{
	tools::initLogs();

	// make sure cwd is right
	std::filesystem::path cwd = std::filesystem::current_path();
	if ( !std::filesystem::exists( cwd / "data" ) )
	{
		// if there's no data directory here, we need to figure out directory
		// to run in from the exe
		cwd = tools::GetExecutablePath().remove_filename();
		while ( !std::filesystem::exists( cwd / "data" ) && cwd.has_parent_path() )
		{
			cwd = cwd.parent_path();
		}

		if ( !std::filesystem::exists( cwd / "data" ) )
		{
			tools::LogDefault()->info( "failed to find data directory from exe path %s. Continuing, but this will probably fail",
				tools::GetExecutablePath().c_str() );
		}
		else
		{
			tools::LogDefault()->info( "Changing to data directory %s.", cwd.c_str() );
			std::filesystem::current_path( cwd );
		}
	}

	std::vector< std::string > vecArgs = tools::tokenizeString( cmdLine );
	if ( vecArgs.size() == 2 && vecArgs[ 0 ] == "handleurl" )
	{
		tools::LogDefault()->info( "started from URL %s", vecArgs[ 1 ].c_str() );
	}

	if ( !vecArgs.empty() )
	{
		std::filesystem::path appManifestPath = cwd / "data" / "aardvark.vrmanifest";
		if ( vecArgs[ 0 ] == "register" || vecArgs[0] == "unregister" )
		{
			// register the app manifest in data/aardvark.vrmanifest with SteamVR
			vr::EVRInitError err;
			vr::VR_Init( &err, vr::VRApplication_Utility, nullptr );
			if ( err != vr::VRInitError_None )
			{
				tools::LogDefault()->error( "VR_Init failed when trying to [un]register app manifest: %s\n", vr::VR_GetVRInitErrorAsSymbol( err ) );
				return -1;
			}

			if ( vecArgs[ 0 ] == "register" )
			{
				vr::EVRApplicationError appError = vr::VRApplications()->AddApplicationManifest( appManifestPath.u8string().c_str() );
				if ( appError != vr::VRApplicationError_None )
				{
					tools::LogDefault()->error( "Failed to register app manifest %s with %s\n", appManifestPath.c_str(), vr::VRApplications()->GetApplicationsErrorNameFromEnum( appError ) );
					return -1;
				}
			}
			else
			{
				vr::EVRApplicationError appError = vr::VRApplications()->RemoveApplicationManifest( appManifestPath.u8string().c_str() );
				if ( appError != vr::VRApplicationError_None )
				{
					tools::LogDefault()->error( "Failed to unregister app manifest %s with %s\n", appManifestPath.c_str(), vr::VRApplications()->GetApplicationsErrorNameFromEnum( appError ) );
					return -1;
				}
			}

			vr::VR_Shutdown();
			return 0;
		}
	}
	aardvark::AardvarkConfig_t aardvarkConfig;

	for ( auto& arg : vecArgs )
	{
		if ( arg == "-showWindow" )
		{
			aardvarkConfig.showWindow = true;
		}
	}

	// give the CEF subprocess the first crack
	  // Enable High-DPI support on Windows 7 or newer.
	CefEnableHighDPISupport();

	sentry_options_t* sentryOptions = sentry_options_new();
	sentry_options_add_attachmentw( sentryOptions, tools::getDefaultLogPath().generic_wstring().c_str() );
	sentry_options_set_dsn( sentryOptions, "https://62a3c9d1c98341d0bd0757904a2e11aa@o433321.ingest.sentry.io/5388214" );

	std::string sRelease = "aardvarkxr@" AARDVARK_VERSION;
	sentry_options_set_release( sentryOptions, sRelease.c_str() );

	sentry_init( sentryOptions );

	void* sandbox_info = NULL;

#if defined(CEF_USE_SANDBOX)
	// Manage the life span of the sandbox information object. This is necessary
	// for sandbox support on Windows. See cef_sandbox_win.h for complete details.
	CefScopedSandboxInfo scoped_sandbox;
	sandbox_info = scoped_sandbox.sandbox_info();
#endif

	// Provide CEF with command-line arguments.
	CefMainArgs mainArgs( hInstance );

	// CAardvarkCefApp implements application-level callbacks for the browser process.
	// It will create the first browser instance in OnContextInitialized() after
	// CEF has initialized.
	CefRefPtr<CAardvarkCefApp> app( new CAardvarkCefApp( aardvarkConfig ) );

	// CEF applications have multiple sub-processes (render, plugin, GPU, etc)
	// that share the same executable. This function checks the command-line and,
	// if this is a sub-process, executes the appropriate logic.
	int exit_code = CefExecuteProcess( mainArgs, app, sandbox_info );
	if ( exit_code >= 0 ) {
		sentry_shutdown();

		// The sub-process has completed so return here.
		return exit_code;
	}

	// ---------------------------------------------------------
	// Everything below here only happens in the browser process
	// ---------------------------------------------------------
	tools::singletonProcess( "avrenderer" );

	tools::LogDefault()->info( "Starting browser process" );

	std::string urlHandlerCommand = "\"" + tools::WStringToUtf8( tools::GetExecutablePath() ) + "\" "
		+  " handleurl \"%1\"";
	tools::registerURLSchemeHandler( "aardvark", urlHandlerCommand );

	if ( !StartServer( hInstance ) )
	{
		LOG( FATAL ) << "Failed to start the server";

		sentry_shutdown();

		return -57;
	}

	// Specify CEF global settings here.
	CefSettings settings;

#if !defined(CEF_USE_SANDBOX)
	settings.no_sandbox = true;
#endif

	//settings.multi_threaded_message_loop = true;
	settings.windowless_rendering_enabled = true;

	std::wstring cachePath = tools::GetCacheDirectory().wstring();
	cef_string_wide_to_utf16( cachePath.c_str(), cachePath.size(), &settings.cache_path );

	// Initialize CEF.
	CefInitialize( mainArgs, settings, app.get(), sandbox_info );

	while ( !app->wantsToQuit() )
	{
		CefDoMessageLoopWork();
		app->runFrame();
		std::this_thread::sleep_for( std::chrono::milliseconds( 100 ) );
	}

	// Shut down CEF.
	CefShutdown();

	StopServer();

	sentry_shutdown();

	return 0;
}
