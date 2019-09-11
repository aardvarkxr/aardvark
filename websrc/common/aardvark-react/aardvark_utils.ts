
export function assert( expr: boolean, msg?: string )
{
	if( !expr )
	{
		if( msg )
		{
			throw msg;
		}
		else
		{
			throw "assertion failed";
		}
	}
}
