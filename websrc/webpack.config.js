const path = require('path');
var HtmlWebpackPlugin = require( 'html-webpack-plugin' );

module.exports = 
{
	mode: "development",
	entry: './default_poker/src/default_poker_main.ts',

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

	plugins:
	[
		new HtmlWebpackPlugin(
			{
				hash: true,
				filename: "./index.html",
				template: "./templates/aardvark_app.html",
				title: "Default Poker"
			}
		)
	],

	resolve:
	{
		extensions: [ '.ts', '.tsx', '.js' ],
		alias: 
		{
			"common" : "./common"
		}
	},

	output: 
	{
		filename: 'bundle.js',
		path: path.resolve(__dirname, 'dist/default_poker')
	}
};