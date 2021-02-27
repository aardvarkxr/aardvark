#pragma once

#include <json/json.hpp>
#include <unordered_set>

class CInputManifestActionBinding
{
public:
	std::string interactionProfile;
	std::string inputPath;
};

enum class ActionType
{
	Unknown = -1,
	Boolean = 0,
	Float = 1,
	Vector2 = 2,
};

class CInputManifestAction
{
public:
	std::string name;
	std::string localizedName;
	ActionType type;
	std::vector<CInputManifestActionBinding> bindings;
	uint64_t handle = 0;
};

class CInputManifestActionSet
{
public:
	bool suppressAppBindings;
	uint32_t priority;
	std::string name;
	std::string localizedName;
	std::vector<CInputManifestAction> actions;
	uint64_t handle = 0;
};

class CInputManifest
{
public:
	std::vector<CInputManifestActionSet> m_actionSets;
};

nlohmann::json toInputFiles( const CInputManifest& m );

std::string interactionProfileToControllerType( const std::string& interactionProfile );
std::string controllerTypeToInteractionProfile( const std::string& controllerType );
