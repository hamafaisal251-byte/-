// ============================================================================
// SOVEREIGN ALGORITHMIC FOREX TRADING SYSTEM: LOW-LATENCY CORE KERNEL
// File: /brain_core.cpp
// Language: C++20 Standard
// Architecture: Direct Market Access (DMA) & FPGA Co-Location, Thread Pinning
// ============================================================================

#include <iostream>
#include <atomic>
#include <chrono>
#include <cmath>
#include <cstring>
#include <algorithm>
#include <pthread.h>
#include <sched.h>
#include <sys/mman.h>
#include <fcntl.h>
#include <unistd.h>

// Direct-to-FPGA MMIO & DMA Constants
constexpr uintptr_t FPGA_BAR0_MMIO_BASE = 0x7FE00000; // Physical base address
constexpr size_t MMIO_SPAN = 0x1000;                   // 4KB memory span page
constexpr int CORE_PIN_AFFINITY_ID = 3;                // CPU Core 3 pinned for execution loop

// Simulated Raw FIX Protocol Message Structure
struct alignas(64) FIXQuoteMessage {
    uint64_t sending_time_ns;
    char cl_ord_id[32];
    char symbol[8];
    double bid_price;
    double ask_price;
    uint32_t bid_size;
    uint32_t ask_size;
    uint64_t sequence_number;
};

// SPSC Cache-Aligned Ring Buffer for Go <=> C++ IPC
template <typename T, uint32_t Capacity>
class LocklessRingBuffer {
    static_assert((Capacity & (Capacity - 1)) == 0, "Capacity must be a power of 2");
private:
    alignas(64) T buffer[Capacity];
    alignas(64) std::atomic<uint64_t> write_index{0};
    alignas(64) std::atomic<uint64_t> read_index{0};

public:
    bool push(const T& item) {
        const uint64_t current_write = write_index.load(std::memory_order_relaxed);
        const uint64_t current_read = read_index.load(std::memory_order_acquire);
        
        if ((current_write - current_read) >= Capacity) {
            return false; // Backpressure overflow
        }
        
        buffer[current_write & (Capacity - 1)] = item;
        write_index.store(current_write + 1, std::memory_order_release);
        return true;
    }

    bool pop(T& item) {
        const uint64_t current_read = read_index.load(std::memory_order_relaxed);
        const uint64_t current_write = write_index.load(std::memory_order_acquire);
        
        if (current_read == current_write) {
            return false; // Spinlock checking empty state
        }
        
        item = buffer[current_read & (Capacity - 1)];
        read_index.store(current_read + 1, std::memory_order_release);
        return true;
    }
};

// ============================================================================
// REINFORCEMENT LEARNING REWARD MATRICES
// Highly optimized scalar evaluation used by PPO DRL model
// ============================================================================
extern "C" double calculateReward(
    double pnl_pips, 
    double execution_latency_ns, 
    double slippage_ticks, 
    double volatility_spike, 
    double position_lots
) {
    // 1. Profitability Factor
    double pnl_reward = pnl_pips * position_lots * 10.0;

    // 2. Exponential Slippage Penalty (Penalizes bad fills exponentially)
    double slippage_penalty = std::pow(std::abs(slippage_ticks), 1.5) * 2.5;

    // 3. Speed Sniper Reward
    double sniper_speed_bonus = 0.0;
    if (execution_latency_ns > 0.0 && execution_latency_ns < 500.0) {
        // High premium bonus for sub-500ns execution
        sniper_speed_bonus = (500.0 - execution_latency_ns) * 0.0375;
    } else if (execution_latency_ns >= 1500.0) {
        // Penalize stale ticks
        sniper_speed_bonus = -5.0;
    }

    // 4. Volatility Shock Throttling Decay
    double shock_factor = 1.0;
    if (volatility_spike > 3.0) {
        // Attenuate rewards using exponential decay during flash crashes
        shock_factor = std::exp(-0.4 * (volatility_spike - 3.0));
    }

    double final_reward = ((pnl_reward - slippage_penalty) * shock_factor) + sniper_speed_bonus;

    // Strict bounding to stabilize neural weights and prevent gradient explosion
    return std::max(-150.0, std::min(150.0, final_reward));
}

