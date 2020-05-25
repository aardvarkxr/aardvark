import { AvRenderer, AvTraversalRenderer, AvModelInstance, AABB, AvHapticProcessor, EHand, AvActionState, AvSharedTextureInfo } from "@aardvarkxr/aardvark-shared";
import { mat4, vec4 } from '@tlaukkan/tsm';


export class CTestModel implements AvModelInstance
{
	public url: string;
	public universeFromModel: mat4 = null;
	public color: vec4 = null;
	public overrideTexture: AvSharedTextureInfo = null;

	constructor( url: string )
	{
		this.url = url;
	}

	public setUniverseFromModelTransform(universeFromModel: number[] )
	{
		this.universeFromModel = new mat4( universeFromModel );
	}

	public setOverrideTexture( textureInfo: AvSharedTextureInfo)
	{
		this.overrideTexture = textureInfo;
	}

	public setBaseColor( color: [ number, number, number, number ] ): void
	{
		this.color = new vec4( color );
	}
}


export class CTestRenderer implements AvRenderer
{
	public models: CTestModel[] = [];

	public lastRenderList: AvModelInstance[] = null;

	public lastModel( n: number )
	{
		if( n < 0 || n >= this.lastRenderList.length )
			return undefined;
		else
			return this.lastRenderList[ n ] as CTestModel;
	}
	
	public setRendererConfig( rendererConfig: string ): void
	{
		throw new Error( "Not supported on test renderer" );
	}

	public registerTraverser( traverser: AvTraversalRenderer ): void
	{
		throw new Error( "Not supported on test renderer" );
	}

	public renderList( renderList: AvModelInstance[] ): void
	{
		this.lastRenderList = renderList;
	}

	public createModelInstance( uri: string): AvModelInstance
	{
		let model = new CTestModel( uri );
		this.models.push( model );
		return model;
	}

	public getUniverseFromOriginTransform( origin: string ): number[]
	{
		return mat4.identity.all();
	}

	public getAABBForModel( uri: string ): AABB
	{
		return { 
			xMin: -1, xMax: 1,
			yMin: -1, yMax: 1,
			zMin: -1, zMax: 1,
		};
	}

	public registerHapticProcessor( hapticProcessor: AvHapticProcessor ) : void
	{
		throw new Error( "Not supported on test renderer" );
	}

	public sendHapticEventForHand( hand: EHand, amplitude: number, frequency: number, duration: number ): void
	{

	}

	public getActionState( hand: EHand ): AvActionState
	{
		let state =
		{
			a: false,
			b: false,
			grab: false,
			squeeze: false,
			detach: false,
		}
		return state;
	}
}

