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
let buildVersion = null;
let certPath = null;
let certPassword = null;

for( let argIndex = 0; argIndex < process.argv.length;  )
{
	let arg = process.argv[ argIndex++ ];
	if( arg == "--verbose" || arg == "-v" )
	{
		verbose = true;
	}
	else if( arg == "--buildversion" || arg == "-b" )
	{
		if( argIndex == process.argv.length )
		{
			console.log( "Usage: --buildversion|-b x.y.z" );
			process.exit( 1 );
		}
		buildVersion = process.argv[ argIndex++ ];
	}
	else if( arg == "--sign" || arg == "-s" )
	{
		if( ( process.argv.length - argIndex ) < 2 )
		{
			console.log( "Usage: --sign|-s <cert file path> <password>" );
			process.exit( 1 );
		}
		certPath = process.argv[ argIndex++ ];
		certPassword = process.argv[ argIndex++ ];
	}
	else if( arg == "--config" || arg == "-c" )
	{
		if( argIndex == process.argv.length )
		{
			console.log( "Usage: --buildversion|-b x.y.z" );
			process.exit( 1 );
		}
		let configFile = process.argv[ argIndex++ ];
		console.log( "Loading config file", configFile );
		
		let rawJson = fs.readFileSync( configFile );
		let config = JSON.parse( rawJson );
		if( config[ "certPath" ] )
		{
			certPath = config[ "certPath" ]
		}
		if( config[ "certPassword" ] )
		{
			certPassword = config[ "certPassword" ]
		}
	}
		
}

