#include "tools/systools.h"

#include <windows.h>
#include <synchapi.h>
#include <windows.h>
#include <process.h>
#include <Tlhelp32.h>
#include <winbase.h>

#include <tools/logging.h>
#include <tools/stringtools.h>

namespace tools
{
	static std::string formatWindowsError( LONG error )
	{
		LPWSTR buffer = nullptr;
		FormatMessageW( FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM, nullptr, error, 0, (LPWSTR)&buffer, 0, nullptr );
		std::string result = WStringToUtf8( buffer );
		LocalFree( buffer );
		return result;
	}

	bool registerURLSchemeHandler( const std::string & urlScheme, const std::string & commandToRun)
	{
		std::string classPath = "Software\\Classes\\" + urlScheme;
		HKEY hSchemeKey;
		LONG error = RegCreateKeyExA( HKEY_CURRENT_USER, classPath.c_str(), 0, NULL, REG_OPTION_NON_VOLATILE, KEY_WRITE, NULL, &hSchemeKey, NULL );
		if( error != ERROR_SUCCESS )
		{
			LOG( ERROR ) << "Failed to register URI scheme " << urlScheme << ": " << formatWindowsError( error );
			return false;
		}

		std::string baseValue = "URL:" + urlScheme + " Protocol";
		if ( ERROR_SUCCESS != RegSetKeyValueA( hSchemeKey, nullptr, nullptr, REG_SZ, baseValue.c_str(), (DWORD)( baseValue.size() + 1 ) ) )
		{
			LOG( ERROR ) << "Failed to set base value for URI scheme " << urlScheme;
			return false;
		}
		if ( ERROR_SUCCESS != RegSetKeyValueA( hSchemeKey, nullptr, "URL Protocol", REG_SZ, "", 1 ) )
		{
			LOG( ERROR ) << "Failed to set protocol value for URI scheme " << urlScheme;
			return false;
		}

		HKEY hCommandKey;
		error = RegCreateKeyExA( hSchemeKey, "Shell\\Open\\Command", 0, NULL, REG_OPTION_NON_VOLATILE, KEY_ALL_ACCESS, NULL, &hCommandKey, NULL );
		if ( error != ERROR_SUCCESS )
		{
			LOG( ERROR ) << "Failed create command key for " << urlScheme;
			return false;
		}

		if ( ERROR_SUCCESS != RegSetKeyValueA( hCommandKey, nullptr, nullptr, REG_SZ, commandToRun.c_str(), (DWORD)( commandToRun.size() + 1 ) ) )
		{
			LOG( ERROR ) << "Failed to set command value for URI scheme " << urlScheme;
			return false;
		}

		return true;
	}

	void invokeURL( const std::string& url )
	{
		::ShellExecuteA( nullptr, url.c_str(), nullptr, nullptr, nullptr, SW_SHOW );
	}

	/** exit this process if there's already an instance of the process key */
	void singletonProcess( const char *processKey )
	{
		HANDLE hMutex = CreateMutexExA( nullptr, processKey, CREATE_MUTEX_INITIAL_OWNER, SYNCHRONIZE );
		if ( !hMutex )
		{
			exit( -1 );
		}

		// see if we can wait for it
		DWORD res = WaitForSingleObject( hMutex, 0 );
		switch ( res )
		{
		case WAIT_OBJECT_0:
			// we're the owner. This is what we expect
			return;

		default:
			// any other result is a failure and we need to exit
			exit( 1 );
		}
	}


	/** Kills a process by name */
	bool killProcessByName( const std::string& exeName )
	{
		bool killedSomething = false;

		HANDLE hSnapShot = CreateToolhelp32Snapshot( TH32CS_SNAPALL, NULL );
		PROCESSENTRY32 pEntry;
		pEntry.dwSize = sizeof( pEntry );
		BOOL hRes = Process32First( hSnapShot, &pEntry );
		while ( hRes )
		{
			if ( strcmp( pEntry.szExeFile, exeName.c_str() ) == 0 )
			{
				HANDLE hProcess = OpenProcess( PROCESS_TERMINATE, 0,
					(DWORD)pEntry.th32ProcessID );
				if ( hProcess != NULL )
				{
					TerminateProcess( hProcess, 9 );
					CloseHandle( hProcess );
					killedSomething = true;
				}
			}
			hRes = Process32Next( hSnapShot, &pEntry );
		}
		CloseHandle( hSnapShot );

		return killedSomething;
	}

}