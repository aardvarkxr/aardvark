import { EndpointAddr, endpointAddrToString } from "@aardvarkxr/aardvark-shared";

export class EndpointAddrMap<T>
{
	private map = new Map<string, T>();

	public has( epa: EndpointAddr )
	{
		return this.map.has( endpointAddrToString( epa ) );
	}

	public get( epa: EndpointAddr )
	{
		return this.map.get( endpointAddrToString( epa ) );
	}

	public set( epa: EndpointAddr, value: T )
	{
		return this.map.set( endpointAddrToString( epa ), value );
	}

	public delete( epa: EndpointAddr )
	{
		return this.map.delete( endpointAddrToString( epa ) );
	}
}