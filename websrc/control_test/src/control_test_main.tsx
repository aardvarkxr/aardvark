import { AvGrabButton, AvPanel, AvPanelAnchor, AvStandardGrabbable, AvTransform, AvModel, DefaultLanding, GrabbableStyle, AvComposedEntity, MoveableComponent, MoveableComponentState, AvOrigin, AvWeightedTransform, AvPrimitive, PrimitiveType } from '@aardvarkxr/aardvark-react';
import { EVolumeType, g_builtinModelMagnetOpen, g_builtinModelAardvark, g_builtinModelPlus, Av, AvVolume, g_builtinModelHook, g_builtinModelBracelet, g_builtinModelHammerAndWrench, g_builtinModelMagnetClosed, g_builtinModelRoom, g_builtinModelHandLeft, g_builtinModelHandRight } from '@aardvarkxr/aardvark-shared';
import bind from 'bind-decorator';
import * as React from 'react';
import * as ReactDOM from 'react-dom';


enum SpawnerPhase
{
	Idle,
	WaitingForRef,
}

interface VisibleSpawn
{
	uri: string;
	scale: number;
	id: number;
}

interface GrabSpawnerState
{
	phase: SpawnerPhase;
	spawns: VisibleSpawn[];
	newSpawn?: VisibleSpawn;
}

const randomModelList:[ string, number ][] =
[
	[ g_builtinModelBracelet, 0.2 ],
	[ g_builtinModelMagnetClosed, 0.5 ],
	[ g_builtinModelRoom, 0.5 ],
	[ g_builtinModelHandLeft, 0.5 ],
	[ g_builtinModelHandRight, 0.5 ],
];

class GrabSpawner extends React.Component< {}, GrabSpawnerState >
{
	private moveableComponent = new MoveableComponent( this.onMoveableUpdate, false, false );
	private spawner = React.createRef< AvComposedEntity>();
	private nextId = 1;

	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
			phase: SpawnerPhase.Idle,
			spawns: [],
		};
	}

	@bind
	onMoveableUpdate()
	{
		switch( this.moveableComponent.state )
		{
			case MoveableComponentState.Grabbed:
			{
				switch( this.state.phase )
				{
					case SpawnerPhase.Idle:
						const [ uri, scale ] = this.randomModel();
						this.setState(
							{
								phase: SpawnerPhase.WaitingForRef,
								newSpawn: 
								{
									uri,
									scale,
									id: this.nextId++,
								}
							}
						)
						break;

				}
			}
			break;

			case MoveableComponentState.Idle:
			{

			}
			break;

			case MoveableComponentState.GrabberNearby:
			case MoveableComponentState.InContainer:
			case MoveableComponentState.Menu:
				// ignore this state
				break;
		}

	}

	private randomModel()
	{
		return randomModelList[ Math.floor( Math.random() * randomModelList.length ) ];
	}

	@bind
	private onNewSpawn( newSpawn: AvStandardGrabbable )
	{
		if( !newSpawn )
			return;

		this.moveableComponent.triggerRegrab( newSpawn.globalId, {} );
		this.setState( 
			{ 
				phase: SpawnerPhase.Idle,
				spawns: [...this.state.spawns, this.state.newSpawn ], 
				newSpawn: null 
			} );
	}

	private renderSpawn( spawn: VisibleSpawn, ref?: ( node: AvStandardGrabbable ) => void )
	{
		return <AvStandardGrabbable modelUri={ spawn.uri } key={ spawn.id } 
			modelScale={ spawn.scale } style={ GrabbableStyle.LocalItem }
			 ref={ ref }/>

	}
	render()
	{
		let volume: AvVolume =
		{
			type: EVolumeType.ModelBox,
			uri: g_builtinModelHook,
		}

		let spawns: JSX.Element[] = [];
		for( let spawn of this.state.spawns )
		{
			spawns.push( this.renderSpawn( spawn ) );
		}

		if( this.state.newSpawn )
		{
			spawns.push( this.renderSpawn( this.state.newSpawn, this.onNewSpawn ) );
		}

		return <>
			<AvComposedEntity components={ [ this.moveableComponent ] } ref={ this.spawner }
				volume={ volume } debugName="Spawner">
					<AvModel uri={ g_builtinModelHook }/>
			</AvComposedEntity>
			{ spawns }
			</>
	}
}

interface ControlTestState
{
	buttonClicked: boolean;
	showTransforms: boolean;
}


class ControlTest extends React.Component< {}, ControlTestState >
{
	private leftRef = React.createRef<AvOrigin>();
	private rightRef = React.createRef<AvOrigin>();

	constructor( props: any )
	{
		super( props );
		this.state = 
		{ 
			buttonClicked: false,
			showTransforms: false,
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

	@bind
	private toggleShowTransforms()
	{
		this.setState( ( prevState: ControlTestState ) => 
		{ 
			return { showTransforms: !prevState.showTransforms } 
		} );
	}

	public render()
	{
		return (
			<div className="FullPage" >
				<AvStandardGrabbable modelUri={ g_builtinModelAardvark }
					modelColor="lightblue" style={ GrabbableStyle.Gadget } remoteInterfaceLocks={ [] } >

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

					<AvTransform translateY={ 0.15 } rotateX={ 90 }>
						<GrabSpawner/>
					</AvTransform>

					<AvOrigin ref={ this.leftRef } path="/user/hand/left"/>
					<AvOrigin ref={ this.rightRef } path="/user/hand/right"/>
					<AvTransform translateY={ 0.30 } rotateX={ 90 }>
						<AvGrabButton onClick={ this.toggleShowTransforms }
							radius={ 0.05 }>
							<AvTransform uniformScale={ 0.1 }>
								<AvModel uri={ g_builtinModelMagnetOpen }/>
							</AvTransform>
						</AvGrabButton>
					</AvTransform>
					{ 
						this.state.showTransforms && this.leftRef.current && this.rightRef.current &&
						<>
							<AvWeightedTransform weightedParents = {
								[
									{ parent: this.leftRef.current.globalId, weight: 1 },
									{ parent: this.rightRef.current.globalId, weight: 1 }
								]
							}>
								<AvPrimitive type={ PrimitiveType.Sphere } radius={ 0.01 }
									color="blue"/>
							</AvWeightedTransform>
							<AvWeightedTransform weightedParents = {
								[
									{ parent: this.leftRef.current.globalId, weight: 0 },
									{ parent: this.rightRef.current.globalId, weight: 1 }
								]
							}>
								<AvPrimitive type={ PrimitiveType.Cube } 
									width={0.01} height={ 0.02} depth={ 0.03}
									color="red"/>
							</AvWeightedTransform>
							<AvWeightedTransform weightedParents = {
								[
									{ parent: this.leftRef.current.globalId, weight: 0.25 },
									{ parent: this.rightRef.current.globalId, weight: 0.75 }
								]
							}>
								<AvPrimitive type={ PrimitiveType.Cylinder } 
									radius={ 0.01 } height={ 0.02 }
									color="orange"/>
							</AvWeightedTransform>
						</>
					}
				</AvStandardGrabbable>
			</div>
		)
	}
}

let main = Av() ? <ControlTest/> : <DefaultLanding/>;
ReactDOM.render( main, document.getElementById( "root" ) );
