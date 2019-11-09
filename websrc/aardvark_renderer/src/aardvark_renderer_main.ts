import { Av } from '@aardvarkxr/aardvark-react'
import { AvDefaultTraverser } from './aardvark_traverser';

console.log( "I'm a renderer!" );

let traverser = new AvDefaultTraverser();

Av().renderer.registerTraverser( traverser.traverse );

