import { Av } from '@aardvarkxr/aardvark-shared'
import { AvDefaultTraverser } from './aardvark_traverser';

let traverser = new AvDefaultTraverser();

Av().renderer.registerTraverser( traverser.traverse );

