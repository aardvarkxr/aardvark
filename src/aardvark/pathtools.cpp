#include "pathtools.h"

#include "stringtools.h"

#include <cstring>
#include <cstdio>
#include <filesystem>
#include <stdio.h>

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


}
