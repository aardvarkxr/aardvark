#pragma once

#include <filesystem>
#include <string>

namespace tools
{
	bool registerURLSchemeHandler( const std::string & urlScheme, const std::filesystem::path & executableToRun );
}