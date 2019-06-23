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
		extensions: [ '.ts', '.tsx', '.js' ],
		alias: 
		{
			"common" : path.resolve( __dirname, "./common" )
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

	let dest = path.resolve( __dirname, '../build/apps/' + appName );
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
				template: "./templates/aardvark_app.html",
				title: appTitle,
				name: appName,
			}
		),
		new CopyPlugin(
			[
				{ from: './' +appName + '/src/' + appName + '.css', to: appName + '.css' }
			]
			),
  	];

	return config;
}


module.exports = 
[
	createConfig( 'aardvark_master', 'Master App', 'ts' ),
	createConfig( 'default_poker', 'Default Poker', 'tsx' ),
	createConfig( 'test_panel', 'Test Panel', 'tsx' ),
];
