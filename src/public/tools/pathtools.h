#pragma once

#include <string>
#include <filesystem>

namespace tools
{
	bool IsFileUri( const std::string & sUri );
	bool IsHttpUri(const std::string& sUri);

	std::filesystem::path FileUriToPath( const std::string & sUri );
	std::string PathToFileUri( const std::filesystem::path & path );

	/** Generates a filename to use for a temp file */
	std::filesystem::path GetUniqueTempFilePath();

	/** returns the data path */
	std::filesystem::path GetDataPath();

	/** Returns the user's document path */
	std::filesystem::path GetUserDocumentsPath();

	/** Returns the current executable's path */
	std::filesystem::path GetExecutablePath();

	/** returns the log path */
	std::filesystem::path GetLogDirectory();

	/** returns the cache path */
	std::filesystem::path GetCacheDirectory();
};

