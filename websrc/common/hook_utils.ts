import { AvNodeTransform } from '@aardvarkxr/aardvark-shared';

export enum HookType
{
	Auto = 0,
	Hook = 1,
	Grab = 2,
}

export function transformToUriString( transform: AvNodeTransform )
{
	let res = "";
	if( transform.position )
	{
		res += `t(${ transform.position.x },${ transform.position.y },${ transform.position.z })`;
	}
	if( transform.scale )
	{
		if( res.length )
		{
			res += "+";
		}
		res += `s(${ transform.scale.x },${ transform.scale.y },${ transform.scale.z })`;
	}
	if( transform.rotation )
	{
		if( res.length )
		{
			res += "+";
		}
		res += `r(${ transform.rotation.w },${ transform.rotation.x },${ transform.rotation.y },${ transform.rotation.z })`;
	}
	return res;
}

export function uriStringToTransform( uriFragment: string ): AvNodeTransform
{
	// a zero length fragment means "no transform". Everything else should parse
	if( !uriFragment.length )
	{
		return null;
	}

	let re = /^([tsr])\((.*)\)$/;

	let transform : AvNodeTransform = {};

	let parts = uriFragment.split( "+" );
	for( let part of parts )
	{
		let match = re.exec( part );
		if( !match )
		{
			throw new Error( "Could not parse transform fragment " + part );
		}

		let components = match[2].split( "," );
		switch( match[1] )
		{
			case "t":
				if( components.length != 3 )
				{
					throw new Error( "translation has three components " + part );
				}

				transform.position = 
				{
					x: parseFloat( components[0] ),
					y: parseFloat( components[1] ),
					z: parseFloat( components[2] ),
				}
				break;
		
			case "s":
				if( components.length != 3 )
				{
					throw new Error( "scale has three components " + part );
				}

				transform.scale = 
				{
					x: parseFloat( components[0] ),
					y: parseFloat( components[1] ),
					z: parseFloat( components[2] ),
				}
				break;

			case "r":
				if( components.length != 4 )
				{
					throw new Error( "scale has three components " + part );
				}

				transform.rotation = 
				{
					w: parseFloat( components[0] ),
					x: parseFloat( components[1] ),
					y: parseFloat( components[2] ),
					z: parseFloat( components[3] ),
				}
				break;

			default:
				throw new Error( "Unknown transform component " + match[1] );
		} 
	}

	return transform;
}

export interface HookPathParts
{
	type: HookType;
	gadgetUuid: string;
	holderPersistentName: string;
	hookFromGadget?: AvNodeTransform;
}


export function buildPersistentHookPath( gadgetUuid: string, holderPersistentName: string, 
	hookFromGadget: AvNodeTransform, type: HookType )
{
	let path:string = "/gadget/" + gadgetUuid + "/" + holderPersistentName;
	if( type == HookType.Grab )
	{
		path = "/gadget/" + gadgetUuid + "/_grab/" + holderPersistentName;
	}
	else
	{
		path = "/gadget/" + gadgetUuid + "/" + holderPersistentName;
	}
	
	if( hookFromGadget )
	{
		path += "/" + transformToUriString( hookFromGadget );
	}
	return path;
}

export function buildPersistentHookPathFromParts( parts: HookPathParts )
{
	return buildPersistentHookPath( parts.gadgetUuid, parts.holderPersistentName, parts.hookFromGadget, 
		parts.type  );
}

export function parsePersistentHookPath( path: string ): HookPathParts
{
	let type = HookType.Grab;
	let reGrabLong = /^\/gadget\/(.*)\/_grab\/(.*)\/(.*)$/ ;
	let match = reGrabLong.exec( path );
	if( !match )
	{
		let reGrabShort = /^\/gadget\/(.*)\/_grab\/(.*)$/ ;
		match = reGrabShort.exec( path );
	}
	if( !match )
	{
		let reLong = /^\/gadget\/(.*)\/(.*)\/(.*)$/ ;
		match = reLong.exec( path );
		type = HookType.Hook;
	}
	if( !match )
	{
		let reShort = /^\/gadget\/(.*)\/(.*)$/ ;
		match = reShort.exec( path );
		type = HookType.Hook;
	}

	if( !match )
	{
		// this probably isn't a gadget hook path
		return null;
	}

	let hookFromGadget: AvNodeTransform;
	if( match.length == 4 ) // if we matched reLong
	{
		try
		{
			hookFromGadget = uriStringToTransform( match[3] );
		}
		catch( e )
		{
			return null;
		}
	}

	return (
		{ 
			type,
			gadgetUuid: match[1],
			holderPersistentName: match[2],
			hookFromGadget,
		} );
}

