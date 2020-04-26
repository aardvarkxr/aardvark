const path = require('path');
var HtmlWebpackPlugin = require( 'html-webpack-plugin' );
const CopyPlugin = require('copy-webpack-plugin');

let defaults = 
{
	mode: "development",
	devtool: "inline-source-map",

	module: 
	{
		rules:
		[
			{ 
				test: /\.tsx?$/,
				use: 'ts-loader',
				exclude: /node_modules/
			},
			{
				test: /\.css$/,
				use: 
				[
					'style-loader',
					'css-loader'
				]
			},
			{
				test: /\.(png|svg|jpg|gif)$/,
				use: 
				[
					'file-loader'
				]
			}
				
		]
	},

	resolve:
	{
		modules:[ path.resolve( __dirname, 'node_modules' ) ],
		extensions: [ '.ts', '.tsx', '.js' ],
		alias: 
		{
			"common" : path.resolve( __dirname, "./common" ),
			"@aardvarkxr/aardvark-shared" : path.resolve( __dirname, "../packages/aardvark-shared/src/index.ts" ),
			"@aardvarkxr/aardvark-react" : path.resolve( __dirname, "../packages/aardvark-react/src/index.ts" )
		}
	},

};


function createConfig( appName, appTitle, ext )
{
	let config = Object.assign( 
		{
			entry: './' + appName + '/src/' + appName + '_main.' + ext,
		},
		defaults
	);

	let dest = path.resolve( __dirname, '../data/gadgets/' + appName );
	config.output =
	{
		filename: appName + '_bundle.js',
		path: dest,
	}

	config.plugins =
	[
		new HtmlWebpackPlugin(
			{
				hash: true,
				filename: "./index.html",
				template: "./templates/aardvark_gadget.html",
				title: appTitle,
				name: appName,
			}
		),
		new CopyPlugin(
			[
				{ from: './' +appName + '/src/' + appName + '.css', to: appName + '.css' },
				{ from: './' +appName + '/manifest.webmanifest', to: 'manifest.webmanifest' }
			]
			),
  	];

	return config;
}


module.exports = 
[
	createConfig( 'aardvark_master', 'Master App', 'tsx' ),
	createConfig( 'aardvark_monitor', 'Monitor', 'tsx' ),
	createConfig( 'aardvark_renderer', 'Renderer', 'ts' ),
	createConfig( 'default_hands', 'Default Hands', 'tsx' ),
	createConfig( 'test_panel', 'Test Panel', 'tsx' ),
	createConfig( 'gadget_installer', 'Gadget Installer', 'tsx' ),
	createConfig( 'gadget_menu', 'Gadget Menu', 'tsx' ),
	createConfig( 'simple_social', 'Simple Social', 'tsx' ),
	createConfig( 'hand_mirror', 'Hand Mirror', 'tsx' ),
	createConfig( 'control_test', 'Control Tester', 'tsx' ),
	createConfig( 'whiteboard', 'Whiteboard', 'tsx' ),
	{
		target: "node",
		entry: 
		{
			app: ["./server/server.ts" ]
		},
		output:
		{
			path: path.resolve( __dirname, '../data/server' ),
			filename: "server_bundle.js"
		},
		resolve:
		{
			extensions: ['.ts', '.js' ]
		},
		module: 
		{
			rules:
			[
				{ 
					test: /\.tsx?$/,
					use: 'ts-loader',
					exclude: /node_modules/
				},
			]
		},
		node:
		{
			__dirname: false,
			__filename: false,
		},

		// Workaround for ws module trying to require devDependencies
		externals: 
		[ 
			// {
			// 	'express': {commonjs: 'express'}
			// },
			'utf-8-validate', 
			'bufferutil' 
		],

		mode: "development",
		devtool: "inline-source-map",

		plugins:
		[
			new CopyPlugin(
				[
					{ from: './node_modules/node/bin/node.exe', to: 'bin/node.exe' },
				]
				),
	
			],

		resolve:
		{
			modules:[ path.resolve( __dirname, 'node_modules' ) ],
			extensions: [ '.ts', '.tsx', '.js' ],
			alias: 
			{
				"common" : path.resolve( __dirname, "./common" ),
				"@aardvarkxr/aardvark-shared" : path.resolve( __dirname, "../packages/aardvark-shared/src/index.ts" ),
				"@aardvarkxr/aardvark-react" : path.resolve( __dirname, "../packages/aardvark-react/src/index.ts" )
			}
		},	
	},
	{
		target: "node",
		entry: 
		{
			app: ["./avcmd/avcmd.ts" ]
		},
		output:
		{
			path: path.resolve( __dirname, '../data/avcmd' ),
			filename: "avcmd.js"
		},
		resolve:
		{
			extensions: ['.ts', '.js' ]
		},
		module: 
		{
			rules:
			[
				{ 
					test: /\.tsx?$/,
					use: [ 'ts-loader', 'shebang-loader' ],
					exclude: /node_modules/
				},
			]
		},
		node:
		{
			__dirname: false,
			__filename: false,
		},

		mode: "development",
		devtool: "inline-source-map",

		resolve:
		{
			modules:[ path.resolve( __dirname, 'node_modules' ) ],
			extensions: [ '.ts', '.tsx', '.js' ],
			alias: 
			{
				"common" : path.resolve( __dirname, "./common" ),
				"@aardvarkxr/aardvark-cli" : path.resolve( __dirname, "../packages/aardvark-cli/src/avcmd.ts" ),
				"@aardvarkxr/aardvark-shared" : path.resolve( __dirname, "../packages/aardvark-shared/src/index.ts" ),
				"@aardvarkxr/aardvark-react" : path.resolve( __dirname, "../packages/aardvark-react/src/index.ts" )
			}
		},	
	}
];
