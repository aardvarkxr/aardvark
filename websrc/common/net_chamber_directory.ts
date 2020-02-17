import { Model, View, CroquetSession, startSession } from '@croquet/croquet';

export interface ChamberDetails
{
	uuid: string;
	displayName: string;	
}

class ChamberEntry extends Model
{
	public uuid: string;
	public displayName: string;

	public init( options: ChamberDetails )
	{
	}

}


export class ChamberDirectory extends Model
{
	public entries: { [uuid: string] : ChamberEntry } = {};

	public init( options: {} )
	{
		let generalChamber: ChamberEntry = ChamberEntry.create( 
				{ uuid: "general", displayName: "General" } ) as ChamberEntry;
		this.entries[ generalChamber.uuid ] = generalChamber;

		this.subscribe( "", "createChamber", this.onCreateChamber );
	}

	public onCreateChamber( args: ChamberDetails )
	{
		let newChamber: ChamberEntry = ChamberEntry.create( args ) as ChamberEntry;
		this.entries[ newChamber.uuid ] = newChamber;
	}
}

export class ChamberDirectoryView extends View
{
	private directory: ChamberDirectory;

	constructor( directory: ChamberDirectory )
	{
		super( directory );
		this.directory = directory;
	}

	public createChamber( chamberDetails: ChamberDetails )
	{
		this.directory.publish( "", "createChamber", chamberDetails );
	}

	public get chambers(): ChamberDetails[]
	{
		let entries: ChamberDetails[] = [];
		for( let uuid in this.directory.entries )
		{
			entries.push(
				{
					uuid,
					displayName: this.directory.entries[ uuid ].displayName,
				}
			);
		}
		return entries;
	}
}

let g_session: CroquetSession< ChamberDirectoryView> = null;

export function initChamberDirectory(): Promise< ChamberDirectoryView >
{
	return new Promise( async ( resolve, reject ) =>
	{
		g_session = await startSession( "", ChamberDirectory, ChamberDirectoryView );
		resolve( g_session.view );
	} );
}

export function getChamberList(): ChamberDetails[]
{
	return g_session.view.chambers;
}

export function addChamberToDirectory( uuid: string, displayName: string )
{
	return g_session.view.createChamber( { uuid, displayName } );
}

