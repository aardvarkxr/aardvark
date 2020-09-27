
export enum WebAppManifestResourcePurpose
{
	Badge = "badge",
	Maskable = "maskable",
	Any = "any",
}

export interface ResourceRotation
{
	x?: number;
	y?: number;
	z?: number;
}

export interface WebAppManifestResource
{
	src: string;
	sizes?: string;
	type: string;
	purpose?: WebAppManifestResourcePurpose;
	rotation?: ResourceRotation;
}

export enum WebAppManifestTextDir
{
	Auto = "auto",
	LeftToRight = "ltr",
	RightToLeft = "rtl",
}

export enum WebAppManifestDisplay
{
	Fullscreen = "fullscreen",
	Standalone = "standalone",
	MinimalUI = "minimal-ui",
	Browser = "browser",
}

export enum WebAppManifestOrientation
{
	Any = "any",
	Natural = "natural",
	Landscape = "landscape",
	LandscapePrimary = "landscape-primary",
	LandscapeSecondary = "landscape-secondary",
	Portrait = "portrait",
	PortraitPrimary = "portrait-primary",
	PortraitSecondary = "portrait-secondary",
}

export interface WebManifestRelatedApplication
{
	platform?: string;
	url?: string;
	id?: string;
}

export interface WebAppManifest
{
	name: string;
	background_color?: string;
	categories?: string[];
	description?: string;
	dir?: WebAppManifestTextDir;
	display?: WebAppManifestDisplay;
	iarc_rating_id?: string;
	icons?: WebAppManifestResource[];
	lang?: string;
	orientation?: WebAppManifestOrientation;
	prefer_related_applications?: boolean;
	related_applications?: WebManifestRelatedApplication[];
	scope?: string;
	screenshots?: WebAppManifestResource[];
	short_name?: string;
	start_url?: string;
	theme_color?: string;
}

