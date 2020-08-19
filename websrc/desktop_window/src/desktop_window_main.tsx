import { AvGadget, AvPanel, AvStandardGrabbable, AvTransform, HighlightType, DefaultLanding, AvModel } from '@aardvarkxr/aardvark-react';
import { EAction, EHand, g_builtinModelBox, InitialInterfaceLock, Av, WindowInfo, g_builtinModelPanel } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { initSentryForBrowser } from 'common/sentry_utils';

initSentryForBrowser();

const k_DesktopWindowInterface = "aardvark-desktop-window@1";

interface DesktopWindowState
{
	windowHandle: string;
	windowInfo?: WindowInfo;
}


class DesktopWindow extends React.Component< {}, DesktopWindowState >
{
	private m_grabbableRef = React.createRef<AvStandardGrabbable>();

	constructor( props: any )
	{
		super( props );

		let window = AvGadget.instance().findInitialInterface( k_DesktopWindowInterface )?.params as WindowInfo;
		this.state = 
		{ 
			windowHandle: window.handle,
		};
	}

	public componentDidMount()
	{
		Av().subscribeWindow( this.state.windowHandle, this.onWindowUpdate );
	}

	public componentWillUnmount()
	{
		Av().unsubscribeWindow( this.state.windowHandle );
	}

	@bind
	private onWindowUpdate( windowInfo: WindowInfo )
	{
		this.setState( { windowInfo } );
	}

	public renderWindow()
	{
		if( !this.state.windowInfo )
		{
			return null;
		}

		const k_windowWidth = 1;
		let texture = this.state.windowInfo.texture;

		let width = k_windowWidth;
		let height = k_windowWidth * texture.height / texture.width;
		if( texture.width < texture.height )
		{
			height = k_windowWidth;
			width = k_windowWidth * texture.width / texture.height;
		}

		return 	<AvTransform scaleX={ width } scaleZ={ height } translateZ={ height / 2 + 0.08 }>
			<AvTransform rotateX={ 180 }>
				<AvModel uri={ g_builtinModelPanel } sharedTexure={ texture }/>
			</AvTransform>
		</AvTransform>;
	}

	public render()
	{
		return (
			<AvStandardGrabbable modelUri={ g_builtinModelBox } modelScale={ 0.03 } 
				modelColor="lightblue" useInitialParent={ true } ref={ this.m_grabbableRef }>
				{ this.renderWindow() }
			</AvStandardGrabbable> );
	}

}

let main = Av() ? <DesktopWindow/> : <DefaultLanding/>;
ReactDOM.render( main, document.getElementById( "root" ) );
