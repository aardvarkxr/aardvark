#version 450

layout (location = 0) in vec3 inPos;
layout (location = 1) in vec3 inNormal;
layout (location = 2) in vec2 inUV0;
layout (location = 3) in vec2 inUV1;
layout (location = 4) in vec4 inJoint0;
layout (location = 5) in vec4 inWeight0;

layout (set = 0, binding = 0) uniform UBO 
{
	mat4 projection;
	mat4 matHmdFromStage;
	mat4 matEyeFromHmd;
	vec3 camPos;
} ubo;

#define MAX_NUM_JOINTS 128

layout (set = 2, binding = 0) uniform UBONode {
	mat4 matStageFromNode;
	mat4 jointMatrix[MAX_NUM_JOINTS];
	float jointCount;
} node;

layout (location = 0) out vec3 outWorldPos;
layout (location = 1) out vec3 outNormal;
layout (location = 2) out vec2 outUV0;
layout (location = 3) out vec2 outUV1;

out gl_PerVertex
{
	vec4 gl_Position;
};

layout ( push_constant ) uniform VertConstants {
	layout (offset = 112 ) vec4 uvScaleAndOffset;
} vertConstants;

void main() 
{
	vec4 locPos;
	if (node.jointCount > 0.0) {
		// Mesh is skinned
		mat4 skinMat = 
			inWeight0.x * node.jointMatrix[int(inJoint0.x)] +
			inWeight0.y * node.jointMatrix[int(inJoint0.y)] +
			inWeight0.z * node.jointMatrix[int(inJoint0.z)] +
			inWeight0.w * node.jointMatrix[int(inJoint0.w)];

		locPos = node.matStageFromNode * skinMat * vec4(inPos, 1.0);
		outNormal = normalize( mat3( node.matStageFromNode * skinMat ) * inNormal );
	} else {
		locPos = node.matStageFromNode * vec4(inPos, 1.0);
		outNormal = normalize( mat3( node.matStageFromNode ) * inNormal );
	}
	outWorldPos = locPos.xyz / locPos.w;

	outUV0 = inUV0.xy * vertConstants.uvScaleAndOffset.xy + vertConstants.uvScaleAndOffset.zw;
	outUV1 = inUV1.xy * vertConstants.uvScaleAndOffset.xy + vertConstants.uvScaleAndOffset.zw;
	vec4 invertYPos = ubo.matHmdFromStage * locPos;
	invertYPos.y = -invertYPos.y;
	gl_Position =  ubo.projection * ubo.matEyeFromHmd * invertYPos;
}
