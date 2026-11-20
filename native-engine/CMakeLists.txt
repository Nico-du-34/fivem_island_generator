cmake_minimum_required(VERSION 3.24)
project(island_forge_native_engine VERSION 0.1.0 LANGUAGES C CXX)

include(FetchContent)
set(RAGEKIT_BUILD_CLI OFF CACHE BOOL "" FORCE)
set(RAGEKIT_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(RAGEKIT_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(RAGEKIT_BUILD_RENDER OFF CACHE BOOL "" FORCE)

FetchContent_Declare(
  ragekit
  GIT_REPOSITORY https://github.com/RatPrez/ragekit.git
  GIT_TAG v0.3.1
  GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(ragekit)

add_executable(island-forge-native-engine src/main.cpp)
target_compile_features(island-forge-native-engine PRIVATE cxx_std_20)
target_link_libraries(island-forge-native-engine PRIVATE ragekit::ragekit)
if(MSVC)
  target_compile_options(island-forge-native-engine PRIVATE /W4 /permissive-)
else()
  target_compile_options(island-forge-native-engine PRIVATE -Wall -Wextra -Wpedantic)
endif()

install(TARGETS island-forge-native-engine RUNTIME DESTINATION .)
