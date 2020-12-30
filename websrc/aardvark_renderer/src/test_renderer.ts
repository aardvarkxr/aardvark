import { AvRenderer, AvTraversalRenderer, AvModelInstance, AABB, AvHapticProcessor, EHand, AvActionState, AvSharedTextureInfo, AvColor, JointTransform, JointInfo } from "@aardvarkxr/aardvark-shared";
import { mat4, vec4 } from '@tlaukkan/tsm';


export class CTestModel implements AvModelInstance
{
	public url: string;
	public universeFromModel: mat4 = null;
	public color: AvColor = null;
	public overlayOnly: boolean = null;
	public overrideTexture: AvSharedTextureInfo = null;
	public animationSource: string = null;
	public animationUri: string = null;
	public animationBase64: string = null;

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
		this.color = 
		{
			r: color[0],
			g: color[1],
			b: color[2],
		};

		if( color[3] != 1.0 )
		{
			this.color.a = color[3];
		}
	}

	public setOverlayOnly( overlayOnly: boolean ): void
	{
		this.overlayOnly = overlayOnly;
	}

	public setAnimationSource( animationSource: string ): void
	{
		this.animationSource = animationSource;
	}

	public setAnimation( uri: string, base64: string ): void
	{
		this.animationUri = uri;
		this.animationBase64 = base64;
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

	public createModelInstance( modelUrl: string, modelDataBase64: string ): AvModelInstance
	{
		let model = new CTestModel( modelUrl );
		this.models.push( model );
		return model;
	}

	public getUniverseFromOriginTransform( origin: string ): number[]
	{
		return mat4.identity.all();
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

	public getSkeletonTransforms( skeletonPath: string ): JointTransform[] | null { return null; }
	public getSkeletonInfo( skeletonPath: string ): JointInfo[] | null { return null; }
}

