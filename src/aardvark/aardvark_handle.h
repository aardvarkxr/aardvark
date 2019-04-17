#pragma once

#include <stdint.h>
#include <memory>
#include <unordered_map>
#include <mutex>

namespace aardvark
{
	class CAardvarkHandleBase;
	typedef std::shared_ptr<CAardvarkHandleBase> AardvarkHandleSharedPtr_t;

	class CAardvarkHandleBase
	{
	protected:
		CAardvarkHandleBase( uint32_t rawHandle ) { m_rawHandle = rawHandle; }
		virtual ~CAardvarkHandleBase() {}

	public:
		uint32_t GetRawHandle() const { return m_rawHandle; }

	private:
		uint32_t m_rawHandle = 0;
	};


	template< typename HandleType_t>
	class CAardvarkHandleBaseTyped : public CAardvarkHandleBase
	{
	public:
		CAardvarkHandleBaseTyped( uint32_t rawHandle ) : CAardvarkHandleBase( rawHandle ) {  }

		HandleType_t GetPublicHandle() const { return reinterpret_cast<HandleType_t>( static_cast<uintptr_t>( GetRawHandle() ) ); }
	};

	class CAardvarkHandleManager
	{
		friend class CAardvarkFrame;
	public:
		static CAardvarkHandleManager *Instance();

		template<typename RealType_t>
		std::shared_ptr<RealType_t> CreateHandle()
		{
			std::shared_ptr<RealType_t> obj = std::make_shared<RealType_t>( GetNextRawHandle() );
			m_handles.insert( std::make_pair( obj->GetRawHandle(), obj ) );
			return obj;
		}

		bool DestroyHandle( AardvarkHandleSharedPtr_t obj );

		AardvarkHandleSharedPtr_t Find( uint32_t unRawHandle );

		template<typename RealType_t, typename HandleType_t>
		std::shared_ptr<RealType_t> Find( HandleType_t handle )
		{
			uint32_t rawHandle = (uint32_t) (uint64_t)handle ;
			AardvarkHandleSharedPtr_t obj = Find( rawHandle );
			return std::dynamic_pointer_cast<RealType_t>( obj );
		}

	private:
		uint32_t GetNextRawHandle();

		std::unordered_map<uint32_t, AardvarkHandleSharedPtr_t> m_handles;
		uint32_t m_nextRawHandle = 12;
		std::mutex m_mutex;
	};


}

