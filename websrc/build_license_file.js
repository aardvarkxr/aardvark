let checker = require( 'license-checker' );
const path = require( 'path' );
const fs = require( 'fs' );

checker.init( 
	{ 
		start: path.resolve( '.' ),
		customFormat: 
		{
			name: "",
			licenses: "",
			repository: "",
			version: "",
			licenseText: "",
		}
	},
	function( err, packages )
	{
		if( err )
		{
			console.log( "Error:", err );
		}
		else
		{
			let out = fs.openSync( path.resolve( '../data/web_third_party_licenses.txt' ), "w" );

			let acceptableLicenses =
			[
				"Apache-2.0",
				"Apache 2.0",
				"Apache License",
				"Artistic-2.0",
				"BSD",
				"BSD*",
				"BSD-2-Clause",
				"BSD-3-Clause",
				"CC-BY-3.0",
				"CC0-1.0",
				"ISC",
				"MIT",
				"Unlicense",
			];

			let checkedCustomPackages =
			[
				"@tlaukkan/tsm@0.8.5",
			];

			for( let packageTag in packages )
			{
				let package = packages[packageTag];

				let foundOne = false;
				if( typeof package.licenses === "string" )
				{
					for( let okLicense of acceptableLicenses )
					{
						if( package.licenses.includes( okLicense ) )
						{
							foundOne = true;
							break;
						}
					}
				}
				else
				{
					for( let license of package.licenses )
					{
						for( let okLicense of acceptableLicenses )
						{
							if( package.licenses.includes( okLicense ) )
							{
								foundOne = true;
								break;
							}
						}
	
						if( foundOne )
							break;
					}
				}

				if( !foundOne && !checkedCustomPackages.includes( packageTag ) )
				{
					console.log( `Doublecheck ${ packageTag } to make sure it's ok`, package.licenses );
				}

				fs.appendFileSync( out, `Aardvark uses ${ packageTag }`, 'utf8' );
				if( package.repository )
				{
					fs.appendFileSync( out, 
						`, which you can find at ${ package.repository }\n\n`, 'utf8')
				}
				else
				{
					fs.appendFileSync( out, `\n\n`, 'utf8')
				}

				fs.appendFileSync( out, package.licenseText.replace( /\r/g, "" ), 'utf8' );

				fs.appendFileSync( out, `\n================================================\n\n`, 'utf8' );

			}

			fs.closeSync( out );
		}
	}
 )