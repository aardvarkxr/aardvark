import { AvNodeTransform } from './aardvark_protocol';

interface GadgetPersistence
{
	uri: string;
	hookPath?: string;
	settings?: any;
}

export interface StoredGadget
{
	uri: string;
	uuid: string;
}

const AardvarkStateFormat = 2;

export interface AardvarkState
{
	format: number;
	activeGadgets: { [uuid:string]: GadgetPersistence };
	installedGadgets: string[];
}


export function getStandardAardvarkPath(): string
{
	let os = eval( "require( 'os' )" );
	let path = eval( "require( 'path' ) ");
	return path.join( os.homedir(), "aardvark" );
}

export function getStandardPersistencePath(): string
{
	let path = eval( "require( 'path' )" );
	return path.join( getStandardAardvarkPath(), "state.json" );
}

export function v1ToV2( from: AardvarkState ): AardvarkState
{
	let to: AardvarkState = 
	{ 
		format: 2,
		activeGadgets: from.activeGadgets,
		installedGadgets: [] 
	};

	for( let installed of from.installedGadgets )
	{
		to.installedGadgets.push( installed.replace( "aardvark.install", "localhost:23842" ) );
	}

	return to;
}

export function readPersistentState( path: string ): AardvarkState
{
	try
	{
		let fs = eval( "require( 'fs' )" );

		let previousState = fs.readFileSync( path, 'utf8' );
		let state:AardvarkState = JSON.parse( previousState );

		if( state.format == 1 )
		{
			state = v1ToV2( state );
		}

		if( state.format != AardvarkStateFormat )
		{
			throw `Inappropriate state format ${state.format}`;
		}

		if( !state.activeGadgets[ "gadget_menu" ] )
		{
			console.log( "Gadget menu was missing. Forcing that to exist." );
			state.activeGadgets[ "gadget_menu" ]=
			{
				uri: "http://localhost:23842/gadgets/gadget_menu",
				hookPath: "/gadget/master/left_hand",
			};
		}

		console.log( `Read state from ${ path } for `
			+ `${ Object.keys( state.activeGadgets ).length } active gadgets` );
		return state;
	}
	catch( e )
	{
		console.log( "Failed to read state file. Using default start" );

		let state =
		{
			format: AardvarkStateFormat,
			activeGadgets: 
			{
				"master" : { uri: "http://localhost:23842/gadgets/aardvark_master" },
				"gadget_menu" :
				{
					uri: "http://localhost:23842/gadgets/gadget_menu",
					hookPath: "/gadget/master/left_hand",
				},
			},
			installedGadgets: 
			[
				"http://localhost:23842/gadgets/test_panel",
				"http://localhost:23842/gadgets/control_test",
			],
		}
		return state;
	}

}


export function writePersistentState( state: AardvarkState, path: string ): boolean
{
	let fs = eval( "require( 'fs' )" );
	state.format = AardvarkStateFormat;
	fs.writeFileSync( path, JSON.stringify( state, null, 2 ) );
	return true;
}

