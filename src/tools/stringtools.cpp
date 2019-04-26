#include "tools/stringtools.h"

#include <locale>
#include <clocale>
#include <codecvt>

namespace tools
{
#pragma warning(push)
#pragma warning( disable : 4996 )
	std::string WStringToUtf8( const std::wstring & swString )
	{
		return std::wstring_convert< std::codecvt_utf8< wchar_t >, wchar_t >().to_bytes( swString );
	}
	std::wstring Utf8ToWString( const std::string & sString )
	{
		return std::wstring_convert< std::codecvt_utf8< wchar_t >, wchar_t >().from_bytes( sString );
	}
#pragma warning(push)

}