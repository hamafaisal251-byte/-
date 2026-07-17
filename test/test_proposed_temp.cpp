#include <cmath>
#include <algorithm>

extern "C" double calculateReward(
    double pnl_pips, 
    double execution_latency_ns, 
    double slippage_ticks, 
    double volatility_spike, 
    double position_lots
) {
    double pnl_reward = pnl_pips * position_lots * 10.0;
    double slippage_penalty = std::pow(std::abs(slippage_ticks), 1.5) * 2.5;
    
    // Non-linear exponential decay risk protect under high volatility spikes
    double shock_factor = 1.0;
    if (volatility_spike > 3.5) {
        shock_factor = std::exp(-0.45 * (volatility_spike - 3.5));
    }
    
    double final_reward = (pnl_reward - slippage_penalty) * shock_factor;
    
    // Micro latency bonus for fast sniper fills
    double speed_bonus = 0.0;
    if (execution_latency_ns > 0.0 && execution_latency_ns < 400.0) {
        speed_bonus = (400.0 - execution_latency_ns) * 0.05;
    }
    
    return std::max(-150.0, std::min(150.0, final_reward + speed_bonus));
}