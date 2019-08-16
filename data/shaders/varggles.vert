#version 450
#extension GL_KHR_vulkan_glsl : enable
layout (location = 0) out vec2 uv;

out gl_PerVertex
{
    vec4 gl_Position;
};

void main()
{
	// Takes NDC (0,0 center, y down, x right, z forward) space and converts into UV space
    uv = vec2((gl_VertexIndex << 1) & 2, gl_VertexIndex & 2);
    gl_Position = vec4(uv * 2.0f + -1.0f, 0.0f, 1.0f);
}