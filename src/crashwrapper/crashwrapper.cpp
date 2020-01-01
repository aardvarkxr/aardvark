#include "crashwrapper/crashwrapper.h"

#include <map>
#include <string>
#include <client/crash_report_database.h>
#include <client/settings.h>
#include "client/crashpad_client.h"
#include <memory>
#include <filesystem>
#include <codecvt>
#include <algorithm>
#include <cctype>

using namespace crashpad;
static CrashpadClient client;


bool initCrashHandler( const char *dbPath, const char *handlerPath, const char **attachments, uint32_t attachementCount )
{
	std::map<std::string, std::string> annotations;
	std::vector<std::string> arguments;

	base::FilePath db_path( std::wstring_convert< std::codecvt_utf8< wchar_t >, wchar_t >().from_bytes( dbPath ) );
	base::FilePath handler_path( std::wstring_convert< std::codecvt_utf8< wchar_t >, wchar_t >().from_bytes(handlerPath ) );

	/*
	 * This should point to your server dump submission port (labeled as "http/writer"
	 * in the listener configuration pane. Preferably, the SSL enabled port should
	 * be used. If Backtrace is hosting your instance, the default port is 6098.
	 */
	std::string url("https://submit.backtrace.io/Aardvark/5c267f141e084f87156102a1b5203aa22def50de0f33d5fb234769caea32c33c/minidump");

	std::unique_ptr<CrashReportDatabase> database =
		crashpad::CrashReportDatabase::Initialize(db_path);

	if (database == nullptr || database->GetSettings() == NULL)
	{
		return false;
	}

	/* Enable automated uploads. */
	database->GetSettings()->SetUploadsEnabled(true);

	std::map<std::string, std::string> mapAttachments;
	for (uint32_t i = 0; i < attachementCount; i++)
	{
		std::filesystem::path path = attachments[i];
		mapAttachments[path.filename().generic_string()] = path.generic_string();
	}

	bool rc = client.StartHandlerForBacktrace( handler_path,
		db_path,
		db_path,
		url,
		annotations,
		arguments,
		mapAttachments,
		true,
		true);
	if (rc == false)
	{
		return false;
	}

	/* Optional, wait for Crashpad to initialize. */
	return client.WaitForHandlerStart(INFINITE);
}
