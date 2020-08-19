import { k_AardvarkVersion } from 'common/version';
export function initSentryForBrowser()
{
	let s = (global as any).Sentry;
	if( s )
	{
		s.init(
			{ 
				dsn: 'https://cfc585a1d41243bb96b94f2113d45d2c@o433321.ingest.sentry.io/5392347',
				release: "aardvark-core-gadget-js@" + k_AardvarkVersion,
			});
	}
	else
	{
		console.log("Unable to init sentry. Maybe its script include is missing?" );
	}
}