if( verbose )
{
	console.log( "Web directory is", webDir );
	console.log( "Src directory is", srcDir );
	console.log( "data directory is", dataDir );
	console.log( "cert path is", certPath );
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

	let args = ["-G", "\"Visual Studio 16 2019\"", "-A", "x64"];

	if( buildVersion )
	{
		args.push( `-DAARDVARK_VERSION:STRING=${buildVersion}` );
	}

	args.push( ".." );

	runCommand( "cmake", 
		args,
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

let subDir = "release";
if( buildVersion )
{
	subDir = "aardvark_" + buildVersion;
}

async function copyRelease()
{
	console.log( '++ starting release copy' );
	let startTime = Date.now();

	let outDir = path.resolve( __dirname, subDir );

	let inDir = path.resolve( bldDir, "avrenderer/Release" );
	copyDir( inDir, outDir );
	copyDir( dataDir, path.resolve( outDir, "data" ) );

	let elapsedTime = ( Date.now() - startTime ) / 1000;
	console.log(`-- finished release copy (Elapsed time ${elapsedTime} seconds)` );
}


async function buildArchive()
{
	if( !buildVersion )
	{
		console.log( '== Skipping archive' );
		return;
	}

	console.log( '++ starting build archive (Estimated time 30 seconds)' );
	let startTime = Date.now();

	await new Promise( ( resolve, reject ) =>
		{
			const archiver = require( path.resolve( __dirname, 'websrc/node_modules/archiver' ) );

			let output = fs.createWriteStream( 
				path.resolve( __dirname, subDir + ".zip" ) );
			let archive = archiver( 'zip', 
				{
					zlib: { level: 9 }
				} );

			output.on( 'close', () => { resolve(); } );

			archive.on( 'warning', ( err ) => 
				{ 
					if( err == 'ENOENT' )
					{
					}
					else
					{
						throw err;
					} 
				} );

			archive.on( 'error', ( err ) => { throw err; } );
			archive.pipe( output );

			archive.directory( subDir, subDir );
			archive.finalize();		
		} );

	let elapsedTime = ( Date.now() - startTime ) / 1000;
	console.log(`-- finished build archive (Elapsed time ${elapsedTime} seconds)` );
}

function gatherDir( from )
{
	let dirs = [];
	let files = [];

	let fromDir = fs.opendirSync( from );
	let ent
	while( ent = fromDir.readSync() )
	{
		let fromPath = path.resolve( from, ent.name );
		if( ent.isDirectory() )
		{
			const [ subDirs, subFiles ] = gatherDir( fromPath );
			dirs = dirs.concat( subDirs );
			files = files.concat( subFiles );
		}
		else if( ent.isFile() )
		{
			files.push( fromPath );
		}
	}
	fromDir.closeSync();

	dirs.push( from );

	return [dirs, files];
}


function fileCmd( absPath, buildDir )
{
	let relPath = path.relative( buildDir, absPath );
	return `File /oname=${ relPath } ${ absPath }`;
}

function rmDirCmd( relPath )
{
	if( relPath == "" )
		return `RMDir $INSTDIR`;
	else
		return `RMDir $INSTDIR\\${ relPath }`;
}

	
function installScript( buildDir )
{
	const [ dirs, files ] = gatherDir( buildDir );

	let relFiles = files.map( ( absPath ) => path.relative( buildDir, absPath ) );
	let relDirs = dirs.map( ( absPath ) => path.relative( buildDir, absPath ) );

	let script = `
Unicode True

# define installer name
OutFile "aardvarkinstaller_${ buildVersion }.exe"
 
LoadLanguageFile "\${NSISDIR}\\Contrib\\Language files\\English.nlf"

# set desktop as install directory
InstallDir $PROGRAMFILES64\\Aardvark
 
VIProductVersion "${ buildVersion }.0"
VIAddVersionKey /LANG=\${LANG_ENGLISH} "ProductName" "Aardvark Installer"
VIAddVersionKey /LANG=\${LANG_ENGLISH} "CompanyName" "Aardvark Team"
VIAddVersionKey /LANG=\${LANG_ENGLISH} "FileDescription" "Aardvark Installer"
VIAddVersionKey /LANG=\${LANG_ENGLISH} "FileVersion" "${ buildVersion }"


# default section start
Section
 
# define output path
SetOutPath $INSTDIR
 
# specify file to go in output path
${ relDirs.map( ( dname) => `CreateDirectory "$INSTDIR\\${ dname }"` ).join('\n') }
${ files.map( ( fname) => fileCmd( fname, buildDir ) ).join('\n') }

# let node talk through windows firewall
ExecWait 'netsh advfirewall firewall add rule name=AardvarkServer dir=in action=allow program="$INSTDIR\\data\\server\\bin\\node.exe" enable=yes profile=public,private'

# Register the install with Aardvark
ExecWait '$INSTDIR\\aardvarkxr.exe register'
  
# define uninstaller name
WriteUninstaller $INSTDIR\\uninstaller.exe
 
 
#-------
# default section end
SectionEnd
 
# create a section to define what the uninstaller does.
# the section will always be named "Uninstall"
Section "Uninstall"

# Unregister the install with Aardvark
ExecWait '$INSTDIR\\aardvarkxr.exe unregister'
 
# Remove firewall rule
ExecWait 'netsh advfirewall firewall delete rule name=AardvarkServer'

 
# Always delete uninstaller first
Delete $INSTDIR\\uninstaller.exe

# now delete installed files and directories
${ relFiles.map( ( fname ) => `Delete $INSTDIR\\${ fname }` ).join( '\n' ) }
${ relDirs.map( ( dname ) => rmDirCmd( dname ) ).join( '\n' ) }
 
SectionEnd

		`;
	return script;
}


async function buildInstaller()
{
	if( !buildVersion )
		return;

	let script = installScript( path.resolve( __dirname, subDir ) );
	fs.writeFileSync( path.resolve( __dirname, "installer.nsi" ), script );

	runCommand( "makensis", 
		[ "installer.nsi" ],
		__dirname, 120, "Creating Installer" );
	
	
}

async function signFile( path )
{
	runCommand( 
		"signtool", 
		[ "sign", 
			"/f", certPath, 
			"/p", certPassword,  
			"/t", "http://timestamp.digicert.com",
			path], 
		__dirname, 1, "Signing " + path );
}


async function signExes()
{
	if( !subDir || !certPath )
		return;

	let buildDir = path.resolve( __dirname, subDir );

	await signFile( buildDir + "\\aardvarkxr.exe" );
	await signFile( buildDir + "\\crashpad_handler.exe" );
}


async function signInstaller()
{
	if( !subDir || !certPath )
		return;

	let installerPath = path.resolve( __dirname, `aardvarkinstaller_${ buildVersion }.exe` );
	await signFile( installerPath );
}


async function runBuild()
{
	if( buildVersion )
	{
		console.log( `== Writing build version` );

		let jsVersion = path.resolve( __dirname, "websrc/common/version.ts" );
		fs.writeFileSync( jsVersion, `export const k_AardvarkVersion = "${buildVersion}";\n`  );
		console.log( `    ${jsVersion}` );
	}

	runCommand( "npm", ["install"], webDir, 60, "npm install" );
	runCommand( "npm", ["run", "build"], webDir, 30, "web build" );
	runCommand( "npm", ["run", "updatelicense"], webDir, 10, "generate web license file" );
	await unzipCef();
	await cppBuild();
	await copyRelease();
	await signExes();
	await buildArchive();
	await buildInstaller();
	await signInstaller();

	console.log( "build finished" );
}

runBuild();
