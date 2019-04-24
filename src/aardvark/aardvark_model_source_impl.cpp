#include "aardvark_model_source_impl.h"

namespace aardvark
{

	CAardvarkModelSource::CAardvarkModelSource( const std::string & sUri, const std::vector<char> && vecBlob )
		: m_vecBlob( vecBlob ), m_sUri( sUri )
	{

	}


	::kj::Promise<void> CAardvarkModelSource::uri( UriContext context )
	{
		context.getResults().setUri( m_sUri );
		return kj::READY_NOW;
	}

	::kj::Promise<void> CAardvarkModelSource::data( DataContext context )
	{
		auto dataBuilder = context.getResults().initData( (uint32_t)m_vecBlob.size() );
		std::copy( m_vecBlob.begin(), m_vecBlob.end(), dataBuilder.begin() );
		return kj::READY_NOW;
	}


}

