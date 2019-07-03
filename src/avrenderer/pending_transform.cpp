#include "pending_transform.h"

CPendingTransform::CPendingTransform( CPendingTransform *parent, const glm::mat4 & parentFromNode,
	std::function<void( const glm::mat4 & universeFromNode )> applyFunction )
{
	m_parentFromNode = parentFromNode;
	m_parent = parent;
	m_applyFunction = applyFunction;
	m_needsUpdate = false;
}


CPendingTransform::CPendingTransform()
{
	m_needsUpdate = true;
}

void CPendingTransform::update( CPendingTransform *parent, const glm::mat4 & parentFromNode,
	std::function<void( const glm::mat4 & universeFromNode )> applyFunction )
{
	assert( m_needsUpdate );
	m_needsUpdate = false;
	m_parent = parent;
	m_parentFromNode = parentFromNode;
	m_applyFunction = applyFunction;
}


void CPendingTransform::resolve()
{
	if ( m_resolved )
	{
		return;
	}

	assert( !m_needsUpdate );
	if ( m_needsUpdate )
	{
		// we were never set up. This transform isn't going
		// to blow up the math, but is totally invalid.
		m_parentFromNode = glm::mat4( 1.0f );
	}

	if ( m_parent )
	{
		if ( !m_parent->m_resolved )
		{
			m_parent->resolve();
		}

		m_universeFromNode = m_parent->m_universeFromNode * m_parentFromNode;
	}
	else
	{
		m_universeFromNode = m_parentFromNode;
	}
	m_resolved = true;

	if ( m_applyFunction )
	{
		m_applyFunction( m_universeFromNode );
	}
}


