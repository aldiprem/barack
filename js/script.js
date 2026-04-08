// Mencegah reload saat scroll ke atas
let lastScrollTop = 0;
const scrollContainer = document.getElementById('scrollContainer');

if (scrollContainer) {
    scrollContainer.addEventListener('scroll', function(e) {
        const scrollTop = this.scrollTop;
        
        // Mencegah pull-to-refresh di mobile
        if (scrollTop < 0) {
            e.preventDefault();
            this.scrollTop = 0;
        }
        
        lastScrollTop = scrollTop;
    }, { passive: false });
}

// Mencegah refresh browser pada scroll desktop
window.addEventListener('wheel', function(e) {
    if (scrollContainer && scrollContainer.scrollTop === 0 && e.deltaY < 0) {
        e.preventDefault();
        return false;
    }
}, { passive: false });

// Handle touch events untuk mobile
if (scrollContainer) {
    scrollContainer.addEventListener('touchstart', function(e) {
        this.startY = e.touches[0].clientY;
    });

    scrollContainer.addEventListener('touchmove', function(e) {
        const currentY = e.touches[0].clientY;
        const scrollTop = this.scrollTop;
        
        if (scrollTop === 0 && currentY > this.startY) {
            e.preventDefault();
            return false;
        }
    }, { passive: false });
}

// Pagination Navigation
class PageManager {
    constructor() {
        this.currentPage = null;
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadTelegramUser();
    }
    
    bindEvents() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const page = item.dataset.page;
                this.switchPage(page);
            });
        });
    }
    
    switchPage(page) {
        // Update active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });
        
        this.currentPage = page;
        this.loadPageContent(page);
    }
    
    loadPageContent(page) {
        const contentWrapper = document.getElementById('contentWrapper');
        
        // Tampilkan loading
        contentWrapper.innerHTML = `
            <div class="content-placeholder">
                <div class="loading-spinner"></div>
                <p>Memuat ${page}...</p>
            </div>
        `;
        
        // Simulasi loading (nanti diganti dengan API call)
        setTimeout(() => {
            let content = '';
            
            switch(page) {
                case 'games':
                    content = this.getGamesContent();
                    break;
                case 'market':
                    content = this.getMarketContent();
                    break;
                case 'profile':
                    content = this.getProfileContent();
                    break;
                default:
                    content = this.getDefaultContent();
            }
            
            contentWrapper.innerHTML = content;
        }, 500);
    }
    
    getGamesContent() {
        return `
            <div class="glass-card">
                <h3>🎮 Games</h3>
                <p>Konten Games akan segera hadir!</p>
                <p style="margin-top: 15px; font-size: 14px; opacity: 0.7;">
                    Fitur games sedang dalam pengembangan
                </p>
            </div>
        `;
    }
    
    getMarketContent() {
        return `
            <div class="glass-card">
                <h3>🛒 Market</h3>
                <p>Konten Market akan segera hadir!</p>
                <p style="margin-top: 15px; font-size: 14px; opacity: 0.7;">
                    Fitur market sedang dalam pengembangan
                </p>
            </div>
        `;
    }
    
    getProfileContent() {
        return `
            <div class="glass-card">
                <h3>👤 Profil</h3>
                <p>Konten Profil akan segera hadir!</p>
                <p style="margin-top: 15px; font-size: 14px; opacity: 0.7;">
                    Fitur profil sedang dalam pengembangan
                </p>
            </div>
        `;
    }
    
    getDefaultContent() {
        return `
            <div class="glass-card">
                <h2>✨ Selamat Datang di Barack Gift</h2>
                <p>Pilih menu di bawah untuk memulai</p>
                <p style="margin-top: 20px; font-size: 14px; opacity: 0.7;">
                    ⚡ Siap memberikan pengalaman terbaik untuk Anda
                </p>
            </div>
        `;
    }
    
    async loadTelegramUser() {
        try {
            // Nanti diintegrasikan dengan Telegram Login Widget
            const response = await fetch('/api/telegram_user');
            const userData = await response.json();
            
            const userAvatar = document.getElementById('userAvatar');
            const userName = document.getElementById('userName');
            
            if (userAvatar) userAvatar.src = userData.photo_url;
            if (userName) userName.textContent = userData.first_name || userData.username;
        } catch (error) {
            console.log('Telegram user not loaded yet');
            const userName = document.getElementById('userName');
            if (userName) userName.textContent = 'Guest User';
        }
    }
}

// Tambahkan CSS untuk loading spinner
const style = document.createElement('style');
style.textContent = `
    .loading-spinner {
        width: 40px;
        height: 40px;
        margin: 20px auto;
        border: 3px solid rgba(255, 255, 255, 0.1);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    .glass-card {
        animation: fadeIn 0.3s ease;
    }
    
    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;

document.head.appendChild(style);

// Initialize Page Manager ketika DOM sudah loaded
document.addEventListener('DOMContentLoaded', () => {
    const pageManager = new PageManager();
});