const fs = require( 'fs' );
const process = require( 'process' );
const child_process = require( 'child_process' );
const path = require( 'path' );
const zlib = require( 'zlib' );


let webDir = path.resolve( __dirname, 'websrc' );
let srcDir = path.resolve( __dirname, 'src' );
let dataDir = path.resolve( __dirname, 'data' );
let bldDir = path.resolve( srcDir, "build" );

let verbose = false;
for( let arg of process.argv )
{
	if( arg == "--verbose" || arg == "-v" )
	{
		verbose = true;
	}
}

if( verbose )
{
	console.log( "Web directory is", webDir );
	console.log( "Src directory is", srcDir );
	console.log( "data directory is", dataDir );
}

function runCommand( command, args, cwd, expectedTime, name )
{
	console.log(`++ Starting ${name} (Estimated time ${expectedTime} seconds)`);
	let startTime = Date.now();
	let cmd = child_process.spawnSync( 
		command, args,
		{
			'cwd': cwd,
			'shell': true,
		} );

	if( cmd.status === null )
	{
		console.log( `${name} aborted`, cmd.signal );
		if( verbose )
		{
			console.log( "stdout", cmd.stdout.toString() );
			console.log( "stderr", cmd.stderr.toString() );
		}
		process.exit(1);
	}
	if( cmd.status != 0 )
	{
		console.log( `${name} exited with error`, cmd.status );
		if( verbose )
		{
			console.log( "stdout", cmd.stdout.toString() );
			console.log( "stderr", cmd.stderr.toString() );
		}
		process.exit( cmd.status );
	}
	let elapsedTime = ( Date.now() - startTime ) / 1000;
	console.log( `-- Finished ${name} (Elapsed time ${elapsedTime} seconds)`);
}

async function unzip( from, to )
{
	return new Promise( ( resolve, reject ) =>
	{
		let inp = fs.createReadStream( from );
		let out = fs.createWriteStream( to );
		out.on( 'finish', () => { resolve(); } );
		out.on( 'error', () => { reject(); } );
		inp.pipe( zlib.Unzip() ).pipe( out );
	} );
}

async function unzipCef()
{
	console.log( '++ starting CEF unzip' );
	let startTime = Date.now();

	let cefDir = path.resolve( srcDir, 'thirdparty/cef_binary_78' );
	await unzip( path.resolve( cefDir, 'Debug/libcef.dll.gz' ),
		path.resolve( cefDir, 'Debug/libcef.dll' ) );
	await unzip( path.resolve( cefDir, 'Debug/cef_sandbox.lib.gz' ),
		path.resolve( cefDir, 'Debug/cef_sandbox.lib' ) );
	await unzip( path.resolve( cefDir, 'Release/libcef.dll.gz' ),
		path.resolve( cefDir, 'Release/libcef.dll' ) );
	let elapsedTime = ( Date.now() - startTime ) / 1000;

	console.log(`-- finished CEF unzip (Elapsed time ${elapsedTime} seconds)` );
}

function ensureDirExists( dir )
{
	if( !fs.existsSync( dir ) )
	{
		fs.mkdirSync( dir );
	}
}

async function cppBuild()
{
	ensureDirExists( bldDir );

	runCommand( "cmake", ["-G", "\"Visual Studio 15 2017 Win64\"", ".."],
		bldDir, 10, "Creating Projects" );

	let vsWherePath = path.resolve( __dirname, "build_helpers/vswhere.exe" );
	let vsWhereString = child_process.execSync( vsWherePath + 
		" -format json -version 15" );
	let vsWhere = JSON.parse( vsWhereString.toString() );

	let vsDir = vsWhere[0].installationPath;
	let vsCom = path.resolve( vsDir, "Common7/IDE/devenv.com" );

	let solutionPath = path.resolve( bldDir, "Aardvark.sln" );

	runCommand( `"${vsCom}"`, [ solutionPath, "/Build", "\"Release|x64\"" ],
		bldDir, 30, "C++ Build" );
}

async function copyDir( from, to )
{
	if ( verbose )
	{
		console.log( `Copying ${ from } to ${ to }` );
	}

	ensureDirExists( to );
	let fromDir = fs.opendirSync( from );
	let ent
	while( ent = fromDir.readSync() )
	{
		let fromPath = path.resolve( from, ent.name );
		let toPath = path.resolve( to, ent.name );
		if( ent.isDirectory() )
		{
			copyDir( fromPath, toPath );
		}
		else if( ent.isFile() )
		{
			fs.copyFileSync( fromPath, toPath );
		}
	}
	fromDir.closeSync();
}

async function copyRelease()
{
	console.log( '++ starting release copy' );
	let startTime = Date.now();

	let outDir = path.resolve( __dirname, "release" );

	let inDir = path.resolve( bldDir, "avrenderer/Release" );
	copyDir( inDir, outDir );
	copyDir( dataDir, path.resolve( outDir, "data" ) );


	let elapsedTime = ( Date.now() - startTime ) / 1000;
	console.log(`-- finished release copy (Elapsed time ${elapsedTime} seconds)` );
}


async function runBuild()
{

	runCommand( "npm", ["install"], webDir, 60, "npm install" );
	runCommand( "npm", ["run", "build"], webDir, 30, "web build" );
	runCommand( "npm", ["run", "updatelicense"], webDir, 10, "generate web license file" );
	await unzipCef();
	await cppBuild();
	await copyRelease();

	console.log( "build finished" );
}

runBuild();
