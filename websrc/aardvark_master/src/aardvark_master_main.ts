import { Av } from 'common/aardvark'

Av().startGadget( "file:///E:/homedev/aardvark/build/gadgets/default_hand", "/user/hand/right" );
Av().startGadget( "file:///E:/homedev/aardvark/build/gadgets/default_hand", "/user/hand/left" );
Av().startGadget( "file:///E:/homedev/aardvark/build/gadgets/test_panel", "/user/hand/left" );

// Av().startGadget( "file:///E:/homedev/aardvark/build/apps/test_panel/index.html", [ "scenegraph" ] );
// Av().startGadget( "file:///E:/homedev/aardvark/build/apps/default_poker/index.html", [ "scenegraph" ] );
// Av().startGadget( "file:///E:/homedev/aardvark/build/apps/default_grabber/index.html", [ "scenegraph" ] );
