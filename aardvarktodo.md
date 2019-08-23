# varggles

## Todo

- render target
    vargglesRT [x]
- image descriptor
  - ds varggles [x]
- pipeline
  - create descriptor set layout for varggle sin m_descriptormanager [x]
  - varggles [x]
- shadermodule
  - vert [x]
  - frag [x]
- shader values
  - shaderValuesVarggles [x]
  - ubf varggles [x]
- renderpass
  - varggles [x]
- command buffer
  - varggles [x]
- rendering
  - varggles [x]
- get texture size
- shaders
  - grokk vert shader
  - grokk frag shader
  - grokk mary poppins rot
  - frag translation
  - vert translation
  - get buffers / sets translated
  - generate spv
  - get compiling
- presentation (jared pair)
  - ??

## Relevant render functions

### over all rendering

- init [x]
- processRenderList [x]
- runFrame [x]

### initialization

- prepare [x]
- prepareUniformBuffers [x]
- setupDescriptors [x]
- setupDescriptorSetsforModel [x]
- preparePipelines [x]

### recording

- recordCommandBuffer [x]

### synchronization

- updateDescriptorForScene [x]
- updateUniformBUffers [x]
- updateParams [x]

## mary popins rot

- inverse of object rotation * y rotation

## vertex shader

- position = ndc
- uv = xy
uv 0,0 = low left
uv 1,1 = high right
- xy = float2(PI, PI/2) * (2.0 * v.uv - 1.0);
    - so float2(pi, pi/2) * (-1 -> 1, -1 -> 1)
    - or xy = ([-pi, pi], [-pi/2, pi/2])

mult y by 2 to get back to a range of 0-pi (-1, 1)? questionable
or xy = ([-pi, pi], [-pi, pi])
- if on top half
    y -= PI_HALF
    xy = ([-pi, pi], [-1.5pi, 0.5pi])
- if on bot half
    += PI_HALF
    xy = ([-pi, pi], [-0.5pi, 1.5pi])
    y is now 0.5 pi - > 1.5p

shifting vertical by 1/4 cycle


// creating vector shooting out into sphere
v = (sin(xy.x), 1.0, cos(xy.x)) * (cos(xy.y), sin(xy.y), cos(xy.y))

// account for fov relative to nined
mult = tan(_FOV) / tan(pi/4)



uv to sample = (v.x / |v.z| / mult + 1) / 2
same for y...

left on the top
right on the bot

color alpha is 1/2.2