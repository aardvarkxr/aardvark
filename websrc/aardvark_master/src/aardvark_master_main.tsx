import * as React from 'react';
import  * as ReactDOM from 'react-dom';
import bind from 'bind-decorator';
import { Av, Permission } from '@aardvarkxr/aardvark-shared'
import { AvOrigin } from '../../../packages/aardvark-react/src/aardvark_origin';

class MasterControls extends React.Component< {}, {} >
{
	constructor( props: any )
	{
		super( props );
	}

	public render()
	{
		return (
			<>
				<AvOrigin path="/space/stage"/>
			</>
		);
	}
}

ReactDOM.render( <MasterControls/>, document.getElementById( "root" ) );

// always start the renderer
Av().startGadget( 
	{ 
		uri: "http://localhost:23842/gadgets/aardvark_renderer", 
		initialHook: "", 
		persistenceUuid: "",
	} );

// Always draw some hands
Av().startGadget( 
	{
		uri: "http://localhost:23842/gadgets/default_hands", 
		initialHook: "", 
		persistenceUuid: "hands",
	} );


