let path = require( 'path' );

module.exports = 
{
	entry: 
	{
		'index': "./src/index.ts"
	},
	output:
	{
		path: path.resolve( __dirname, 'lib' ),
		filename: "[name].js",
		globalObject: 'this',
		libraryTarget: 'umd',
		library: 'aardvark-shared',
		umdNamedDefine: true
	},
	resolve:
	{
		extensions: ['.ts', '.tsx', '.js' ]
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

	target: "node",

};
