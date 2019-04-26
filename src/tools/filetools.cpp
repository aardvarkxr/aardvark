#include "tools/filetools.h"

#include <fstream>
#include <iterator>
#include <algorithm>

namespace tools
{

	std::vector<char> ReadBinaryFile( const std::filesystem::path & path )
	{
		std::ifstream inputFile( path, std::ios::binary );

		std::vector<char> vecResults( std::istreambuf_iterator<char>( inputFile ), {} );
		return std::move( vecResults );
	}

	bool WriteBinaryFile( const std::filesystem::path & path, const void *pvData, size_t unDataLength  )
	{
		std::ofstream outputFile( path, std::ios::binary );
		outputFile.write( (const char *)pvData, unDataLength );

		return outputFile.good();
	}
}