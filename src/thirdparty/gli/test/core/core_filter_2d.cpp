#include <gli/gli.hpp>
#include <glm/gtc/epsilon.hpp>

namespace filter2d
{
	int test()
	{
		int Error = 0;

		gli::vec4 const ColorFill(1.0f, 0.5f, 0.0f, 1.0f);
		gli::vec4 const ColorBorder(0.0f, 0.5f, 1.0f, 1.0f);

		gli::texture2d Texture(gli::FORMAT_RGBA8_UNORM_PACK8, gli::texture2d::extent_type(2, 2), 1);
		Texture.clear(glm::packUnorm<gli::u8>(ColorFill));

		{
			gli::fsampler2D Sampler(Texture, gli::WRAP_CLAMP_TO_EDGE, gli::FILTER_LINEAR, gli::FILTER_LINEAR, ColorBorder);

			gli::vec4 const TexelA = Sampler.texture_lod(gli::vec2(0.5f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelA, ColorFill, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelB = Sampler.texture_lod(gli::vec2(-0.5f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelB, ColorFill, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelC = Sampler.texture_lod(gli::vec2(1.5f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelC, ColorFill, 0.01f)) ? 0 : 1;
		}
		{
			gli::fsampler2D Sampler(Texture, gli::WRAP_CLAMP_TO_BORDER, gli::FILTER_LINEAR, gli::FILTER_LINEAR, ColorBorder);

			gli::vec4 const TexelA = Sampler.texture_lod(gli::vec2(0.5f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelA, ColorFill, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelB = Sampler.texture_lod(gli::vec2(-1.0f, -1.0f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelB, ColorBorder, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelC = Sampler.texture_lod(gli::vec2(+2.0f, +2.0f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelC, ColorBorder, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelD = Sampler.texture_lod(gli::vec2(+2.0f, -1.0f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelD, ColorBorder, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelE = Sampler.texture_lod(gli::vec2(-1.0f, +2.0f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelE, ColorBorder, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelF = Sampler.texture_lod(gli::vec2(-0.5f,+0.5f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelF, (ColorFill + ColorBorder) * 0.5f, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelG = Sampler.texture_lod(gli::vec2(+0.5f,+1.5f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelG, (ColorFill + ColorBorder) * 0.5f, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelH = Sampler.texture_lod(gli::vec2(+0.5f,-0.5f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelH, (ColorFill + ColorBorder) * 0.5f, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelI = Sampler.texture_lod(gli::vec2(1.5f, 0.5f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelI, (ColorFill + ColorBorder) * 0.5f, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelJ = Sampler.texture_lod(gli::vec2(+0.0f,+0.5f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelJ, ColorFill, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelK = Sampler.texture_lod(gli::vec2(+0.5f,+1.0f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelK, ColorFill, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelL = Sampler.texture_lod(gli::vec2(+0.5f,-0.0f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelL, ColorFill, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelM = Sampler.texture_lod(gli::vec2(1.0f, 0.5f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelM, ColorFill, 0.01f)) ? 0 : 1;
		}
		{
			gli::fsampler2D Sampler(Texture, gli::WRAP_CLAMP_TO_EDGE, gli::FILTER_NEAREST, gli::FILTER_NEAREST, ColorBorder);
			gli::vec4 const TexelA = Sampler.texture_lod(gli::vec2(0.5f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelA, ColorFill, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelB = Sampler.texture_lod(gli::vec2(-0.5f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelB, ColorFill, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelC = Sampler.texture_lod(gli::vec2(1.5f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelC, ColorFill, 0.01f)) ? 0 : 1;
		}
		{
			gli::fsampler2D Sampler(Texture, gli::WRAP_CLAMP_TO_BORDER, gli::FILTER_NEAREST, gli::FILTER_NEAREST, ColorBorder);

			gli::vec4 const TexelA = Sampler.texture_lod(gli::vec2(0.5f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelA, ColorFill, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelB = Sampler.texture_lod(gli::vec2(-0.5f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelB, ColorBorder, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelC = Sampler.texture_lod(gli::vec2(1.5f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelC, ColorBorder, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelD = Sampler.texture_lod(gli::vec2(+0.5f,-0.5f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelD, ColorBorder, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelE = Sampler.texture_lod(gli::vec2(+0.5f, 1.5f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelE, ColorBorder, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelF = Sampler.texture_lod(gli::vec2(-0.5f, 0.5f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelF, ColorBorder, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelG = Sampler.texture_lod(gli::vec2(+1.5f, 0.5f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelG, ColorBorder, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelH = Sampler.texture_lod(gli::vec2(+0.5f,+0.0f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelH, ColorFill, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelI = Sampler.texture_lod(gli::vec2(+0.5f,+1.0f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelI, ColorFill, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelJ = Sampler.texture_lod(gli::vec2(+0.0f,+0.5f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelJ, ColorFill, 0.01f)) ? 0 : 1;

			gli::vec4 const TexelK = Sampler.texture_lod(gli::vec2(+1.0f,+0.5f), 0.0f);
			Error += gli::all(gli::epsilonEqual(TexelK, ColorFill, 0.01f)) ? 0 : 1;
		}

		return Error;
	}
}//namespace filter2d

int main()
{
	int Error(0);

	Error += filter2d::test();

	return Error;
}

