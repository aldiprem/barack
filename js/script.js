// API Configuration
const API_BASE_URL = 'api';

// Game State
let currentGame = null;
let currentMultiplier = 1.0;
let gameInterval = null;
let gameActive = false;
let userBalance = 100000;
let currentBet = 0;

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
    balanceEl.textContent = formatNumber(userBalance);
}

function addToHistory(game) {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    
    const time = new Date(game.timestamp).toLocaleTimeString();
    const isCrashed = game.status === 'crashed';
    const multiplier = isCrashed ? game.crash_point : game.cashed_out_at;
    const won = game.won_amount || 0;
    
    historyItem.innerHTML = `
        <div>
            <span style="color: #aaa;">${time}</span>
            <span style="margin-left: 10px;">Bet: ${formatNumber(game.bet_amount)}</span>
        </div>
        <div class="history-multiplier">
            <span class="history-crash ${isCrashed ? 'crashed' : 'cashed'}">
                ${multiplier}x
            </span>
            ${won > 0 ? `<span style="color: #4caf50; margin-left: 10px;">+${formatNumber(won)}</span>` : ''}
        </div>
    `;
    
    historyListEl.insertBefore(historyItem, historyListEl.firstChild);
    
    // Keep only last 50 items
    while (historyListEl.children.length > 50) {
        historyListEl.removeChild(historyListEl.lastChild);
    }
}

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
        // Place bet first
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
        if (!currentGame || !gameActive) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/game/state/${currentGame}`);
            const gameState = await response.json();
            
            if (response.ok) {
                currentMultiplier = gameState.current_multiplier;
                currentMultiplierEl.textContent = `${currentMultiplier.toFixed(2)}x`;
                
                // Animate rocket based on multiplier
                const rocketHeight = Math.min(currentMultiplier * 20, 200);
                rocketEl.style.transform = `translateY(-${rocketHeight}px)`;
                
                // Change color based on multiplier
                if (currentMultiplier > 5) {
                    currentMultiplierEl.style.color = '#ff8e53';
                } else if (currentMultiplier > 2) {
                    currentMultiplierEl.style.color = '#ff6b6b';
                } else {
                    currentMultiplierEl.style.color = '#4caf50';
                }
                
                // Check if game crashed
                if (gameState.status === 'crashed') {
                    handleCrash(gameState);
                }
            }
        } catch (error) {
            console.error('Error fetching game state:', error);
        }
    }, 100);
}

async function cashout() {
    if (!currentGame || !gameActive) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/game/cashout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                game_id: currentGame
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Add winnings to balance
            userBalance += data.won_amount;
            updateBalance();
            
            // Update UI
            gameActive = false;
            startBtn.disabled = false;
            cashoutBtn.disabled = true;
            betInput.disabled = false;
            gameStatusEl.className = 'game-status cashed';
            gameStatusEl.textContent = `🎉 CASHED OUT at ${data.cashed_out_at}x! Won: ${formatNumber(data.won_amount)} 🎉`;
            
            // Add to history
            addToHistory({
                game_id: currentGame,
                bet_amount: data.bet_amount,
                cashed_out_at: data.cashed_out_at,
                won_amount: data.won_amount,
                status: 'cashed_out',
                timestamp: new Date().toISOString()
            });
            
            // Stop multiplier update
            if (gameInterval) {
                clearInterval(gameInterval);
                gameInterval = null;
            }
            
            currentGame = null;
            
            showNotification(data.message, 'success');
        } else if (data.success === false) {
            handleCrash({ crash_point: data.crash_point });
        }
    } catch (error) {
        console.error('Error cashing out:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

function handleCrash(gameState) {
    gameActive = false;
    startBtn.disabled = false;
    cashoutBtn.disabled = true;
    betInput.disabled = false;
    gameStatusEl.className = 'game-status crashed';
    gameStatusEl.textContent = `💥 CRASHED at ${gameState.crash_point}x! You lost ${formatNumber(currentBet)} 💥`;
    
    // Add crash animation
    rocketEl.classList.add('crash');
    
    // Add to history
    addToHistory({
        game_id: currentGame,
        bet_amount: currentBet,
        crash_point: gameState.crash_point,
        status: 'crashed',
        timestamp: new Date().toISOString(),
        won_amount: 0
    });
    
    // Stop multiplier update
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }
    
    currentGame = null;
    
    showNotification(`Game crashed at ${gameState.crash_point}x! Better luck next time!`, 'error');
}

// ============ STATISTICS ============
async function loadStatistics() {
    try {
        const response = await fetch(`${API_BASE_URL}/game/statistics`);
        const stats = await response.json();
        
        if (response.ok) {
            statsDistributionEl.innerHTML = `
                <div class="stat-card">
                    <div class="stat-label">Total Games</div>
                    <div class="stat-value">${stats.total_games}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Avg Crash</div>
                    <div class="stat-value">${stats.avg_crash_point}x</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">1x-2x</div>
                    <div class="stat-value">${stats.crash_distribution['1x-2x']}%</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">2x-5x</div>
                    <div class="stat-value">${stats.crash_distribution['2x-5x']}%</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">5x-10x</div>
                    <div class="stat-value">${stats.crash_distribution['5x-10x']}%</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">10x+</div>
                    <div class="stat-value">${stats.crash_distribution['10x+']}%</div>
                </div>
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
        
        historyListEl.innerHTML = '';
        history.forEach(game => {
            addToHistory(game);
        });
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

// ============ NOTIFICATION SYSTEM ============
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
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
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// ============ BET PRESETS ============
function setBetAmount(amount) {
    betInput.value = amount;
}

// ============ EVENT LISTENERS ============
startBtn.addEventListener('click', startGame);
cashoutBtn.addEventListener('click', cashout);

// Bet preset buttons
document.querySelectorAll('.bet-preset').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const amount = parseFloat(btn.dataset.amount);
        if (!isNaN(amount)) {
            setBetAmount(amount);
        }
    });
});

// Validate bet input
betInput.addEventListener('input', () => {
    let value = parseFloat(betInput.value);
    if (isNaN(value)) value = 0;
    if (value < 0) betInput.value = 0;
    if (value > userBalance) betInput.value = userBalance;
});

// ============ INITIALIZATION ============
async function init() {
    updateBalance();
    await loadStatistics();
    await loadHistory();
    
    // Disable cashout initially
    cashoutBtn.disabled = true;
    
    // Set default bet
    betInput.value = 100;
    
    // Add keyboard support
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !startBtn.disabled && gameActive) {
            e.preventDefault();
            cashout();
        } else if (e.code === 'Space' && startBtn.disabled === false) {
            e.preventDefault();
            startGame();
        }
    });
    
    console.log('Game initialized! Press SPACE to start/cashout');
}

// Start the game
init();