import { Av } from '@aardvarkxr/aardvark-shared';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { AvGadget } from './aardvark_gadget';
import { DefaultLanding } from './default_landing_page';


/** Uses ReactDOM to render the appropriate main component. If The gadget is running in Aardvark,
 * this function will wait for it to connect to the local Aardvark server and then render gadgetMain.
 * If the gadget is running in another browser this function will render browserMain.
 * 
 * @param element the element to render on or the ID of an element
 * @param gadgetMain The React component to render when running in Aardvark.
 * @param browserMain The React component to render when running in another browser. If this is undefined
 * 						an instance of DefaultLanding will be rendered.
 */
export async function renderAardvarkRoot( element: HTMLElement | string, 
	gadgetMain: JSX.Element | ( () => JSX.Element ), browserMain?: JSX.Element | ( () => JSX.Element ) )
{
	if( typeof element == "string" )
	{
		element = document.getElementById( element );
	}

	let main: JSX.Element;
	if( !Av() )
	{
		if( !browserMain )
		{
			browserMain = <DefaultLanding/>;
		}	
		else if( typeof browserMain == "function" )
		{
			browserMain = browserMain();
		}

		main = browserMain;
	}
	else
	{
		await AvGadget.instance().waitForConnect();

		if( typeof gadgetMain == "function" )
		{
			gadgetMain = gadgetMain();
		}
		main = gadgetMain;
	}

	ReactDOM.render( main, element );
}

