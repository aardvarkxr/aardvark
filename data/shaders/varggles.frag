#version 450
#extension GL_KHR_vulkan_glsl : enable

layout (location = 0) in vec2 uv;

layout (set = 0, binding = 0) uniform sampler2D eyeLeft;
layout (set = 0, binding = 1) uniform sampler2D eyeRight;

layout (location = 0) out vec4 outColor;

layout (push_constant) uniform Varggles {
	float fov;
	mat4 inverseHorizontalLook;
} varggles;

float PI = 3.141592;
float PI_HALF = 0.5 * PI;
float PI_FOURTH = 0.25 * PI;

vec2 convertUVtoXY(vec2 uv);

void main() {
	// convert UV to XY (0,0 lower left) (1, 1 upper right)
	vec2 xy = vec2(uv.x, 1 - uv.y);

	// convert to equirect space
	xy = vec2(2.0 * xy - 1.0) * vec2(PI, PI_HALF);

	// Convert from one equirect to 2 stacked equirects (left on top of right eye)
	// scaling by two ([-.5, .5 pi] to [-pi. pi]) 
	xy.y *= 2;

	// then subtractingin half pi  for top, adding pi back for bot
	bool isTop = xy.y >= 0;
	if (isTop) {
		xy.y -= PI_HALF;
	} else {
		xy.y += PI_HALF;
	}

	// Get scalar for modifying projection from cubemap (90 fov) to eye target fov
	// TODO: Pluto - Fix for horizontal / vertical skew
	float fovScalar = tan(varggles.fov) / tan(PI / 4.0);

	// create vector looking out at equirect CubeMap
	vec3 cubeMapLookupDirection = vec3(sin(xy.x), 1.0, cos(xy.x)) * vec3(cos(xy.y), sin(xy.y), cos(xy.y));

	// rotate look direction by inverse of horizontal stageSpace look vector.
	// this is a trick to prevent a full cube map render of the scene, the only valid
	// equirectangular projections will be near wahtever is treated as forward and backward traditionally
	cubeMapLookupDirection = (varggles.inverseHorizontalLook * vec4(cubeMapLookupDirection, 0)).xyz;

	// project the vector onto the 2d texture
	// this will be wrong everywhere that is not near the rotated forward or backword plane of the cubeMap
	// https://scalibq.wordpress.com/2013/06/23/cubemaps/
	// TODO: Pluto - better comment, dont rely on net

	float projectLookOntoUAxis = ((cubeMapLookupDirection.x / abs(cubeMapLookupDirection.z) / fovScalar) + 1) / 2;
	float projectLookOntoVAxis = 1 - ((cubeMapLookupDirection.y / abs(cubeMapLookupDirection.z) / fovScalar) + 1) / 2;

	vec2 eyeUV = vec2(projectLookOntoUAxis, projectLookOntoVAxis);

	// copy color from the right eye texture
	if (isTop) {
		outColor = texture(eyeLeft, eyeUV);
	} else {
		outColor = texture(eyeRight, eyeUV);
	}
}