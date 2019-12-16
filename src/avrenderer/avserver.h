#pragma once

bool StartServer( HINSTANCE hInstance );
void StopServer();

std::filesystem::path getNodeExePath();
std::filesystem::path getServerJsPath();
std::filesystem::path getAvCmdJsPath();