// ============================================================================
// MAIN SYSTEM CONTEXT AND HARDWARE INTERFACES
// ============================================================================
class SovereignExecutionKernel {
private:
    volatile uint32_t* mmio_register_ptr{nullptr};
    int mem_fd{-1};
    std::atomic<bool> is_running{true};
    double slippage_ema{0.0};
    const double SLIPPAGE_CRITICAL_THRESHOLD = 3.5; // Trigger Shock Absorber
    bool shock_absorber_active{false};

public:
    SovereignExecutionKernel() {
        // Map physical PCIe registers into memory layout
        mem_fd = open("/dev/mem", O_RDWR | O_SYNC);
        if (mem_fd >= 0) {
            void* mapped_page = mmap(
                nullptr, 
                MMIO_SPAN, 
                PROT_READ | PROT_WRITE, 
                MAP_SHARED, 
                mem_fd, 
                FPGA_BAR0_MMIO_BASE
            );
            if (mapped_page != MAP_FAILED) {
                mmio_register_ptr = reinterpret_cast<volatile uint32_t*>(mapped_page);
                std::cout << "[SYSTEM] MMIO hardware registers successfully mapped at address: " << mapped_page << "\n";
            }
        } else {
            std::cout << "[EMULATION] Hardware /dev/mem offline. Falling back to software simulator loop.\n";
            // Allocate virtual cache-aligned block for MMIO emulation
            void* mock_block = aligned_alloc(64, MMIO_SPAN);
            std::memset(mock_block, 0, MMIO_SPAN);
            mmio_register_ptr = reinterpret_cast<volatile uint32_t*>(mock_block);
        }
    }

    ~SovereignExecutionKernel() {
        if (mmio_register_ptr && mem_fd >= 0) {
            munmap(const_cast<uint32_t*>(mmio_register_ptr), MMIO_SPAN);
            close(mem_fd);
        } else if (mmio_register_ptr) {
            free(const_cast<uint32_t*>(mmio_register_ptr));
        }
    }

    // Thread Affinity: Pins process core execution to dedicated CPU Core
    bool pin_execution_thread() {
        cpu_set_t cpuset;
        CPU_ZERO(&cpuset);
        CPU_SET(CORE_PIN_AFFINITY_ID, &cpuset);
        
        pthread_t thread = pthread_self();
        int rc = pthread_setaffinity_np(thread, sizeof(cpu_set_t), &cpuset);
        if (rc == 0) {
            std::cout << "[SYSTEM] Thread pinned successfully to CPU Core " << CORE_PIN_AFFINITY_ID << "\n";
            return true;
        }
        std::cerr << "[SYSTEM] Thread pinning affinity failed!\n";
        return false;
    }

    // Spin Polling core processing execution orders from Go backplane
    void execution_spin_loop() {
        if (!pin_execution_thread()) {
            std::cerr << "[WARNING] Core affinity bypassed. Precision timing might fluctuate.\n";
        }

        std::cout << "[SYSTEM] Starting 99% Spinning Lock-Free SPSC checking core... Running.\n";
        
        while (is_running.load(std::memory_order_relaxed)) {
            // Emulated high-frequency trade trigger checks.
            // Check atomic MMIO flags directly over PCIe registers.
            if (*mmio_register_ptr == 0x1) {
                // Read tick timestamp and evaluate order.
                auto now = std::chrono::high_resolution_clock::now();
                uint64_t current_time_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(now.time_since_epoch()).count();
                
                // Perform quick FIX Parser translation
                // Clear hardware flag
                *mmio_register_ptr = 0x0;
            }
            
            // Lock-free spinning: avoids calling sleep/usleep/nanosleep which forces
            // kernel context switches and wastes 2-5 microseconds.
        }
    }

    void deactivate() {
        is_running.store(false, std::memory_order_release);
    }
};

int main() {
    std::cout << "Sovereign Algorithmic C++ Core Initialization...\n";
    SovereignExecutionKernel kernel;
    kernel.execution_spin_loop();
    return 0;
}
