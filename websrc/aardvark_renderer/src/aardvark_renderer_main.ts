import { Av } from 'common/aardvark'
import { AvDefaultTraverser } from './aardvark_traverser';

console.log( "I'm a renderer!" );

let traverser = new AvDefaultTraverser();

Av().renderer.registerTraverser( traverser.traverse );

