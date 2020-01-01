#pragma once

#include <stdint.h>

__declspec( dllexport )
bool initCrashHandler( const char* dbPath, const char* handlerPath, const char** attachments, uint32_t attachementCount );
