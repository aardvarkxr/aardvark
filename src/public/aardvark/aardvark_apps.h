#pragma once

#include <stdint.h>

namespace aardvark
{
	class AppHandleClass_t;
	typedef AppHandleClass_t *AppHandle_t;

	enum EAardvarkError
	{
		AardvarkError_None = 0,

		AardvarkError_InvalidParam = 1,
		AardvarkError_InternalError = 2,
	};

	EAardvarkError avCreateApp( const char *appName, AppHandle_t *pHandle );
	EAardvarkError avDestroyApp( AppHandle_t app );
}
