#include "testutils.h"

#include <random>

std::vector<char> RandomBytes( size_t unRequestedCount )
{
	std::random_device rd;
	std::mt19937 gen( rd() );
	std::uniform_int_distribution<> dis( 0, 255 );

	std::vector<char> vecTestData;
	vecTestData.reserve( unRequestedCount );
	for ( size_t unCount = 0; unCount < unRequestedCount; unCount++ )
	{
		vecTestData.push_back( dis( gen ) );
	}
	return vecTestData;
}
