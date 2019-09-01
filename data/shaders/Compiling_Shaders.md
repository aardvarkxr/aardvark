* To compile shaders in this directory *

1. Install the Vulkan SDK from LunarG: https://vulkan.lunarg.com/
2. Make sure that the SDK install directory that includes "glslangValidator.exe" is in your path.
3. Run this command on the shader you want to modify: glslangValidator -V <shadername> -o <shadername>.spv

The steps are the same for both fragment and vertex shaders. Please submit the new SPIR-V binaries for the shaders at the same time you submit the matching source.

