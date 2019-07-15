import { Av } from 'common/aardvark'
import { AvDefaultTraverser } from 'common/aardvark_traverser';

console.log( "I'm a renderer!" );

let traverser = new AvDefaultTraverser();

Av().renderer.registerSceneProcessor( traverser.newSceneGraph );
Av().renderer.registerTraverser( traverser.traverse );
Av().renderer.registerHapticProcessor( traverser.sendHapticEventForNode );
Av().renderer.registerGrabStartProcessor( traverser.startGrab );
Av().renderer.registerGrabEndProcessor( traverser.endGrab );

