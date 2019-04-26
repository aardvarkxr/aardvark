#pragma once

#include <vector>
#include <filesystem>

namespace tools
{
	/** Reads a binary file from the specified path */
	std::vector<char> ReadBinaryFile( const std::filesystem::path & path );

	/** Writes a binary file. Returns true if the write was successful */
	bool WriteBinaryFile( const std::filesystem::path & path, const void *pvData, size_t unDataLength );
}