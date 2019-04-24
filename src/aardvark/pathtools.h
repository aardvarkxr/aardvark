#pragma once

#include <string>
#include <filesystem>

namespace tools
{
	bool IsFileUri( const std::string & sUri );

	std::filesystem::path FileUriToPath( const std::string & sUri );
	std::string PathToFileUri( const std::filesystem::path & path );

	/** Generates a filename to use for a temp file */
	std::filesystem::path GetUniqueTempFilePath();
};

