cmake_minimum_required(VERSION 3.12 FATAL_ERROR)
project(drl_service_cpp)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Configure path to LibTorch if placed locally
if(NOT DEFINED CMAKE_PREFIX_PATH)
  set(CMAKE_PREFIX_PATH "${CMAKE_CURRENT_SOURCE_DIR}/libtorch")
endif()

find_package(Torch REQUIRED)
find_package(Threads REQUIRED)

add_executable(drl_service main.cpp)
target_link_libraries(drl_service "${TORCH_LIBRARIES}" Threads::Threads)

set_property(TARGET drl_service PROPERTY CXX_STANDARD 17)
