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
    double sniper_speed_bonus = 0.0;
    if (execution_latency_ns > 0.0 && execution_latency_ns < 500.0) {
        sniper_speed_bonus = (500.0 - execution_latency_ns) * 0.0375;
    } else if (execution_latency_ns >= 1500.0) {
        sniper_speed_bonus = -5.0;
    }
    double shock_factor = 1.0;
    if (volatility_spike > 3.0) {
        shock_factor = std::exp(-0.4 * (volatility_spike - 3.0));
    }
    double final_reward = ((pnl_reward - slippage_penalty) * shock_factor) + sniper_speed_bonus;
    return std::max(-150.0, std::min(150.0, final_reward));
}
