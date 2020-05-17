import { AvGrabButton, AvPanel, AvPanelAnchor, AvStandardGrabbable, AvTransform, AvModel } from '@aardvarkxr/aardvark-react';
import { g_builtinModelAardvark, g_builtinModelPlus } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as React from 'react';
import * as ReactDOM from 'react-dom';



interface ControlTestState
{
	buttonClicked: boolean;
}


class ControlTest extends React.Component< {}, ControlTestState >
{
	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
			buttonClicked: false,
		};
	}

	@bind 
	private onButtonClicked()
	{
		this.setState( { buttonClicked: true } );
	}

	@bind 
	private onButtonReleased()
	{
		this.setState( { buttonClicked: false } );
	}

	public render()
	{
		return (
			<div className="FullPage" >
				<AvStandardGrabbable modelUri={ g_builtinModelAardvark }
					modelColor="lightblue" useInitialParent={ true } remoteInterfaceLocks={ [] } >

					<AvTransform translateY={ 0.12 }>
						<AvPanel interactive={ false } widthInMeters={ 0.2 } >
							<div className="ControlList">
								<div className="ButtonContainer">
									<div className="ButtonLabel">{ this.state.buttonClicked ? "CLICKED" : "not clicked" }</div>
									<div className="ButtonControl">
										<AvPanelAnchor>
											<AvGrabButton onClick={ this.onButtonClicked } onRelease={ this.onButtonReleased }
												radius={ 0.05 } >
												<AvTransform uniformScale={ 5 } rotateZ={ 90 } rotateY={ 90 } >
													<AvModel uri={ g_builtinModelPlus }/>
												</AvTransform>
											</AvGrabButton>
										</AvPanelAnchor>
									</div>
								</div>

							</div>
						</AvPanel>
					</AvTransform>
				</AvStandardGrabbable>
			</div>
		)
	}
}

ReactDOM.render( <ControlTest/>, document.getElementById( "root" ) );
