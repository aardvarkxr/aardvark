import * as path from 'path';
import * as fs from 'fs';
import bind from 'bind-decorator';
import { Tail } from 'tail';
import { files } from 'jszip';


interface RegexHandler
{
	re: RegExp;
	handler: ( res: RegExpExecArray ) => void;
}

export class CVRChatHooks
{
	private vrchatDir: string;
	private tail: Tail;
	private handlers: RegexHandler[];

	constructor()
	{
		this.handlers =
		[
			{ 
				re: /^.* Log *-  \[RoomManager\] Entering Room: (.*)$/,
				handler: this.onEnteringRoom
			},
			{ 
				re: /^.* Log *-  \[RoomManager\] Joining (.*)$/,
				handler: this.onJoining
			},
			{ 
				re: /^.* Log *-  pose (.*)$/,
				handler: this.onPose
			}
		];

		this.vrchatDir = path.normalize( process.env[ "APPDATA" ] + "/../LocalLow/VRChat/VRChat" );
		console.log( "Watching for output logs in", this.vrchatDir );

		fs.watch( this.vrchatDir, {}, this.onWatchEvent );

		// parse the most recent log file
		let dir = fs.opendirSync( this.vrchatDir );
		let newestLog: string = null;
		let newestLogStat: fs.Stats = null;
		for( let file: fs.Dirent = dir?.readSync(); file; file = dir.readSync() )
		{
			if( !file.isFile() )
				continue;

			if( !file.name.startsWith( "output_log_" ) )
				continue;

			let fullPath = this.vrchatDir + "/" + file.name;
			let st = fs.statSync( fullPath );
			if( !st )
				continue;

			// ignore any log files that haven't been modified in at least an hour
			let ageInHours = ( Date.now() - st.mtimeMs ) / ( 1000 * 60 * 60 );
			if( ageInHours > 1 )
				continue;

			if( !newestLog || newestLogStat.mtimeMs < st.mtimeMs )
			{
				newestLog = fullPath;
				newestLogStat = st;
			}
		}

		if( newestLog )
		{
			console.log( "Reading recent log file at startup:", newestLog );
			this.tailLog( newestLog );
		}
		else
		{
			console.log( "No recent VR Chat log file to read" );
		}
	}

	@bind
	private onWatchEvent( eventType: string, filename: string )
	{
		if( eventType == "rename" )
		{
			console.log( "rename event", eventType, filename );

			let fullPath = this.vrchatDir + "/" + filename;
			if( fs.existsSync( fullPath ) && filename.startsWith( "output_log_" ) )
			{
				this.tailLog( fullPath );
			}
		}
	}

	private tailLog( fullPath: string )
	{
		this.tail = new Tail( fullPath, { fromBeginning: true } );
		this.tail.on( "line", this.onLogLine );
	}

	@bind
	private onLogLine( line: string )
	{
		if( line.length == 0 )
			return;
			

		for( let handler of this.handlers )
		{
			let res = handler.re.exec( line );
			if( res )
			{
				handler.handler( res );
				break;
			}
		}

		//console.log( "new log line:", line );
	}

	@bind
	private onEnteringRoom( res: RegExpExecArray )
	{
		console.log( "onEnteringRoom:", res[1] );
	}

	@bind
	private onJoining( res: RegExpExecArray )
	{
		console.log( "onJoining:", res[1] );
	}

	@bind
	private onPose( res: RegExpExecArray )
	{
		// these are too spammy to log
	}

}

