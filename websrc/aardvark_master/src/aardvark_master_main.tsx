import * as React from 'react';
import  * as ReactDOM from 'react-dom';
import bind from 'bind-decorator';
import { Av, Permission } from '@aardvarkxr/aardvark-shared'
import { CMasterModel } from './master_model';
import { Chamber } from './remote_universe';

class MasterControls extends React.Component< {}, {} >
{
	private model: CMasterModel;

	constructor( props: any )
	{
		super( props );

		if( Av().hasPermission( Permission.Master ) )
		{
			this.model = new CMasterModel( this.onChambersUpdated );
		}
	}

	@bind
	private onChambersUpdated()
	{
		console.log( "onChambersUpdated()" );
		this.forceUpdate();
	}

	public render()
	{
		console.log( `render with ${ this.model.activeChambers.length } chambers in the list` );
		
		let chambers: JSX.Element[] = [];
		for( let chamber of this.model.activeChambers)
		{
			chambers.push( Chamber( { chamber } ) );
		}	

		return (
			<>
				{ chambers }
			</>
		);
	}
}

ReactDOM.render( <MasterControls/>, document.getElementById( "root" ) );

// always start the renderer
Av().startGadget( "http://localhost:23842/gadgets/aardvark_renderer", "", "", null );

// Always draw some hands
Av().startGadget( "http://localhost:23842/gadgets/default_hands", "", "hands", null );


