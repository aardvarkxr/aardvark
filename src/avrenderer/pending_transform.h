#pragma once

#define GLM_FORCE_RADIANS
#define GLM_FORCE_DEPTH_ZERO_TO_ONE
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>

#include <functional>

class CPendingTransform
{
public:
	CPendingTransform( CPendingTransform *parent, const glm::mat4 & parentFromNode,
		std::function<void (const glm::mat4 & universeFromNode )> applyFunction );
	CPendingTransform();

	void update( CPendingTransform *parent, const glm::mat4 & parentFromNode, 
		std::function<void( const glm::mat4 & universeFromNode )> applyFunction );

	void resolve();

	const glm::mat4 & getUniverseFromNode() const { return m_universeFromNode; }
	bool needsUpdate() const { return m_needsUpdate; }
protected:

	glm::mat4 m_parentFromNode;
	glm::mat4 m_universeFromNode;
	CPendingTransform *m_parent = nullptr;
	std::function<void( const glm::mat4 & universeFromNode )> m_applyFunction;
	bool m_resolved = false;
	bool m_needsUpdate = true;
};