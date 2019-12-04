#define TINYGLTF_IMPLEMENTATION
#define TINYGLTF_NO_STB_IMAGE_WRITE
#define STB_IMAGE_IMPLEMENTATION
#define STBI_MSC_SECURE_CRT
#include "tiny_gltf.h"

#include "av_cef_app.h"
#include "avserver.h"

#include <chrono>
#include <thread>

// OS specific macros for the example main entry points
int APIENTRY WinMain(HINSTANCE hInstance, HINSTANCE, LPSTR, int)
{
	// give the CEF subprocess the first crack
	  // Enable High-DPI support on Windows 7 or newer.
	CefEnableHighDPISupport();

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
	CefRefPtr<CAardvarkCefApp> app( new CAardvarkCefApp( ) );

	// CEF applications have multiple sub-processes (render, plugin, GPU, etc)
	// that share the same executable. This function checks the command-line and,
	// if this is a sub-process, executes the appropriate logic.
	int exit_code = CefExecuteProcess( mainArgs, app, sandbox_info );
	if ( exit_code >= 0 ) {
		// The sub-process has completed so return here.
		return exit_code;
	}

	if ( !StartServer( hInstance ) )
	{
		fprintf( stderr, "Failed to start the server\n" );
		return -57;
	}

	// Specify CEF global settings here.
	CefSettings settings;

#if !defined(CEF_USE_SANDBOX)
	settings.no_sandbox = true;
#endif

	settings.multi_threaded_message_loop = true;
	settings.windowless_rendering_enabled = true;

	// Initialize CEF.
	CefInitialize( mainArgs, settings, app.get(), sandbox_info );

	while ( !app->wantsToQuit() )
	{
		app->runFrame();
		std::this_thread::sleep_for( std::chrono::milliseconds( 100 ) );
	}

	// Shut down CEF.
	CefShutdown();

	StopServer();

	return 0;
}
