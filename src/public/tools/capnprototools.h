#pragma once

#include <capnp/common.h>
#include <capnp/message.h>

namespace tools
{
	template <typename T>
	class OwnCapnp;

	template <typename Reader>
	OwnCapnp<capnp::FromReader<Reader>> newOwnCapnp( Reader value );

	template <typename T>
	class OwnCapnp : public T::Reader {
		// A copy of a capnp object which lives in-memory and can be passed by ownership.

	public:
		OwnCapnp( decltype( nullptr ) ) {}

		// Inherits methods of reader.

	private:
		kj::Array<capnp::word> words;

		OwnCapnp( kj::Array<capnp::word> words )
			: T::Reader( capnp::readMessageUnchecked<T>( words.begin() ) ),
			words( kj::mv( words ) ) {}

		template <typename Reader>
		friend OwnCapnp<capnp::FromReader<Reader>> newOwnCapnp( Reader value );
	};

	template <typename Reader>
	OwnCapnp<capnp::FromReader<Reader>> newOwnCapnp( Reader value ) {
		auto words = kj::heapArray<capnp::word>( value.totalSize().wordCount + 1 );
		memset( words.asBytes().begin(), 0, words.asBytes().size() );
		capnp::copyToUnchecked( value, words );
		return OwnCapnp<capnp::FromReader<Reader>>( kj::mv( words ) );
	}


};
