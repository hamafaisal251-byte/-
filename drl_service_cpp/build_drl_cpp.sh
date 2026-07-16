#!/bin/bash
set -e

echo "[BUILDER] Starting DRL C++ Environment Setup and Compilation..."

CWD=$(pwd)
TARGET_DIR="${CWD}/drl_service_cpp"
mkdir -p "${TARGET_DIR}"

# 1. Download cpp-httplib header if missing
if [ ! -f "${TARGET_DIR}/httplib.h" ]; then
  echo "[BUILDER] Downloading cpp-httplib single-header..."
  curl -L -o "${TARGET_DIR}/httplib.h" "https://raw.githubusercontent.com/yhirose/cpp-httplib/master/httplib.h"
else
  echo "[BUILDER] cpp-httplib already present."
fi

# 2. Download nlohmann json header if missing
if [ ! -f "${TARGET_DIR}/json.hpp" ]; then
  echo "[BUILDER] Downloading nlohmann/json single-header..."
  curl -L -o "${TARGET_DIR}/json.hpp" "https://github.com/nlohmann/json/releases/download/v3.11.3/json.hpp"
else
  echo "[BUILDER] nlohmann/json already present."
fi

# 3. Download and unpack libtorch if missing
if [ ! -d "${TARGET_DIR}/libtorch" ]; then
  echo "[BUILDER] Downloading LibTorch CPU-only 2.4.0 distribution..."
  LIBTORCH_ZIP="/tmp/libtorch-cpu.zip"
  
  if [ ! -f "${LIBTORCH_ZIP}" ]; then
    curl -L -o "${LIBTORCH_ZIP}" "https://download.pytorch.org/libtorch/cpu/libtorch-cxx11-abi-shared-with-deps-2.4.0%2Bcpu.zip"
  fi
  
  echo "[BUILDER] Unzipping LibTorch to ${TARGET_DIR}..."
  unzip -q "${LIBTORCH_ZIP}" -d "${TARGET_DIR}/tmp_extract"
  mv "${TARGET_DIR}/tmp_extract/libtorch" "${TARGET_DIR}/libtorch"
  rm -rf "${TARGET_DIR}/tmp_extract"
  rm -f "${LIBTORCH_ZIP}"
else
  echo "[BUILDER] LibTorch dependency folder already present."
fi

# 4. Compile the C++ service
echo "[BUILDER] Preparing build directories..."
mkdir -p "${TARGET_DIR}/build"
cd "${TARGET_DIR}/build"

echo "[BUILDER] Running CMake configuration..."
cmake -DCMAKE_PREFIX_PATH="${TARGET_DIR}/libtorch" ..

echo "[BUILDER] Compiling executable..."
make -j$(nproc)

echo "[BUILDER] C++ DRL service compilation completed successfully! Executable located at: ${TARGET_DIR}/build/drl_service"
