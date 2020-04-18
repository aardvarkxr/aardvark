import { AvNodeTransform, AvRendererConfig } from './aardvark_protocol';
import { v4 as uuid } from 'uuid';

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

const AardvarkStateFormat = 3;

export interface AardvarkState
{
	format: number;
	activeGadgets: { [uuid:string]: GadgetPersistence };
	rendererConfig: AvRendererConfig;
	installedGadgets: string[];
	localUserUuid: string;
	localUserDisplayName: string;
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

const firstNames = 
[
	"Green",
	"Blue",
	"Red", 
	"Orange",
	"Teal",
	"Purple",
	"Pink",
	"Yellow",
	"Black",
	"White",
	"Brown",
	"Beige"
];

const lastNames =
[
	"Apple",
	"Banana",
	"Lemon",
	"Pineapple",
	"Coconut",
	"Lime",
	"Kiwi",
	"Pear",
	"Cherry",
	"Strawberry",
	"Grape",
	"Mango"
];


function generateRandomName( ):string
{
	let firstIndex = Math.floor( Math.random() * firstNames.length );
	let lastIndex = Math.floor( Math.random() * lastNames.length );
	return `${ firstNames[ firstIndex ] } ${ lastNames[ lastIndex ] }`;
}

export function v1ToV2( from: AardvarkState ): AardvarkState
{
	let to: AardvarkState = 
	{ 
		format: 2,
		activeGadgets: from.activeGadgets,
		installedGadgets: [],
		rendererConfig: { enableMixedReality: false, mixedRealityFov: 50.3, clearColor: [0, 1, 0] },
		localUserUuid: uuid(),
		localUserDisplayName: generateRandomName(),
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
		let state: AardvarkState = JSON.parse( previousState );

		if( state.format == 1 || state.format == 2 )
		{
			throw `Stored state ${state.format} is no longer supported.`;
		}

		if( state.format != AardvarkStateFormat )
		{
			throw `Inappropriate state format ${state.format}`;
		}

		if( !state.rendererConfig ) {
			state.rendererConfig = {
				enableMixedReality: false,
				mixedRealityFov: 50.3,
				clearColor: [0, 1, 0]
			};
		}

		if( !state.activeGadgets[ "gadget_menu" ] )
		{
			console.log( "Gadget menu was missing. Forcing that to exist." );
			state.activeGadgets[ "gadget_menu" ]=
			{
				uri: "http://localhost:23842/gadgets/gadget_menu",
				hookPath: "/gadget/hands/left_hand",
			};
		}

		if( !state.localUserDisplayName )
		{
			state.localUserDisplayName = generateRandomName();
		}

		console.log( `Read state from ${ path } for `
			+ `${ Object.keys( state.activeGadgets ).length } active gadgets` );
		return state;
	}
	catch( e )
	{
		console.log( `Failed to read state file because ${ e } Using default start` );

		let state: AardvarkState =
		{
			format: AardvarkStateFormat,
			activeGadgets: 
			{
				"gadget_menu" :
				{
					uri: "http://localhost:23842/gadgets/gadget_menu",
					hookPath: "/gadget/hands/left_hand",
				},
			},
			installedGadgets: [],
			rendererConfig: { mixedRealityFov: 50.3, enableMixedReality: false, clearColor: [0, 1, 0] },
			localUserUuid: uuid(),
			localUserDisplayName: generateRandomName(),
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

