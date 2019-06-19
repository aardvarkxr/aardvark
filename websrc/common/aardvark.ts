declare global
{
	interface Window
	{
		aardvark: any;
	}
}

export interface PokerProximity
{
	panelId: string;
	x: number;
	y: number;
	distance: number;
}

export function Av()
{
	return window.aardvark as any;
}
