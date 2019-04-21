#pragma once

#include <string>

namespace tools
{
	bool IsFileUri( const std::string & sUri );

	std::string FileUriToPath( const std::string & sUri );

};

