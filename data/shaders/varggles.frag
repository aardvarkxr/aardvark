#version 450
#extension GL_KHR_vulkan_glsl : enable

layout (location = 0) in vec2 uv;

layout (set = 0, binding = 0) uniform sampler2D eyeLeft;
layout (set = 0, binding = 1) uniform sampler2D eyeRight;

layout (location = 0) out vec4 outColor;

layout (push_constant) uniform Varggles {
	mat4 lookRotation;
	mat4 hackRotation;
	float halfFOVInRadians;
} varggles;

float PI = 3.141592;
float HALF_PI = 0.5 * PI;
float QUARTER_PI = 0.25 * PI;

void main() {
	// convert UV (0,0 upper right) (1, 1 lower left) to XY (0,0 lower left) (1, 1 upper right)
	vec2 xy = vec2(uv.x, 1 - uv.y);

	// convert to -1, -1 lower left, 1, 1 upper right
	xy = vec2(2.0 * xy - 1.0);

	// (-pi, -pi_half) lower left, (pi, pi_half) upper right
	xy *= vec2(PI, HALF_PI);

	// Convert from one equirect to 2 stacked equirects (left on top of right eye)
	// scaling by two ([-.5, .5 pi] to [-pi. pi]) 
	xy.y *= 2;

	// then subtractingin half pi  for top, adding pi back for bot
	bool isTop = xy.y >= 0;
	if (isTop) {
		//[-PI_HALF, PI_HALF] 
		xy.y -= HALF_PI;
	} else {
		// [-PI_HALF, PI_HALF]
		xy.y += HALF_PI;
	}

	// current coordinate space is left eye on top, right eye on bottom
	// both eyes go from -pi -> pi left to right and -pi/2 -> pi/2 bottom to top

	// Get scalar for modifying projection from cubemap (90 fov) to eye target fov
	float fovScalar = tan(varggles.halfFOVInRadians) / tan(QUARTER_PI);

	// create vector looking out at equirect CubeMap
	vec3 cubeMapLookupDirection = vec3(sin(xy.x), 1.0, cos(xy.x)) * vec3(cos(xy.y), sin(xy.y), cos(xy.y));

	// rotate look direction by inverse of horizontal stageSpace look vector.
	// this is a trick to prevent a full cube map render of the scene, the only valid
	// equirectangular projections will be near wahtever is treated as forward and backward traditionally
	cubeMapLookupDirection = (varggles.lookRotation * vec4(cubeMapLookupDirection, 0)).xyz;

	// project the vector onto the 2d texture
	// this will be wrong everywhere that is not near the rotated forward plane of the cubeMap
	// U = ((X/|Z|) + 1) / 2
	// V = ((Y/|Z|) + 1) / 2
	// always project the +Z axis of a cube map
	// X/|Z|, -Y/|Z| places uv coords in -1, 1. + 1 / 2 shifts to 0 -> 1
	// fovScalar scales U/V from 90 degrees into eye fov that was rendered with.
	float projectLookOntoUAxis = ((cubeMapLookupDirection.x / abs(cubeMapLookupDirection.z) / fovScalar) + 1) / 2;
	float projectLookOntoVAxis = 1 - (((cubeMapLookupDirection.y / abs(cubeMapLookupDirection.z) / fovScalar) + 1) / 2);

	vec2 eyeUV = vec2(projectLookOntoUAxis, projectLookOntoVAxis);

	// copy color from the right eye texture
	if (isTop) {
		outColor = texture(eyeLeft, eyeUV);
	} else {
		outColor = texture(eyeRight, eyeUV);
	}

	// TODO PlutoVR: Fix alpha rendering in main renderer and remove this hack
	//outColor.a = 1.0 - outColor.a;

	//outColor.rgb = cubeMapLookupDirection.xyz;
	//outColor.a = 1.0;
	//outColor.b = 0.0;
	//outColor.rg = eyeUV.xy;
}