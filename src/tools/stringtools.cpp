#include "tools/stringtools.h"

#include <locale>
#include <clocale>
#include <codecvt>
#include <algorithm>
#include <cctype>
#include <sstream>

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

	std::string stringToLower( const std::string & s )
	{
		std::string lower( s );
		std::transform( lower.begin(), lower.end(), lower.begin(),
			[]( unsigned char c ) { return std::tolower( c ); } );
		return lower;
	}

	bool stringIsPrefix( const std::string & prefix, const std::string & testString )
	{
		return stringIsPrefixCaseSensitive( stringToLower( prefix ), stringToLower( testString ) );
	}

	bool stringIsPrefixCaseSensitive( const std::string & prefix, const std::string & testString )
	{
		if ( testString.size() < prefix.size() )
		{
			return false;
		}

		return prefix.end() == std::mismatch( prefix.begin(), prefix.end(), testString.begin() ).first;
	}

	std::vector<std::string> tokenizeString( const std::string& s )
	{
		std::stringstream ss( s );
		std::string item;
		std::vector<std::string> elems;

		while ( std::getline( ss, item, ' ' ) ) 
		{
			elems.push_back(std::move(item)); // if C++11 (based on comment from @mchiasson)
		}

		return elems;
	}

}