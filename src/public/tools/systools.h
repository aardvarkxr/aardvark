#pragma once

#include <filesystem>
#include <string>

namespace tools
{
	/** Registers a URL handler with the system */
	bool registerURLSchemeHandler( const std::string & urlScheme, const std::string & commandToRun );

	/** Invokes a URL via the system, causing the default handler for that url
	* to be invoked. */
	void invokeURL( const std::string& url );

	/** exit this process if there's already an instance of the same exe */
	void singletonProcess( const char* processKey );

	/** Kills a process by name */
	bool killProcessByName( const std::string& exeName );
}