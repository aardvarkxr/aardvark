import * as React from 'react';
import  * as ReactDOM from 'react-dom';

import { ShowGrabbableChildren, AvStandardGrabbable, AvMirror, AvOrigin, AvTransform } from '@aardvarkxr/aardvark-react';
import { g_builtinModelHandMirror } from '@aardvarkxr/aardvark-shared';

function HandMirror()
{
	return <AvStandardGrabbable modelUri={ g_builtinModelHandMirror } 
				showChildren= { ShowGrabbableChildren.OnlyWhenGrabbed } >
					<AvOrigin path="/space/stage">
						<AvTransform rotateY={ 180 }>
							<AvMirror/>
						</AvTransform>
					</AvOrigin>
			</AvStandardGrabbable>;
}


ReactDOM.render( <HandMirror/>, document.getElementById( "root" ) );
