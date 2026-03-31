// API Configuration
const API_BASE_URL = '/api';

// Game State
let currentRound = null;
let currentMultiplier = 1.0;
let gameInterval = null;
let gameActive = false;
let userBalance = 10000;
let currentBet = 0;
let currentBetId = null;
let userId = 'web_user';  // ← Deklarasi userId

// DOM Elements
const currentMultiplierEl = document.getElementById('currentMultiplier');
const gameStatusEl = document.getElementById('gameStatus');
const startBtn = document.getElementById('startBtn');
const cashoutBtn = document.getElementById('cashoutBtn');
const betInput = document.getElementById('betAmount');
const balanceEl = document.getElementById('balance');
const lastResultEl = document.getElementById('lastResult');
const historyListEl = document.getElementById('historyList');
const statsDistributionEl = document.getElementById('statsDistribution');
const rocketEl = document.getElementById('rocket');

// ============ UTILITY FUNCTIONS ============
function formatNumber(num) {
    return new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
}

function updateBalance() {
    if (balanceEl) balanceEl.textContent = formatNumber(userBalance);
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 10px;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#ff6b6b' : '#ff8e53'};
        color: white;
        font-weight: bold;
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

async function fetchCurrentRound() {
    try {
        const response = await fetch(`${API_BASE_URL}/game/current_round`);
        const round = await response.json();
        currentRound = round;
        return round;
    } catch (error) {
        console.error('Error fetching round:', error);
        return null;
    }
}

// ============ GAME MECHANICS ============
async function startGame() {
    const betAmount = parseFloat(betInput.value);
    
    if (isNaN(betAmount) || betAmount <= 0) {
        showNotification('Please enter a valid bet amount!', 'error');
        return;
    }
    
    if (betAmount > userBalance) {
        showNotification('Insufficient balance!', 'error');
        return;
    }
    
    try {
        // Place bet
        const betResponse = await fetch(`${API_BASE_URL}/game/bet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bet_amount: betAmount, user_id: userId })
        });
        
        const betData = await betResponse.json();
        
        if (betResponse.ok && betData.success) {
            currentBet = betAmount;
            currentBetId = betData.bet_id;
            userBalance -= betAmount;
            updateBalance();
            gameActive = true;
            
            // Update UI
            startBtn.disabled = true;
            cashoutBtn.disabled = false;
            betInput.disabled = true;
            gameStatusEl.className = 'game-status active';
            gameStatusEl.textContent = '🚀 ROCKET LAUNCHING... 🚀';
            
            // Reset multiplier display
            currentMultiplier = 1.0;
            currentMultiplierEl.textContent = '1.00x';
            
            // Reset rocket position
            if (rocketEl) rocketEl.style.transform = 'translateY(0)';
            if (rocketEl) rocketEl.classList.remove('crash');
            
            // Start multiplier update
            startMultiplierUpdate();
            
            showNotification(`Bet placed! Round #${betData.round_number}`, 'success');
        } else {
            showNotification(betData.detail || 'Failed to place bet', 'error');
        }
    } catch (error) {
        console.error('Error starting game:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

function startMultiplierUpdate() {
    if (gameInterval) clearInterval(gameInterval);
    
    gameInterval = setInterval(async () => {
        if (!gameActive) return;
        
        try {
            const round = await fetchCurrentRound();
            if (round) {
                currentMultiplier = round.current_multiplier;
                currentMultiplierEl.textContent = `${currentMultiplier.toFixed(2)}x`;
                
                // Animate rocket based on multiplier
                const rocketHeight = Math.min(currentMultiplier * 20, 200);
                if (rocketEl) rocketEl.style.transform = `translateY(-${rocketHeight}px)`;
                
                // Check if round crashed
                if (round.status === 'crashed' && gameActive) {
                    handleCrash(round);
                }
            }
        } catch (error) {
            console.error('Error fetching round state:', error);
        }
    }, 100);
}

async function cashout() {
    if (!gameActive) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/game/cashout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ round_id: currentRound?.round_id || 1, user_id: userId })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            gameActive = false;
            userBalance += data.won_amount;
            updateBalance();
            
            startBtn.disabled = false;
            cashoutBtn.disabled = true;
            betInput.disabled = false;
            gameStatusEl.className = 'game-status cashed';
            gameStatusEl.textContent = `🎉 CASHED OUT at ${data.cashed_out_at}x! Won: ${formatNumber(data.won_amount)} 🎉`;
            
            if (gameInterval) clearInterval(gameInterval);
            gameInterval = null;
            
            // Refresh history
            loadHistory();
            loadStatistics();
            
            showNotification(data.message, 'success');
        } else if (data.success === false) {
            handleCrash({ crash_multiplier: data.crash_multiplier });
        }
    } catch (error) {
        console.error('Error cashing out:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

function handleCrash(round) {
    gameActive = false;
    startBtn.disabled = false;
    cashoutBtn.disabled = true;
    betInput.disabled = false;
    gameStatusEl.className = 'game-status crashed';
    gameStatusEl.textContent = `💥 CRASHED at ${round.crash_multiplier}x! You lost ${formatNumber(currentBet)} 💥`;
    
    if (rocketEl) rocketEl.classList.add('crash');
    
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = null;
    
    // Refresh balance
    fetchUserBalance();
    
    showNotification(`Round crashed at ${round.crash_multiplier}x! Better luck next time!`, 'error');
}

async function fetchUserBalance() {
    try {
        const response = await fetch(`${API_BASE_URL}/game/user/${userId}`);
        const user = await response.json();
        userBalance = user.balance;
        updateBalance();
    } catch (error) {
        console.error('Error fetching balance:', error);
    }
}

// ============ STATISTICS ============
async function loadStatistics() {
    try {
        const response = await fetch(`${API_BASE_URL}/game/statistics`);
        const stats = await response.json();
        
        if (response.ok && statsDistributionEl) {
            statsDistributionEl.innerHTML = `
                <div class="stat-card"><div class="stat-label">Total Rounds</div><div class="stat-value">${stats.total_rounds || 0}</div></div>
                <div class="stat-card"><div class="stat-label">Avg Crash</div><div class="stat-value">${stats.avg_crash_point || 0}x</div></div>
                <div class="stat-card"><div class="stat-label">Low Crash</div><div class="stat-value">${stats.low_crash_count || 0}</div></div>
                <div class="stat-card"><div class="stat-label">High Crash</div><div class="stat-value">${stats.high_crash_count || 0}</div></div>
            `;
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

async function loadHistory() {
    try {
        const response = await fetch(`${API_BASE_URL}/game/history?limit=20`);
        const history = await response.json();
        
        if (historyListEl) {
            historyListEl.innerHTML = '';
            if (history.length === 0) {
                historyListEl.innerHTML = '<div class="history-item">No games played yet</div>';
            } else {
                history.forEach(round => {
                    const historyItem = document.createElement('div');
                    historyItem.className = 'history-item';
                    const time = new Date(round.start_time).toLocaleTimeString();
                    historyItem.innerHTML = `
                        <div>
                            <span style="color: #aaa;">Round #${round.round_number}</span>
                            <span style="margin-left: 10px;">${time}</span>
                        </div>
                        <div class="history-multiplier">
                            <span class="history-crash ${round.status === 'crashed' ? 'crashed' : 'cashed'}">
                                ${round.crash_multiplier}x
                            </span>
                        </div>
                    `;
                    historyListEl.appendChild(historyItem);
                });
            }
        }
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

// ============ BET PRESETS ============
function setBetAmount(amount) {
    if (betInput) betInput.value = amount;
}

// ============ EVENT LISTENERS ============
if (startBtn) startBtn.addEventListener('click', startGame);
if (cashoutBtn) cashoutBtn.addEventListener('click', cashout);

document.querySelectorAll('.bet-preset').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const amount = parseFloat(btn.dataset.amount);
        if (!isNaN(amount)) setBetAmount(amount);
    });
});

if (betInput) {
    betInput.addEventListener('input', () => {
        let value = parseFloat(betInput.value);
        if (isNaN(value)) value = 0;
        if (value < 0) betInput.value = 0;
        if (value > userBalance) betInput.value = userBalance;
    });
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// ============ INITIALIZATION ============
async function init() {
    await fetchUserBalance();
    await loadStatistics();
    await loadHistory();
    
    if (cashoutBtn) cashoutBtn.disabled = true;
    if (betInput) betInput.value = 100;
    
    // Start polling current round
    fetchCurrentRound();
    setInterval(async () => {
        if (!gameActive) {
            const round = await fetchCurrentRound();
            if (round && currentMultiplierEl) {
                currentMultiplierEl.textContent = `${round.current_multiplier.toFixed(2)}x`;
            }
        }
    }, 1000);
    
    console.log('Game initialized! Place your bet and LAUNCH!');
}

init();