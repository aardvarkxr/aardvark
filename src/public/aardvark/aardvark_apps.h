#pragma once

#include <stdint.h>

#include "aardvark_types.h"

namespace aardvark
{
	class AppHandleClass_t;
	typedef AppHandleClass_t *AppHandle_t;

	EAardvarkError avCreateApp( const char *appName, AppHandle_t *pHandle );
	EAardvarkError avDestroyApp( AppHandle_t app );
}
