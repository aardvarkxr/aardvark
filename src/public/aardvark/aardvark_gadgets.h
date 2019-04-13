#pragma once

#include <stdint.h>

namespace aardvark
{
	class GadgetHandleClass_t;
	typedef GadgetHandleClass_t *GadgetHandle_t;

	EAardvarkError avCreateGadget( AppHandle_t app, const char *gadgetName, GadgetHandle_t *pHandle );
	EAardvarkError avDestroyGadget( GadgetHandle_t gadget );
}
