#include "aardvark/aardvark_transform.h"

namespace aardvark
{

class CTransform : public ITransform
{
	friend CTransformManager;
public:
	virtual void setNullTransform( uint64_t parentId ) override;
	virtual void setOriginTransform( const std::string & originPath ) override;

	virtual void setParentFromThisMatrix( const glm::mat4 & parentFromTransform ) override;
	virtual void setParentFromThisTRS( const glm::vec3 & translation, const glm::vec3 & scale, const glm::quat & rot ) override;

	virtual void setTransitionTime( float time ) override;

private:
	enum class Type
	{
		Null,
		Origin,
		Matrix,
		TRS,
	};

	Type m_type = Type::Null;
	uint64_t m_parentId = 0;
	std::string m_origin;
	glm::mat4 m_parentFromThis = glm::mat4( 1.f );
	glm::vec3 m_translation = { 0, 0, 0 };
	glm::vec3 m_scale = { 1.f, 1.f, 1.f };
	glm::quat m_rotation = { 1.f, 0, 0, 0 };
};


void CTransform::setNullTransform( uint64_t parentId )
{
	m_type = Type::Null;
	m_parentId = parentId;
}

void CTransform::setOriginTransform( const std::string & originPath )
{
	m_type = Type::Origin;
	m_origin = originPath;
}

void CTransform::setParentFromThisMatrix( const glm::mat4 & parentFromTransform )
{
	m_type = Type::Matrix;
	m_parentFromThis = parentFromTransform;
}

void CTransform::setParentFromThisTRS( const glm::vec3 & translation, const glm::vec3 & scale,
	const glm::quat & rot )
{
	m_type = Type::TRS;
	m_translation = translation;
	m_scale = scale;
	m_rotation = rot;
}


void CTransform::setTransitionTime( float time )
{
	// animation is NYI
}




} // namespace aardvark
