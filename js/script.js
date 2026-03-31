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
let userId = 'web_user';
let countdownActive = false;
let countdownValue = 0;
let countdownInterval = null;
let multiplierStartTime = null;
let animationFrame = null;

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
const rocketContainer = document.querySelector('.rocket-container');

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

// ============ COUNTDOWN DISPLAY ============
function showCountdown(seconds) {
    countdownActive = true;
    countdownValue = seconds;
    
    // Hide rocket, show countdown
    if (rocketEl) rocketEl.style.display = 'none';
    
    // Create or update countdown display
    let countdownDisplay = document.getElementById('countdownDisplay');
    if (!countdownDisplay) {
        countdownDisplay = document.createElement('div');
        countdownDisplay.id = 'countdownDisplay';
        countdownDisplay.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 72px;
            font-weight: bold;
            color: #ff8e53;
            text-align: center;
            z-index: 10;
            background: rgba(0,0,0,0.7);
            padding: 40px;
            border-radius: 20px;
            font-family: monospace;
        `;
        if (rocketContainer) rocketContainer.style.position = 'relative';
        if (rocketContainer) rocketContainer.appendChild(countdownDisplay);
    }
    
    countdownDisplay.style.display = 'block';
    countdownDisplay.innerHTML = `${countdownValue}<br><span style="font-size: 24px;">Next round starts in...</span>`;
    
    // Disable buttons during countdown
    startBtn.disabled = true;
    cashoutBtn.disabled = true;
    betInput.disabled = true;
    
    if (countdownInterval) clearInterval(countdownInterval);
    
    countdownInterval = setInterval(() => {
        countdownValue--;
        if (countdownDisplay) {
            countdownDisplay.innerHTML = `${countdownValue}<br><span style="font-size: 24px;">Next round starts in...</span>`;
        }
        
        if (countdownValue <= 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
            hideCountdown();
            startNewRound();
        }
    }, 1000);
}

function hideCountdown() {
    countdownActive = false;
    const countdownDisplay = document.getElementById('countdownDisplay');
    if (countdownDisplay) {
        countdownDisplay.style.display = 'none';
    }
    if (rocketEl) rocketEl.style.display = 'block';
    rocketEl.classList.remove('crash');
    
    // Enable bet input for next round
    if (!gameActive) {
        startBtn.disabled = false;
        betInput.disabled = false;
        gameStatusEl.textContent = 'Ready to launch!';
        gameStatusEl.className = 'game-status';
    }
}

// ============ MULTIPLIER ANIMATION ============
function startMultiplierAnimation() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    multiplierStartTime = performance.now();
    
    function updateMultiplier(timestamp) {
        if (!gameActive) return;
        
        const elapsed = (timestamp - multiplierStartTime) / 1000;
        
        // Multiplier increases faster over time
        // Formula: multiplier = 1 + (elapsed ^ 1.5) * 1.5
        let newMultiplier = 1.0;
        if (elapsed > 0) {
            newMultiplier = 1.0 + Math.pow(elapsed, 1.5) * 1.5;
        }
        
        currentMultiplier = newMultiplier;
        currentMultiplierEl.textContent = `${currentMultiplier.toFixed(2)}x`;
        
        // Animate rocket based on multiplier
        const rocketHeight = Math.min(currentMultiplier * 25, 350);
        if (rocketEl) rocketEl.style.transform = `translateY(-${rocketHeight}px)`;
        
        // Change color based on multiplier
        if (currentMultiplier > 5) {
            currentMultiplierEl.style.color = '#ff8e53';
            currentMultiplierEl.style.animation = 'pulse 0.5s infinite';
        } else if (currentMultiplier > 2) {
            currentMultiplierEl.style.color = '#ff6b6b';
        } else {
            currentMultiplierEl.style.color = '#4caf50';
        }
        
        // Check if round should crash (based on server crash point)
        if (currentRound && currentMultiplier >= currentRound.crash_multiplier) {
            handleCrash(currentRound);
            return;
        }
        
        animationFrame = requestAnimationFrame(updateMultiplier);
    }
    
    animationFrame = requestAnimationFrame(updateMultiplier);
}

function stopMultiplierAnimation() {
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }
}

// ============ GAME MECHANICS ============
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

async function fetchUserBalance() {
    try {
        const response = await fetch(`${API_BASE_URL}/game/user/${userId}`);
        const user = await response.json();
        userBalance = user.balance;
        updateBalance();
        return user;
    } catch (error) {
        console.error('Error fetching balance:', error);
        return null;
    }
}

async function startGame() {
    // Cannot place bet if round is active
    if (gameActive) {
        showNotification('Round is already in progress! Wait for next round.', 'error');
        return;
    }
    
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
            gameStatusEl.textContent = '🚀 ROCKET FLYING... 🚀';
            
            // Reset rocket position
            if (rocketEl) {
                rocketEl.style.transform = 'translateY(0)';
                rocketEl.classList.remove('crash');
            }
            
            // Reset multiplier display
            currentMultiplier = 1.0;
            currentMultiplierEl.textContent = '1.00x';
            currentMultiplierEl.style.color = '#4caf50';
            
            // Start multiplier animation
            startMultiplierAnimation();
            
            showNotification(`Bet placed! Round #${betData.round_number}`, 'success');
        } else {
            showNotification(betData.detail || 'Failed to place bet', 'error');
        }
    } catch (error) {
        console.error('Error starting game:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

async function cashout() {
    if (!gameActive) return;
    
    try {
        // Stop animation first
        stopMultiplierAnimation();
        
        const response = await fetch(`${API_BASE_URL}/game/cashout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ round_id: currentRound?.round_id || 1, user_id: userId })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            gameActive = false;
            userBalance = data.won_amount ? userBalance + data.won_amount : userBalance;
            updateBalance();
            
            startBtn.disabled = true;
            cashoutBtn.disabled = true;
            betInput.disabled = true;
            gameStatusEl.className = 'game-status cashed';
            gameStatusEl.textContent = `🎉 CASHED OUT at ${data.cashed_out_at}x! Won: ${formatNumber(data.won_amount)} 🎉`;
            
            showNotification(data.message, 'success');
            
            // Start countdown for next round
            showCountdown(10);
        } else if (data.success === false) {
            gameActive = false;
            startBtn.disabled = true;
            cashoutBtn.disabled = true;
            betInput.disabled = true;
            gameStatusEl.className = 'game-status crashed';
            gameStatusEl.textContent = `💥 CRASHED at ${data.crash_multiplier}x! You lost ${formatNumber(currentBet)} 💥`;
            
            if (rocketEl) rocketEl.classList.add('crash');
            
            showNotification(data.message || `Round crashed at ${data.crash_multiplier}x!`, 'error');
            
            // Start countdown for next round
            showCountdown(10);
        }
        
        // Refresh history and stats
        loadHistory();
        loadStatistics();
        
    } catch (error) {
        console.error('Error cashing out:', error);
        showNotification('Network error. Please try again.', 'error');
        // Resume animation if error
        if (gameActive) startMultiplierAnimation();
    }
}

function handleCrash(round) {
    if (!gameActive) return;
    
    stopMultiplierAnimation();
    
    gameActive = false;
    startBtn.disabled = true;
    cashoutBtn.disabled = true;
    betInput.disabled = true;
    gameStatusEl.className = 'game-status crashed';
    gameStatusEl.textContent = `💥 CRASHED at ${round.crash_multiplier}x! You lost ${formatNumber(currentBet)} 💥`;
    
    if (rocketEl) rocketEl.classList.add('crash');
    
    // Refresh balance
    fetchUserBalance();
    
    // Refresh history and stats
    loadHistory();
    loadStatistics();
    
    showNotification(`Round crashed at ${round.crash_multiplier}x! Better luck next time!`, 'error');
    
    // Start countdown for next round
    showCountdown(10);
}

async function startNewRound() {
    // Fetch new round
    await fetchCurrentRound();
    
    // Reset UI
    gameActive = false;
    startBtn.disabled = false;
    cashoutBtn.disabled = true;
    betInput.disabled = false;
    gameStatusEl.className = 'game-status';
    gameStatusEl.textContent = 'Ready to launch!';
    
    // Reset multiplier display
    currentMultiplier = 1.0;
    currentMultiplierEl.textContent = '1.00x';
    currentMultiplierEl.style.color = '#4caf50';
    
    // Reset rocket
    if (rocketEl) {
        rocketEl.style.transform = 'translateY(0)';
        rocketEl.classList.remove('crash');
    }
    
    showNotification('New round started! Place your bet!', 'success');
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
                <div class="stat-card"><div class="stat-label">Low Crash (&lt;1.15x)</div><div class="stat-value">${stats.low_crash_count || 0}</div></div>
                <div class="stat-card"><div class="stat-label">High Crash (&gt;5x)</div><div class="stat-value">${stats.high_crash_count || 0}</div></div>
            `;
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
        if (statsDistributionEl) {
            statsDistributionEl.innerHTML = '<div class="stat-card">Error loading stats</div>';
        }
    }
}

async function loadHistory() {
    try {
        const response = await fetch(`${API_BASE_URL}/game/history?limit=20`);
        const history = await response.json();
        
        if (historyListEl) {
            historyListEl.innerHTML = '';
            if (!history || history.length === 0) {
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
        if (historyListEl) {
            historyListEl.innerHTML = '<div class="history-item">Error loading history</div>';
        }
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
    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
    }
`;
document.head.appendChild(style);

// ============ INITIALIZATION ============
async function init() {
    await fetchUserBalance();
    await loadStatistics();
    await loadHistory();
    await fetchCurrentRound();
    
    if (cashoutBtn) cashoutBtn.disabled = true;
    if (betInput) betInput.value = 100;
    startBtn.disabled = false;
    
    console.log('Game initialized! Place your bet and LAUNCH!');
}

// Start the game
init();