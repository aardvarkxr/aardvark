#include "tools/pathtools.h"

#include "tools/stringtools.h"

#include <cstring>
#include <cstdio>
#include <filesystem>
#include <stdio.h>
#include <algorithm>
#include <cctype>

#include <windows.h>
#include <KnownFolders.h>
#include <ShlObj.h>

namespace tools
{
	bool IsFileUri( const std::string & sUri )
	{
		return 0 == std::strncmp( sUri.c_str(), "file://", 7 )
			|| 0 == std::strncmp( sUri.c_str(), "FILE://", 7 );
	}

	std::filesystem::path FileUriToPath( const std::string & sUri )
	{
		if ( sUri.size() < 8 || !IsFileUri( sUri ) )
		{
			return "";
		}

		if ( sUri[7] == '/' )
		{
			// in: file:///C:/somepath/somefile.ext
			// out: c:/somepath/somefile.ext
			return sUri.substr( 8 );
		}
		else
		{
#if defined( _WINDOWS )
			// in: file://somenetworkloc/somepath/somefile.ext
			// out: //somenetworkloc/somepath/somefile.ext
			return sUri.substr( 5 );
#else
			// in: file://somefullpath/somepath/somefile.ext
			// out: /somefullpath/somepath/somefile.ext
			return sUri.substr( 6 );
#endif
		}
	}

	std::filesystem::path GetUniqueTempFilePath()
	{
		char buf[ L_tmpnam ];
		tmpnam_s( buf, sizeof( buf ) );

		auto path = buf;
		return path;
	}

	std::string PathToFileUri( const std::filesystem::path & path )
	{
		std::string sUri;
		if ( path.has_root_name() )
		{
			std::string sRootName = path.root_name().string();
			if ( sRootName.size() >= 2 && !strncmp( sRootName.c_str(), "//", 2 ) || !strncmp( sRootName.c_str(), "\\\\", 2 ) )
			{
				sUri = std::string( "file:" ) + path.root_name().generic_string();
			}
			else
			{
				sUri = std::string( "file:///" ) + path.root_name().generic_string();
			}
		}
		else
		{
			sUri = "file://";
		}

		sUri += path.root_directory().string();
		sUri += path.relative_path().string();
		std::replace( sUri.begin(), sUri.end(), '\\', '/' );
		return sUri;
	}


	std::filesystem::path GetDataPath()
	{
		std::filesystem::path myPath = std::filesystem::current_path();
		myPath /= "data";
		return myPath;
	}

	/** Returns the user's document path */
	std::filesystem::path GetUserDocumentsPath()
	{
		PWSTR documentsPath;
		if ( SUCCEEDED( SHGetKnownFolderPath( FOLDERID_Documents, 0, NULL, &documentsPath ) ) )
		{
			return documentsPath;
		}
		else
		{
			return "";
		}
	}

}
