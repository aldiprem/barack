class SpacemanGame {
    constructor() {
        this.apiUrl = '/api';
        this.updateInterval = null;
        this.historyUpdateInterval = null;
        this.init();
    }
    
    init() {
        this.startGameUpdates();
        this.startHistoryUpdates();
    }
    
    startGameUpdates() {
        this.updateInterval = setInterval(() => {
            this.updateGameStatus();
        }, 100); // Update every 100ms for smooth animation
    }
    
    startHistoryUpdates() {
        this.historyUpdateInterval = setInterval(() => {
            this.updateHistory();
        }, 1000);
    }
    
    async updateGameStatus() {
        try {
            const response = await fetch(`${this.apiUrl}/game/status`);
            const data = await response.json();
            
            this.updateRocketPosition(data.multiplier);
            this.updateMultiplierDisplay(data.multiplier);
            this.updateSpeedDisplay(data.multiplier);
            
            if (data.countdown_active) {
                this.showCountdown(data.countdown_value);
            } else {
                this.hideCountdown();
            }
            
            if (data.current_round) {
                this.updateCurrentRound(data.current_round);
            }
            
        } catch (error) {
            console.error('Error updating game status:', error);
        }
    }
    
    updateRocketPosition(multiplier) {
        const rocket = document.getElementById('rocket');
        // Map multiplier to height (1x = bottom, 100x = top)
        const maxHeight = 250; // pixels
        let height = Math.min((multiplier / 100) * maxHeight, maxHeight);
        
        if (multiplier >= 100) {
            height = maxHeight;
        }
        
        rocket.style.bottom = `${height}px`;
        
        // Add shaking effect for high multipliers
        if (multiplier > 10) {
            const shake = Math.sin(Date.now() * 0.02) * 2;
            rocket.style.transform = `translateX(-50%) translateX(${shake}px)`;
        } else {
            rocket.style.transform = 'translateX(-50%)';
        }
    }
    
    updateMultiplierDisplay(multiplier) {
        const multiplierElement = document.getElementById('multiplier');
        multiplierElement.textContent = `${multiplier.toFixed(2)}x`;
        
        // Change color based on multiplier
        if (multiplier < 2) {
            multiplierElement.style.color = '#4CAF50';
        } else if (multiplier < 5) {
            multiplierElement.style.color = '#FFC107';
        } else if (multiplier < 10) {
            multiplierElement.style.color = '#FF9800';
        } else {
            multiplierElement.style.color = '#FF6B6B';
        }
    }
    
    updateSpeedDisplay(multiplier) {
        const speedElement = document.getElementById('speed');
        let speedText = 'Normal';
        let speedValue = 1;
        
        if (multiplier < 2) {
            speedText = 'Slow';
            speedValue = 1;
        } else if (multiplier < 5) {
            speedText = 'Normal';
            speedValue = 1.5;
        } else if (multiplier < 10) {
            speedText = 'Fast';
            speedValue = 2;
        } else if (multiplier < 20) {
            speedText = 'Very Fast';
            speedValue = 3;
        } else if (multiplier < 50) {
            speedText = 'Extreme';
            speedValue = 5;
        } else {
            speedText = 'WARP SPEED!';
            speedValue = 8;
        }
        
        speedElement.textContent = `Speed: ${speedText}`;
        speedElement.style.color = speedValue > 3 ? '#FF6B6B' : '#666';
    }
    
    showCountdown(value) {
        const overlay = document.getElementById('countdownOverlay');
        const numberElement = document.getElementById('countdownNumber');
        
        if (overlay.style.display !== 'flex') {
            overlay.style.display = 'flex';
        }
        
        numberElement.textContent = value;
        
        // Add bounce animation
        numberElement.style.animation = 'none';
        numberElement.offsetHeight; // Trigger reflow
        numberElement.style.animation = 'bounce 1s ease-in-out';
    }
    
    hideCountdown() {
        const overlay = document.getElementById('countdownOverlay');
        overlay.style.display = 'none';
    }
    
    async updateHistory() {
        try {
            const response = await fetch(`${this.apiUrl}/game/history`);
            const history = await response.json();
            
            this.renderHistory(history);
        } catch (error) {
            console.error('Error updating history:', error);
        }
    }
    
    renderHistory(history) {
        const historyList = document.getElementById('historyList');
        
        if (!history || history.length === 0) {
            historyList.innerHTML = '<div class="loading">No history available</div>';
            return;
        }
        
        historyList.innerHTML = history.map(round => {
            let multiplierClass = '';
            if (round.multiplier >= 10) {
                multiplierClass = 'ultra';
            } else if (round.multiplier >= 5) {
                multiplierClass = 'high';
            }
            
            const date = new Date(round.start_time);
            const timeStr = date.toLocaleTimeString();
            
            return `
                <div class="history-item">
                    <div class="history-round">
                        <small>${round.round_id.substring(0, 8)}...</small>
                        <small style="color:#999">${timeStr}</small>
                    </div>
                    <div class="history-multiplier ${multiplierClass}">
                        ${round.multiplier.toFixed(2)}x
                    </div>
                </div>
            `;
        }).join('');
    }
    
    updateCurrentRound(round) {
        const roundIdElement = document.getElementById('roundId');
        const targetElement = document.getElementById('targetMultiplier');
        
        if (round) {
            roundIdElement.textContent = round.round_id.substring(0, 16) + '...';
            targetElement.textContent = round.multiplier;
            
            // Change color based on target multiplier
            if (round.multiplier >= 10) {
                targetElement.style.color = '#FF1493';
            } else if (round.multiplier >= 5) {
                targetElement.style.color = '#FFD700';
            } else if (round.multiplier >= 2) {
                targetElement.style.color = '#FFC107';
            } else {
                targetElement.style.color = '#4CAF50';
            }
        } else {
            roundIdElement.textContent = '-';
            targetElement.textContent = '-';
        }
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new SpacemanGame();
});