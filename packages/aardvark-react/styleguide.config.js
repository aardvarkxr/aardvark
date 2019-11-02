let path = require( 'path' );

module.exports =
{
	styleguideDir: path.resolve( __dirname, "../../docs/aardvark-react" ),
	components: 'src/**/*.tsx',
	ignore: [ 'src/aardvark_base_node.tsx' ],
	propsParser: require('react-docgen-typescript').withDefaultConfig({}).parse,
	webpackConfig: {
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
	}
	
}