import { Av } from '@aardvarkxr/aardvark-shared'
import { AvDefaultTraverser } from './aardvark_traverser';

let traverser = new AvDefaultTraverser();

Av().renderer.registerTraverser( traverser.traverse );

// Always draw some hands
Av().startGadget( 
	{
		uri: "http://localhost:23842/gadgets/default_hands", 
		initialInterfaces: "", 
	} );

// Always start the gadget menu
Av().startGadget( 
	{
		uri: "http://localhost:23842/gadgets/gadget_menu", 
		initialInterfaces: "", 
	} );

