#pragma once

#include <string>

namespace tools
{
	std::string WStringToUtf8( const std::wstring & swString );
	std::wstring Utf8ToWString( const std::string & swString );
}