
interface GadgetPersistence
{
	uri: string;
	hook?: string;
	settings?: any;
}

export interface StoredGadget
{
	uri: string;
	uuid: string;
}

const AardvarkStateFormat = 1;

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

export function readPersistentState( path: string ): AardvarkState
{
	try
	{
		let fs = eval( "require( 'fs' )" );

		let previousState = fs.readFileSync( path, 'utf8' );
		let state:AardvarkState = JSON.parse( previousState );

		if( state.format != AardvarkStateFormat )
		{
			throw `Inappropriate state format ${state.format}`;
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
				"master" : { uri: "https://aardvark.install/gadgets/aardvark_master" },
			},
			installedGadgets: 
			[
				"https://aardvark.install/gadgets/test_panel",
				"https://aardvark.install/gadgets/charm_bracelet",
				"https://aardvark.install/gadgets/control_test",
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

