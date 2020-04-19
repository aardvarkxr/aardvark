const fs = require( 'fs' );
const process = require( 'process' );
const child_process = require( 'child_process' );
const path = require( 'path' );
const zlib = require( 'zlib' );


let packageDir = path.resolve( __dirname, 'packages' );

let verbose = false;
let buildVersion = null;

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
}

if( verbose )
{
	console.log( "Package directory is", packageDir );
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

function doesPackageExist( packageName, version )
{
	let cmd = child_process.spawnSync( 
		"npm", [ "view", packageName, "--json" ],
		{
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

	let packageInfo = JSON.parse( cmd.stdout.toString() );
	return packageInfo[ "versions" ].includes( version );
}

function ensureDirExists( dir )
{
	if( !fs.existsSync( dir ) )
	{
		fs.mkdirSync( dir );
	}
}


function sleep( delayMs, reason )
{
	return new Promise( resolve => 
	{
		if( reason )
		{
			console.log( `Sleeping for ${ (delayMs/1000).toFixed( 2 ) }`
				+ `seconds for ${ reason }` );
		}
		global.setTimeout( resolve, delayMs );
	} );
}

async function waitForPackage ( packageName, version, secondsToWait )
{
	console.log( `Waiting for ${ packageName }@${ version } to exist`
		+ ` for up to ${ secondsToWait } seconds.` );
	let count = 0;
	while( !doesPackageExist( packageName, version ) && count < secondsToWait )
	{
		await sleep( 1000 );
		count++;
	}

	if( !doesPackageExist( packageName, version ) )
	{
		console.log( "Package did not appear" );
		return false;
	}
	
	console.log( `package appeared after ${ count } seconds` );
	return true;
}


async function runBuild()
{
	if( !buildVersion )
	{
		console.log( "-b required to set package versions" );
		process.exit( 1 );
	}

	let sharedPackageName = `@aardvarkxr/aardvark-shared`;
	let sharedPackageNameAndVersion = `${ sharedPackageName }@${ buildVersion }`;

	let sharedPackage = path.resolve( packageDir, "aardvark-shared" );
	runCommand( "npm", [ "version", "--allow-same-version", buildVersion ],
		sharedPackage, 1, "shared update version" );
	runCommand( "npm", ["install"], sharedPackage, 10, "shared npm install" );
	runCommand( "npm", ["run", "build"], sharedPackage, 5,
		"shared run build" );
	runCommand( "npm", ["publish", "--access", "public"], sharedPackage, 5,
		"shared publish" );
	let publishWorked = await waitForPackage( sharedPackageName, buildVersion,
		600 );
	if( !publishWorked )
	{
		console.log( "shared package failed to publish" );
		process.exit( 1 );
	}
		

	let cliPackage = path.resolve( packageDir, "aardvark-cli" );
	runCommand( "npm", [ "version", "--allow-same-version", buildVersion ],
		cliPackage, 1, "cli update version" );
	runCommand( "npm", ["install", sharedPackageNameAndVersion ], 
		cliPackage, 10, "cli npm install shared" );
	runCommand( "npm", ["install"], cliPackage, 10, "cli npm install" );
	runCommand( "npm", ["run", "build"], cliPackage, 5,
		"cli run build" );
	runCommand( "npm", ["publish", "--access", "public"], cliPackage, 5,
		"cli publish" );

	let reactPackage = path.resolve( packageDir, "aardvark-react" );
	runCommand( "npm", [ "version", "--allow-same-version", buildVersion ],
		reactPackage, 1, "react update version" );
	runCommand( "npm", ["install", sharedPackageNameAndVersion ], 
		reactPackage, 10, "react npm install shared" );
	runCommand( "npm", ["install"], reactPackage, 10, "react npm install" );
	runCommand( "npm", ["run", "build"], reactPackage, 5,
		"react run build" );
	runCommand( "npm", ["run", "builddoc"], reactPackage, 40,
		"react run build documentation" );
	runCommand( "npm", ["publish", "--access", "public"], reactPackage, 5,
		"react publish" );


	console.log( "build finished" );
}

runBuild();
