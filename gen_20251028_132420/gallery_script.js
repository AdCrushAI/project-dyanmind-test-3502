// Email caching helper functions
const EMAIL_CACHE_KEY = 'adcrush_user_email';

function getCachedEmail() {
    try {
        return localStorage.getItem(EMAIL_CACHE_KEY) || '';
    } catch (e) {
        console.warn('Failed to get cached email:', e);
        return '';
    }
}

function setCachedEmail(email) {
    try {
        if (email && email.trim()) {
            localStorage.setItem(EMAIL_CACHE_KEY, email.trim());
        }
    } catch (e) {
        console.warn('Failed to cache email:', e);
    }
}

function setupEmailCaching(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
        // Populate from cache
        const cachedEmail = getCachedEmail();
        if (cachedEmail) {
            input.value = cachedEmail;
        }
        
        // Save on input
        input.addEventListener('input', (e) => {
            setCachedEmail(e.target.value);
        });
    }
}

// Crushes management with localStorage
class CrushManager {
    constructor() {
        this.storageKey = 'adcrush_favorites';
        this.crushes = this.load();
    }
    
    load() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.warn('Failed to load crushes:', e);
            return [];
        }
    }
    
    save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.crushes));
        } catch (e) {
            console.warn('Failed to save crushes:', e);
        }
    }
    
    toggle(filename) {
        const index = this.crushes.indexOf(filename);
        if (index > -1) {
            this.crushes.splice(index, 1);
        } else {
            this.crushes.push(filename);
        }
        this.save();
        return this.isCrushed(filename);
    }
    
    isCrushed(filename) {
        return this.crushes.includes(filename);
    }
    
    getAll() {
        return [...this.crushes];
    }
}

const crushManager = new CrushManager();

// Parse filename to extract metadata
function parseFilename(filename) {
    const base = filename.replace('.png', '');
    const parts = base.split('__');
    
    return {
        persona: parts[0] || 'Unknown',
        hook: parts[1] || 'Unknown',
        style: parts[2] || 'Unknown',
        timestamp: parts[3] || '',
        index: parts[4] || ''
    };
}

// Format text
function formatText(text) {
    return text
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Extract keywords
function extractKeywords(text) {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'with', 'from', 'to', 'for', 'of', 'in', 'on', 'at']);
    return text
        .toLowerCase()
        .split(/\W+/)
        .filter(w => w.length > 3 && !stopWords.has(w))
        .slice(0, 15);
}

// Load gallery data
async function loadGalleryData() {
    const embeddedData = window.GALLERY_DATA;
    const data = [];
    
    for (const item of embeddedData) {
        const metadata = parseFilename(item.filename);
        const fbCopy = item.fbCopy || 'No copy available';
        
        // Parse tags - now supports both array and CSV string formats
        let tags = item.tags || [];
        if (typeof tags === 'string') {
            // CSV format: "tag1, tag2, tag3"
            tags = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
        } else if (!Array.isArray(tags) || tags.length === 0) {
            // Fallback: extract from metadata
            const keywordsFromName = [
                ...metadata.persona.split('-'),
                ...metadata.hook.split('-'),
                ...metadata.style.split('-')
            ];
            const keywordsFromCopy = extractKeywords(fbCopy);
            tags = [...new Set([...keywordsFromName, ...keywordsFromCopy])].slice(0, 12);
        }
        
        const promptText = item.prompt || '';
        const jobData = item.job || {};
        
        data.push({
            filename: item.filename,
            thumbnail: item.thumbnail || item.filename,
            ...metadata,
            fbCopy,
            tags,
            prompt: promptText,
            job: jobData,
            searchText: [
                item.filename,
                metadata.persona,
                metadata.hook,
                metadata.style,
                fbCopy,
                promptText,
                JSON.stringify(jobData),
                ...tags
            ].join(' ')
        });
    }
    
    return data;
}

// Toggle crush
function toggleCrush(event, filename) {
    event.stopPropagation();
    const isCrushed = crushManager.toggle(filename);
    const btn = event.currentTarget;
    btn.classList.toggle('crushed', isCrushed);
    updateCounts();
    
    if (currentTab === 'crushes') {
        filterAndRender();
    }
}

// Create card HTML
function createCard(item) {
    const isCrushed = crushManager.isCrushed(item.filename);
    const boltIcon = `<span class="material-icons">bolt</span>`;
    const aspectRatio = getAspectRatio();
    
    // Check for text typo detection
    const hasTypo = item.tags.some(tag => 
        tag.toLowerCase().includes('text_typo_detected') || 
        tag.toLowerCase().includes('typo:')
    );
    
    // Only show first 3 tags on card
    const displayTags = item.tags.slice(0, 3);
    const tagHTML = displayTags.map(tag => `<span class="tag">${tag}</span>`).join('');
    
    return `
        <div class="card ${hasTypo ? 'has-typo' : ''}" onclick="openLightbox('${item.filename}')">
            <div class="card-image-wrapper">
                <button class="crush-btn ${isCrushed ? 'crushed' : ''}" 
                        onclick="toggleCrush(event, '${item.filename}')">
                    ${boltIcon}
                </button>
                <img class="card-image" src="${item.thumbnail}" alt="${item.persona} - ${item.hook}" loading="lazy">
            </div>
            <div class="card-content">
                <div class="metadata">
                    <div class="meta-item">
                        <span class="meta-icon material-icons">person</span>
                        <span class="meta-label">Persona:</span>
                        <span class="meta-value">${formatText(item.persona)}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-icon material-icons">gps_fixed</span>
                        <span class="meta-label">Hook:</span>
                        <span class="meta-value">${formatText(item.hook)}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-icon material-icons">palette</span>
                        <span class="meta-label">Style:</span>
                        <span class="meta-value">${formatText(item.style)}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-icon material-icons">aspect_ratio</span>
                        <span class="meta-label">Ratio:</span>
                        <span class="meta-value">${aspectRatio}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-icon material-icons">spellcheck</span>
                        <span class="meta-label">Quality:</span>
                        <span class="meta-value">
                            <span class="perfect-badge ${hasTypo ? 'has-error' : ''}">
                                ✓ Perfect
                            </span>
                        </span>
                    </div>
                </div>
                
                <div class="fb-copy">${item.fbCopy}</div>
                
                <div class="card-actions-split">
                    <button class="action-btn-secondary" onclick="openEditModal(event, '${item.filename}')">
                        <span class="material-icons">edit</span>
                        <span>Edit</span>
                    </button>
                    <button class="action-btn-primary" onclick="openDownloadModal(event, '${item.filename}')">
                        <span class="material-icons">download</span>
                        <span>Download</span>
                    </button>
                </div>
                
                ${tagHTML ? `<div class="tags">${tagHTML}</div>` : ''}
            </div>
        </div>
    `;
}

// Copy to clipboard
function copyToClipboard(event, text) {
    event.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
        const button = event.currentTarget;
        const originalHTML = button.innerHTML;
        button.innerHTML = '<span class="material-icons" style="font-size: 1rem; margin-right: 0.5rem;">check</span>Copied!';
        button.classList.add('copied');
        
        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Copy failed:', err);
        alert('Failed to copy to clipboard');
    });
}

// Preload adjacent images for smooth navigation
function preloadAdjacentImages(currentIndex) {
    if (currentItems.length <= 1) return;
    
    const nextIndex = (currentIndex + 1) % currentItems.length;
    const prevIndex = (currentIndex - 1 + currentItems.length) % currentItems.length;
    
    // Preload in background
    const nextImg = new Image();
    nextImg.src = currentItems[nextIndex].filename;
    
    const prevImg = new Image();
    prevImg.src = currentItems[prevIndex].filename;
}

// Open lightbox with permalink support
function openLightbox(filename) {
    const item = allData.find(d => d.filename === filename);
    if (!item) return;
    
    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightbox-image');
    const lightboxDetails = document.getElementById('lightbox-details');
    const loadingOverlay = document.getElementById('lightbox-loading');
    
    // Update URL with selection parameter (use replaceState for initial open)
    const url = new URL(window.location);
    url.searchParams.set('selection', filename);
    window.history.replaceState({}, '', url);
    
    // Show loading state
    lightboxImage.classList.add('loading');
    loadingOverlay.classList.remove('hidden');
    
    // Set up image load handler
    lightboxImage.onload = function() {
        lightboxImage.classList.remove('loading');
        loadingOverlay.classList.add('hidden');
    };
    
    // Set image (use original PNG)
    lightboxImage.src = item.filename;
    
    // Preload adjacent images
    const currentIndex = currentItems.findIndex(d => d.filename === filename);
    if (currentIndex !== -1) {
        preloadAdjacentImages(currentIndex);
    }
    
    // Build details
    const job = item.job || {};
    const persona = job.persona || {};
    const hook = job.hook || {};
    const style = job.style || {};
    
    // Prepare tags section with truncation
    const allTags = item.tags || [];
    const displayTags = allTags.slice(0, 3);
    const remainingCount = allTags.length - 3;
    
    let tagsHTML = '';
    if (allTags.length > 0) {
        const tagsDisplay = displayTags.map(tag => `<span class="tag">${tag}</span>`).join('');
        const viewAllBtn = allTags.length > 3 
            ? `<button class="action-btn" onclick="toggleLightboxTags()" style="margin-top: 0.5rem;" id="lightbox-tags-toggle">
                <span class="material-icons">local_offer</span>
                <span>View All (${remainingCount} more)</span>
              </button>`
            : '';
        
        tagsHTML = `
        <div class="lightbox-section">
            <h3><span class="material-icons" style="font-size: 1rem; vertical-align: middle; margin-right: 0.25rem;">local_offer</span> Tags</h3>
            <div class="tags" id="lightbox-tags-preview">
                ${tagsDisplay}
            </div>
            <div class="tags" id="lightbox-tags-full" style="display: none;">
                ${allTags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
            ${viewAllBtn}
        </div>
        `;
    }
    
    // Crush button state
    const isCrushed = crushManager.isCrushed(item.filename);
    
    let detailsHTML = `
        <div class="lightbox-controls-inline">
            <button class="lightbox-nav-inline lightbox-nav-prev-inline" onclick="navigateLightbox(-1)" title="Previous">
                <span class="material-icons">chevron_left</span>
            </button>
            <button class="lightbox-nav-inline lightbox-nav-next-inline" onclick="navigateLightbox(1)" title="Next">
                <span class="material-icons">chevron_right</span>
            </button>
            <div class="lightbox-controls-spacer"></div>
            <button class="lightbox-crush-inline ${isCrushed ? 'crushed' : ''}" onclick="toggleCrushLightbox(event)" title="Crush">
                <span class="material-icons">bolt</span>
            </button>
            <button class="lightbox-close-inline" onclick="closeLightbox(event)" title="Close">
                <span class="material-icons">close</span>
            </button>
        </div>
        
        <h2>${formatText(item.persona)}</h2>
        
        <div class="lightbox-section">
            <h3><span class="material-icons" style="font-size: 1rem; vertical-align: middle; margin-right: 0.25rem;">gps_fixed</span> Hook</h3>
            <p>${hook.full_text || formatText(item.hook)}</p>
        </div>
        
        <div class="lightbox-section">
            <h3><span class="material-icons" style="font-size: 1rem; vertical-align: middle; margin-right: 0.25rem;">person</span> Target Audience</h3>
            <p>${persona.target || 'N/A'}</p>
        </div>
        
        <div class="lightbox-section">
            <h3><span class="material-icons" style="font-size: 1rem; vertical-align: middle; margin-right: 0.25rem;">lightbulb</span> Value Proposition</h3>
            <p>${persona.value_proposition || 'N/A'}</p>
        </div>
        
        <div class="lightbox-section">
            <h3><span class="material-icons" style="font-size: 1rem; vertical-align: middle; margin-right: 0.25rem;">campaign</span> Facebook Ad Copy</h3>
            <p>${item.fbCopy}</p>
        </div>
        
        <div class="lightbox-section">
            <h3><span class="material-icons" style="font-size: 1rem; vertical-align: middle; margin-right: 0.25rem;">palette</span> Style</h3>
            <p><strong>${style.full_name || formatText(item.style)}</strong></p>
            ${style.palette ? `<p><em>Palette:</em> ${style.palette}</p>` : ''}
        </div>
        
        ${tagsHTML}
        
        <div class="card-actions-split">
            <button class="action-btn-secondary" onclick="openEditModal(event, '${item.filename}')">
                <span class="material-icons">edit</span>
                <span>Edit</span>
            </button>
            <button class="action-btn-primary" onclick="openDownloadModal(event, '${item.filename}')">
                <span class="material-icons">download</span>
                <span>Download</span>
            </button>
        </div>
        
        <button class="save-crush-cta ${isCrushed ? 'crushed' : ''}" onclick="toggleCrushLightbox(event)">
            <span class="material-icons" style="font-size: 1.5rem;">bolt</span>
            <span>${isCrushed ? 'Crush Saved!' : 'Save Crush'}</span>
        </button>
    `;
    
    lightboxDetails.innerHTML = detailsHTML;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Update counter
    updateLightboxCounter();
}

// Close lightbox (optimized)
function closeLightbox(event) {
    const lightbox = document.getElementById('lightbox');
    
    // Check if click is on background or close button
    const shouldClose = event.target.id === 'lightbox' || 
                       event.target.classList.contains('lightbox-close') ||
                       event.target.classList.contains('lightbox-close-inline') ||
                       (event.target.closest && event.target.closest('.lightbox-close-inline'));
    
    if (shouldClose) {
        // Immediate visual feedback
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
        
        // Defer URL update to avoid blocking
        requestAnimationFrame(() => {
            const url = new URL(window.location);
            url.searchParams.delete('selection');
            window.history.replaceState({}, '', url);
        });
    }
}

// Toggle crush from lightbox
function toggleCrushLightbox(event) {
    event.stopPropagation();
    const lightboxImage = document.getElementById('lightbox-image');
    const filename = lightboxImage.src.split('/').pop();
    const isCrushed = crushManager.toggle(filename);
    
    // Update all crush buttons in lightbox
    const inlineBtn = document.querySelector('.lightbox-crush-inline');
    const ctaBtn = document.querySelector('.save-crush-cta');
    
    if (inlineBtn) {
        inlineBtn.classList.toggle('crushed', isCrushed);
    }
    
    if (ctaBtn) {
        ctaBtn.classList.toggle('crushed', isCrushed);
        ctaBtn.innerHTML = `
            <span class="material-icons" style="font-size: 1.5rem;">bolt</span>
            <span>${isCrushed ? 'Crush Saved!' : 'Save Crush'}</span>
        `;
    }
    
    updateCounts();
    
    // Update card buttons in gallery if visible
    const cardBtn = document.querySelector(`.crush-btn[onclick*="${filename}"]`);
    if (cardBtn) {
        cardBtn.classList.toggle('crushed', isCrushed);
    }
    
    if (currentTab === 'crushes') {
        filterAndRender();
    }
}

// Toggle lightbox tags visibility
function toggleLightboxTags() {
    const preview = document.getElementById('lightbox-tags-preview');
    const full = document.getElementById('lightbox-tags-full');
    const toggleBtn = document.getElementById('lightbox-tags-toggle');
    
    if (full.style.display === 'none') {
        // Show all tags
        preview.style.display = 'none';
        full.style.display = 'flex';
        toggleBtn.innerHTML = `
            <span class="material-icons">local_offer</span>
            <span>Show Less</span>
        `;
    } else {
        // Show preview (first 3)
        preview.style.display = 'flex';
        full.style.display = 'none';
        const remainingCount = full.querySelectorAll('.tag').length - preview.querySelectorAll('.tag').length;
        toggleBtn.innerHTML = `
            <span class="material-icons">local_offer</span>
            <span>View All (${remainingCount} more)</span>
        `;
    }
}

// Navigation debounce tracker
let navigationDebounce = null;

// Optimized lightbox navigation (no full reload)
function navigateLightbox(direction) {
    // Prevent rapid navigation
    if (navigationDebounce) return;
    
    navigationDebounce = setTimeout(() => {
        navigationDebounce = null;
    }, 200);
    
    const lightboxImage = document.getElementById('lightbox-image');
    const loadingOverlay = document.getElementById('lightbox-loading');
    const currentFilename = lightboxImage.src.split('/').pop();
    const currentIndex = currentItems.findIndex(item => item.filename === currentFilename);
    
    if (currentIndex === -1) return;
    
    // Calculate new index with wrapping
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = currentItems.length - 1;
    if (newIndex >= currentItems.length) newIndex = 0;
    
    const nextItem = currentItems[newIndex];
    
    // Show loading state
    lightboxImage.classList.add('loading');
    loadingOverlay.classList.remove('hidden');
    
    // Set up image load handler
    lightboxImage.onload = function() {
        lightboxImage.classList.remove('loading');
        loadingOverlay.classList.add('hidden');
    };
    
    // 1. Update image immediately
    lightboxImage.src = nextItem.filename;
    
    // 2. Update details (lightweight)
    updateLightboxDetails(nextItem);
    
    // 3. Preload adjacent images
    preloadAdjacentImages(newIndex);
    
    // 4. Update URL (defer to avoid blocking)
    requestAnimationFrame(() => {
        const url = new URL(window.location);
        url.searchParams.set('selection', nextItem.filename);
        window.history.replaceState({}, '', url);
    });
    
    // 5. Update counter
    updateLightboxCounter();
}

// Update lightbox details without full rebuild
function updateLightboxDetails(item) {
    const lightboxDetails = document.getElementById('lightbox-details');
    
    const job = item.job || {};
    const persona = job.persona || {};
    const hook = job.hook || {};
    const style = job.style || {};
    
    // Prepare tags section with truncation
    const allTags = item.tags || [];
    const displayTags = allTags.slice(0, 3);
    const remainingCount = allTags.length - 3;
    
    let tagsHTML = '';
    if (allTags.length > 0) {
        const tagsDisplay = displayTags.map(tag => `<span class="tag">${tag}</span>`).join('');
        const viewAllBtn = allTags.length > 3 
            ? `<button class="action-btn" onclick="toggleLightboxTags()" style="margin-top: 0.5rem;" id="lightbox-tags-toggle">
                <span class="material-icons">local_offer</span>
                <span>View All (${remainingCount} more)</span>
              </button>`
            : '';
        
        tagsHTML = `
        <div class="lightbox-section">
            <h3><span class="material-icons" style="font-size: 1rem; vertical-align: middle; margin-right: 0.25rem;">local_offer</span> Tags</h3>
            <div class="tags" id="lightbox-tags-preview">
                ${tagsDisplay}
            </div>
            <div class="tags" id="lightbox-tags-full" style="display: none;">
                ${allTags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
            ${viewAllBtn}
        </div>
        `;
    }
    
    // Crush button state
    const isCrushed = crushManager.isCrushed(item.filename);
    
    let detailsHTML = `
        <div class="lightbox-controls-inline">
            <button class="lightbox-nav-inline lightbox-nav-prev-inline" onclick="navigateLightbox(-1)" title="Previous">
                <span class="material-icons">chevron_left</span>
            </button>
            <button class="lightbox-nav-inline lightbox-nav-next-inline" onclick="navigateLightbox(1)" title="Next">
                <span class="material-icons">chevron_right</span>
            </button>
            <div class="lightbox-controls-spacer"></div>
            <button class="lightbox-crush-inline ${isCrushed ? 'crushed' : ''}" onclick="toggleCrushLightbox(event)" title="Crush">
                <span class="material-icons">bolt</span>
            </button>
            <button class="lightbox-close-inline" onclick="closeLightbox(event)" title="Close">
                <span class="material-icons">close</span>
            </button>
        </div>
        
        <h2>${formatText(item.persona)}</h2>
        
        <div class="lightbox-section">
            <h3><span class="material-icons" style="font-size: 1rem; vertical-align: middle; margin-right: 0.25rem;">gps_fixed</span> Hook</h3>
            <p>${hook.full_text || formatText(item.hook)}</p>
        </div>
        
        <div class="lightbox-section">
            <h3><span class="material-icons" style="font-size: 1rem; vertical-align: middle; margin-right: 0.25rem;">person</span> Target Audience</h3>
            <p>${persona.target || 'N/A'}</p>
        </div>
        
        <div class="lightbox-section">
            <h3><span class="material-icons" style="font-size: 1rem; vertical-align: middle; margin-right: 0.25rem;">lightbulb</span> Value Proposition</h3>
            <p>${persona.value_proposition || 'N/A'}</p>
        </div>
        
        <div class="lightbox-section">
            <h3><span class="material-icons" style="font-size: 1rem; vertical-align: middle; margin-right: 0.25rem;">campaign</span> Facebook Ad Copy</h3>
            <p>${item.fbCopy}</p>
        </div>
        
        <div class="lightbox-section">
            <h3><span class="material-icons" style="font-size: 1rem; vertical-align: middle; margin-right: 0.25rem;">palette</span> Style</h3>
            <p><strong>${style.full_name || formatText(item.style)}</strong></p>
            ${style.palette ? `<p><em>Palette:</em> ${style.palette}</p>` : ''}
        </div>
        
        ${tagsHTML}
        
        <button class="copy-btn" onclick="copyToClipboard(event, \`${item.fbCopy.replace(/`/g, '\\`')}\`)">
            <span class="material-icons" style="font-size: 1rem; margin-right: 0.5rem;">content_copy</span>
            Copy Facebook Text
        </button>
        
        <a href="${item.filename}" download="${item.filename}" class="download-btn">
            <span class="material-icons" style="font-size: 1.25rem; margin-right: 0.5rem;">download</span>
            Download Original PNG
        </a>
        
        <button class="save-crush-cta ${isCrushed ? 'crushed' : ''}" onclick="toggleCrushLightbox(event)">
            <span class="material-icons" style="font-size: 1.5rem;">bolt</span>
            <span>${isCrushed ? 'Crush Saved!' : 'Save Crush'}</span>
        </button>
    `;
    
    lightboxDetails.innerHTML = detailsHTML;
}

// Update lightbox counter
function updateLightboxCounter() {
    const lightboxImage = document.getElementById('lightbox-image');
    const currentFilename = lightboxImage.src.split('/').pop();
    const currentIndex = currentItems.findIndex(item => item.filename === currentFilename);
    const counter = document.getElementById('lightbox-counter');
    
    if (currentIndex !== -1 && counter) {
        counter.textContent = `${currentIndex + 1} of ${currentItems.length}`;
    }
}

// ESC key to close lightbox, Arrow keys to navigate
document.addEventListener('keydown', (e) => {
    const lightbox = document.getElementById('lightbox');
    const isLightboxActive = lightbox.classList.contains('active');
    
    if (!isLightboxActive) return;
    
    if (e.key === 'Escape') {
        closeLightbox({ target: { id: 'lightbox' } });
    } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateLightbox(-1);
    } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateLightbox(1);
    }
});

// Tab switching
let currentTab = 'all';

function switchTab(tab) {
    currentTab = tab;
    // Update both .tab and .top-tab classes
    document.querySelectorAll('.tab, .top-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });
    filterAndRender();
}

// Update counts
function updateCounts() {
    const crushedItems = crushManager.getAll();
    // Always show current filtered count for All tab
    const allCount = currentTab === 'crushes' ? allData.length : currentItems.length;
    document.getElementById('count-all').textContent = allCount;
    document.getElementById('count-crushes').textContent = crushedItems.length;
}

// Perfect mode state
let perfectModeActive = false;

function togglePerfectMode() {
    perfectModeActive = !perfectModeActive;
    const btn = document.getElementById('perfect-toggle');
    btn.classList.toggle('active', perfectModeActive);
    filterAndRender();
}

// Clear all filters function
function clearAllFilters() {
    // Clear search
    document.getElementById('search').value = '';
    
    // Clear all filter sets
    activeTagFilters.clear();
    activePersonaFilters.clear();
    activeHookFilters.clear();
    activeStyleFilters.clear();
    
    // Disable perfect mode
    perfectModeActive = false;
    const perfectBtn = document.getElementById('perfect-toggle');
    if (perfectBtn) {
        perfectBtn.classList.remove('active');
    }
    
    // Refresh gallery
    filterAndRender();
}

// Check if any filters are active
function hasActiveFilters() {
    return (
        document.getElementById('search').value.trim() !== '' ||
        activeTagFilters.size > 0 ||
        activePersonaFilters.size > 0 ||
        activeHookFilters.size > 0 ||
        activeStyleFilters.size > 0 ||
        perfectModeActive
    );
}

// Update Clear All button visibility
function updateClearAllButton() {
    const btn = document.getElementById('clear-all-filters');
    if (btn) {
        btn.style.display = hasActiveFilters() ? 'flex' : 'none';
    }
}

// Progressive loading state
const ITEMS_PER_PAGE = 12;
let currentItems = [];
let displayedCount = 0;
let viewMoreObserver = null;

// Filter and render
function filterAndRender() {
    const searchQuery = document.getElementById('search').value.trim();
    let items = allData;
    
    // Filter by tab
    if (currentTab === 'crushes') {
        const crushedFilenames = crushManager.getAll();
        items = items.filter(item => crushedFilenames.includes(item.filename));
    }
    
    // Filter by search
    if (searchQuery) {
        const results = fuseInstance.search(searchQuery);
        const resultFilenames = new Set(results.map(r => r.item.filename));
        items = items.filter(item => resultFilenames.has(item.filename));
    }
    
    // Reset progressive loading
    currentItems = items;
    displayedCount = 0;
    renderGalleryProgressive();
}

// Render gallery with progressive loading
function renderGalleryProgressive() {
    const gallery = document.getElementById('gallery');
    
    if (currentItems.length === 0) {
        const message = currentTab === 'crushes' 
            ? 'No crushes yet. Click the bolt icon on any ad to add it here!'
            : 'No ads found matching your search';
        gallery.innerHTML = `<div class="no-results">${message}</div>`;
        return;
    }
    
    // Calculate how many to show
    const nextCount = Math.min(displayedCount + ITEMS_PER_PAGE, currentItems.length);
    const itemsToShow = currentItems.slice(0, nextCount);
    
    // Render cards
    gallery.innerHTML = itemsToShow.map(item => createCard(item)).join('');
    displayedCount = nextCount;
    
    // Add View More button if there are more items
    if (displayedCount < currentItems.length) {
        const viewMoreContainer = document.createElement('div');
        viewMoreContainer.className = 'view-more-container';
        viewMoreContainer.id = 'view-more-container';
        
        const remaining = currentItems.length - displayedCount;
        viewMoreContainer.innerHTML = `
            <button class="view-more-btn" onclick="loadMoreItems()">
                View More (${remaining} remaining)
            </button>
        `;
        
        gallery.appendChild(viewMoreContainer);
        
        // Setup Intersection Observer for auto-load
        setupViewMoreObserver();
    }
}

// Load more items
function loadMoreItems() {
    renderGalleryProgressive();
}

// Setup Intersection Observer for View More button
function setupViewMoreObserver() {
    // Disconnect previous observer
    if (viewMoreObserver) {
        viewMoreObserver.disconnect();
    }
    
    const viewMoreContainer = document.getElementById('view-more-container');
    if (!viewMoreContainer) return;
    
    viewMoreObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && displayedCount < currentItems.length) {
                    // Auto-load when button enters viewport
                    loadMoreItems();
                }
            });
        },
        {
            rootMargin: '100px' // Trigger 100px before button enters viewport
        }
    );
    
    viewMoreObserver.observe(viewMoreContainer);
}

// Render gallery (legacy function for backward compatibility)
function renderGallery(items) {
    currentItems = items;
    displayedCount = 0;
    renderGalleryProgressive();
}

// Menu modal functions
function openMenu() {
    const modal = document.getElementById('menu-modal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeMenu(event) {
    if (event.target.id === 'menu-modal' || event.target.classList.contains('modal-close')) {
        const modal = document.getElementById('menu-modal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Asymmetric dynamic bar scroll-hide (50px down, 150px up)
let lastScrollTop = 0;
let scrollDirection = 0; // 1 = down, -1 = up
let scrollDistance = 0;
const SCROLL_THRESHOLD_DOWN = 50;
const SCROLL_THRESHOLD_UP = 150;
const dynamicBar = document.querySelector('.dynamic-control-bar');

window.addEventListener('scroll', () => {
    if (!dynamicBar) return;
    
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const delta = scrollTop - lastScrollTop;
    
    // Detect direction change
    if ((delta > 0 && scrollDirection < 0) || (delta < 0 && scrollDirection > 0)) {
        // Direction changed, reset distance
        scrollDistance = 0;
    }
    
    // Update direction
    scrollDirection = delta > 0 ? 1 : -1;
    
    // Accumulate distance
    scrollDistance += Math.abs(delta);
    
    // Apply asymmetric threshold
    if (scrollDirection > 0 && scrollDistance >= SCROLL_THRESHOLD_DOWN && scrollTop > 100) {
        // Scrolling down - hide dynamic bar (50px threshold)
        dynamicBar.style.transform = 'translateY(-100%)';
        dynamicBar.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        scrollDistance = 0;
    } else if (scrollDirection < 0 && scrollDistance >= SCROLL_THRESHOLD_UP) {
        // Scrolling up - show dynamic bar (150px threshold)
        dynamicBar.style.transform = 'translateY(0)';
        dynamicBar.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        scrollDistance = 0;
    }
    
    // Always show dynamic bar at top
    if (scrollTop <= 100) {
        dynamicBar.style.transform = 'translateY(0)';
        scrollDistance = 0;
    }
    
    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
}, { passive: true });

// Initialize gallery
let fuseInstance = null;
let allData = [];

async function initGallery() {
    try {
        allData = await loadGalleryData();
        
        // Initialize Fuse.js with very strict fuzzy search (optimized for rich visual tags)
        fuseInstance = new Fuse(allData, {
            keys: [
                { name: 'persona', weight: 2 },
                { name: 'hook', weight: 2 },
                { name: 'style', weight: 1.5 },
                { name: 'tags', weight: 1.5 },
                { name: 'fbCopy', weight: 1 },
                { name: 'prompt', weight: 0.5 }
            ],
            threshold: 0.08,  // Very strict - requires 92%+ similarity (was 0.15)
            distance: 35,     // Very tight proximity - matches must be very close (was 50)
            ignoreLocation: true,
            minMatchCharLength: 4,  // Require at least 4 chars to prevent short word noise (was 3)
            shouldSort: true,
            includeScore: true
        });
        
        // Initialize currentItems before calling updateCounts
        currentItems = allData;
        updateCounts();
        renderGallery(allData);
        renderMetadataFilters();  // Initialize metadata filters
        renderTagPills();  // Fix: Initialize hero card after gallery loads
        
        // Setup search
        const searchInput = document.getElementById('search');
        const searchClear = document.getElementById('search-clear');
        const headerToolbar = document.querySelector('.header-toolbar');
        let debounceTimer;
        
        // Update clear button visibility
        function updateClearButton() {
            if (searchInput.value.trim()) {
                searchClear.classList.add('visible');
            } else {
                searchClear.classList.remove('visible');
            }
        }
        
        searchInput.addEventListener('input', (e) => {
            updateClearButton();
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                filterAndRender();
            }, 200);
        });
        
        // Auto-collapse hero when typing in search (hero is now static)
        searchInput.addEventListener('focus', () => {
            headerToolbar.classList.add('search-focused');
        });
        
        // Clear button click
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            updateClearButton();
            searchInput.focus();
            filterAndRender();
        });
        
        searchInput.addEventListener('blur', () => {
            headerToolbar.classList.remove('search-focused');
        });
        
        // Initialize clear button state
        updateClearButton();
        
        // Check for permalink on page load
        const urlParams = new URLSearchParams(window.location.search);
        const selection = urlParams.get('selection');
        if (selection) {
            // Wait a moment for everything to load
            setTimeout(() => openLightbox(selection), 100);
        }
        
    } catch (error) {
        console.error('Failed to initialize gallery:', error);
        document.getElementById('gallery').innerHTML = 
            '<div class="no-results">Failed to load gallery. Check console for errors.</div>';
    }
}

// Hero card is now simplified (no toggle functionality needed)

// Tag filtering state
let activeTagFilters = new Set();
let tagsChart = null;

// NEW: Metadata filtering state (Personas, Hooks, Styles)
let activePersonaFilters = new Set();
let activeHookFilters = new Set();
let activeStyleFilters = new Set();

// Extract aspect ratio from job data
function getAspectRatio() {
    const jobData = window.JOB_DATA || {};
    
    // Try direct aspect_ratio field first (new format)
    const directRatio = jobData.generation_params?.aspect_ratio;
    if (directRatio) {
        return directRatio;
    }
    
    // Fallback: parse from ad_format string (backward compatibility)
    const adFormat = jobData.generation_params?.ad_format || "";
    const match = adFormat.match(/(\d+:\d+)/);
    return match ? match[1] : "1:1";
}

// Get unique personas, hooks, styles from all items
function getUniqueMetadata(items) {
    const personas = new Map(); // Use Map to preserve case
    const hooks = new Map();
    const styles = new Map();
    
    items.forEach(item => {
        const personaKey = item.persona.toLowerCase();
        const hookKey = item.hook.toLowerCase();
        const styleKey = item.style.toLowerCase();
        
        if (!personas.has(personaKey)) {
            personas.set(personaKey, { display: formatText(item.persona), count: 0 });
        }
        personas.get(personaKey).count++;
        
        if (!hooks.has(hookKey)) {
            hooks.set(hookKey, { display: formatText(item.hook), count: 0 });
        }
        hooks.get(hookKey).count++;
        
        if (!styles.has(styleKey)) {
            styles.set(styleKey, { display: formatText(item.style), count: 0 });
        }
        styles.get(styleKey).count++;
    });
    
    return {
        personas: Array.from(personas.values()),
        hooks: Array.from(hooks.values()),
        styles: Array.from(styles.values())
    };
}

// Get top tags from current items with stopword filtering and proper deduplication
function getTopTags(items, limit = 15) {
    const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'with', 'from', 'to', 'for', 'of', 'in', 'on', 'at',
        'by', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
        'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must',
        'this', 'that', 'these', 'those', 'it', 'its', 'which', 'who', 'what', 'where', 'when'
    ]);
    
    // Use normalized keys for deduplication, but keep original casing for display
    const tagCounts = {};
    const tagDisplay = {}; // Maps normalized key to display version
    
    items.forEach(item => {
        const seenInItem = new Set(); // Dedupe within same item
        (item.tags || []).forEach(tag => {
            const normalized = tag.toLowerCase().trim();
            if (!stopWords.has(normalized) && normalized.length > 2 && !seenInItem.has(normalized)) {
                seenInItem.add(normalized);
                tagCounts[normalized] = (tagCounts[normalized] || 0) + 1;
                // Keep first occurrence's casing for display
                if (!tagDisplay[normalized]) {
                    tagDisplay[normalized] = tag;
                }
            }
        });
    });
    
    return Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([normalizedTag, count]) => ({ 
            tag: tagDisplay[normalizedTag], 
            count 
        }));
}

// Render metadata filter pills in modal (Personas, Hooks, Styles)
function renderMetadataFilters() {
    const metadata = getUniqueMetadata(allData); // Use all data, not filtered
    
    // Render Personas (in modal)
    const personaContainer = document.getElementById('modal-persona-pills-list');
    if (personaContainer && metadata.personas.length > 0) {
        const personaPills = metadata.personas.map(({ display, count }) => {
            const isActive = activePersonaFilters.has(display);
            return `
                <button class="tag-pill ${isActive ? 'active' : ''}" onclick="togglePersonaFilter('${display}')">
                    ${display}
                    <span class="tag-pill-count">${count}</span>
                </button>
            `;
        }).join('');
        personaContainer.innerHTML = personaPills;
    } else if (personaContainer) {
        personaContainer.innerHTML = '<p style="color: var(--text-light); font-size: 0.75rem;">No personas</p>';
    }
    
    // Render Hooks (in modal)
    const hookContainer = document.getElementById('modal-hook-pills-list');
    if (hookContainer && metadata.hooks.length > 0) {
        const hookPills = metadata.hooks.map(({ display, count }) => {
            const isActive = activeHookFilters.has(display);
            return `
                <button class="tag-pill ${isActive ? 'active' : ''}" onclick="toggleHookFilter('${display}')">
                    ${display}
                    <span class="tag-pill-count">${count}</span>
                </button>
            `;
        }).join('');
        hookContainer.innerHTML = hookPills;
    } else if (hookContainer) {
        hookContainer.innerHTML = '<p style="color: var(--text-light); font-size: 0.75rem;">No hooks</p>';
    }
    
    // Render Styles (in modal)
    const styleContainer = document.getElementById('modal-style-pills-list');
    if (styleContainer && metadata.styles.length > 0) {
        const stylePills = metadata.styles.map(({ display, count }) => {
            const isActive = activeStyleFilters.has(display);
            return `
                <button class="tag-pill ${isActive ? 'active' : ''}" onclick="toggleStyleFilter('${display}')">
                    ${display}
                    <span class="tag-pill-count">${count}</span>
                </button>
            `;
        }).join('');
        styleContainer.innerHTML = stylePills;
    } else if (styleContainer) {
        styleContainer.innerHTML = '<p style="color: var(--text-light); font-size: 0.75rem;">No styles</p>';
    }
    
    // Update clear button visibility in modal
    const totalActive = activePersonaFilters.size + activeHookFilters.size + activeStyleFilters.size;
    const clearBtn = document.getElementById('modal-clear-filters-btn');
    if (clearBtn) {
        clearBtn.style.display = totalActive > 0 ? 'flex' : 'none';
    }
}

// Render tag pills
function renderTagPills() {
    const topTags = getTopTags(currentItems, 12);
    const container = document.getElementById('tag-pills-list');
    
    if (topTags.length === 0) {
        container.innerHTML = '<p style="color: var(--text-light); padding: 0.5rem;">No tags available</p>';
        return;
    }
    
    const pillsHTML = topTags.map(({ tag, count }) => {
        const isActive = activeTagFilters.has(tag);
        return `
            <button class="tag-pill ${isActive ? 'active' : ''}" onclick="toggleTagFilter('${tag}')">
                ${tag}
                <span class="tag-pill-count">${count}</span>
            </button>
        `;
    }).join('');
    
    const clearBtn = activeTagFilters.size > 0 
        ? '<button class="clear-filters-btn" onclick="clearTagFilters()">Clear Filters <span class="material-icons" style="font-size: 0.875rem; vertical-align: middle;">close</span></button>'
        : '';
    
    // NEW: Add "View All Tags" button
    const viewAllBtn = '<button class="action-btn" onclick="openAllTagsModal()" style="margin-left: 0.5rem;" title="View All Tags"><span class="material-icons">local_offer</span> View All</button>';
    
    container.innerHTML = pillsHTML + clearBtn + viewAllBtn;
    updateHeroAnalytics();
}

// Toggle metadata filters
function togglePersonaFilter(persona) {
    if (activePersonaFilters.has(persona)) {
        activePersonaFilters.delete(persona);
    } else {
        activePersonaFilters.add(persona);
    }
    filterAndRender();
}

function toggleHookFilter(hook) {
    if (activeHookFilters.has(hook)) {
        activeHookFilters.delete(hook);
    } else {
        activeHookFilters.add(hook);
    }
    filterAndRender();
}

function toggleStyleFilter(style) {
    if (activeStyleFilters.has(style)) {
        activeStyleFilters.delete(style);
    } else {
        activeStyleFilters.add(style);
    }
    filterAndRender();
}

function clearMetadataFilters() {
    activePersonaFilters.clear();
    activeHookFilters.clear();
    activeStyleFilters.clear();
    filterAndRender();
}

// Open All Tags Modal
function openAllTagsModal() {
    const modal = document.getElementById('all-tags-modal');
    const allTagsList = document.getElementById('all-tags-list');
    const tagsSearchInput = document.getElementById('tags-modal-search');
    
    // Get ALL tags with counts (not just top 12)
    const allTagsWithCounts = getTopTags(currentItems, 1000); // Get up to 1000 tags
    
    // Store for search filtering
    window.allTagsData = allTagsWithCounts;
    
    // Render all tags
    renderAllTagsList(allTagsWithCounts);
    
    // Setup search
    tagsSearchInput.value = '';
    tagsSearchInput.oninput = (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (query === '') {
            renderAllTagsList(window.allTagsData);
        } else {
            const filtered = window.allTagsData.filter(({tag}) => 
                tag.toLowerCase().includes(query)
            );
            renderAllTagsList(filtered);
        }
    };
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Render tags list in modal
function renderAllTagsList(tagsData) {
    const container = document.getElementById('all-tags-list');
    
    if (tagsData.length === 0) {
        container.innerHTML = '<p style="color: var(--text-light); padding: 1rem; grid-column: 1/-1; text-align: center;">No tags found</p>';
        return;
    }
    
    const html = tagsData.map(({ tag, count }) => {
        const isActive = activeTagFilters.has(tag);
        return `
            <button class="tag-pill ${isActive ? 'active' : ''}" 
                    onclick="toggleTagFilterFromModal('${tag}')" 
                    style="width: 100%; justify-content: space-between;">
                <span>${tag}</span>
                <span class="tag-pill-count">${count}</span>
            </button>
        `;
    }).join('');
    
    container.innerHTML = html;
}

// Toggle tag filter from modal (keeps modal open)
function toggleTagFilterFromModal(tag) {
    toggleTagFilter(tag);
    // Update the modal display to show active state
    renderAllTagsList(window.allTagsData);
}

// Close All Tags Modal
function closeAllTagsModal(event) {
    if (event.target.id === 'all-tags-modal' || event.target.classList.contains('modal-close')) {
        const modal = document.getElementById('all-tags-modal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Toggle tag filter
function toggleTagFilter(tag) {
    if (activeTagFilters.has(tag)) {
        activeTagFilters.delete(tag);
    } else {
        activeTagFilters.add(tag);
    }
    filterAndRender();
}

// Clear all tag filters
function clearTagFilters() {
    activeTagFilters.clear();
    filterAndRender();
}

// Open styles modal
function openStylesModal() {
    const jobData = window.JOB_DATA || {};
    const styles = jobData.styles || [];
    
    if (styles.length === 0) {
        alert('No styles data available');
        return;
    }
    
    const modalBody = document.getElementById('styles-modal-body');
    const html = styles.map(s => `
        <div class="detail-card">
            <h3>${s.name || 'Untitled Style'}</h3>
            ${s.palette ? `<p><strong>Palette:</strong> ${s.palette}</p>` : ''}
            ${s.visual_cues ? `<p><strong>Visual Cues:</strong> ${s.visual_cues}</p>` : ''}
            ${s.notes ? `<p><strong>Notes:</strong> ${s.notes}</p>` : ''}
        </div>
    `).join('');
    
    modalBody.innerHTML = html;
    document.getElementById('styles-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeStylesModal(event) {
    if (event.target.id === 'styles-modal' || event.target.classList.contains('modal-close')) {
        document.getElementById('styles-modal').classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Open personas modal
function openPersonasModal() {
    const jobData = window.JOB_DATA || {};
    const personas = jobData.personas || [];
    
    if (personas.length === 0) {
        alert('No personas data available');
        return;
    }
    
    const modalBody = document.getElementById('personas-modal-body');
    const html = personas.map(p => `
        <div class="detail-card">
            <h3>${p.persona || 'Untitled Persona'}</h3>
            ${p.target ? `<p><strong>Target:</strong> ${p.target}</p>` : ''}
            ${p.primary_pain_point ? `<p><strong>Pain Point:</strong> ${p.primary_pain_point}</p>` : ''}
            ${p.value_proposition ? `<p><strong>Value Proposition:</strong> ${p.value_proposition}</p>` : ''}
            ${p.hooks && p.hooks.length > 0 ? `
                <p><strong>Hooks:</strong></p>
                <ul>
                    ${p.hooks.map(h => `<li>${h}</li>`).join('')}
                </ul>
            ` : ''}
        </div>
    `).join('');
    
    modalBody.innerHTML = html;
    document.getElementById('personas-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closePersonasModal(event) {
    if (event.target.id === 'personas-modal' || event.target.classList.contains('modal-close')) {
        document.getElementById('personas-modal').classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Open hooks modal
function openHooksModal() {
    const jobData = window.JOB_DATA || {};
    const personas = jobData.personas || [];
    
    if (personas.length === 0) {
        alert('No hooks data available');
        return;
    }
    
    // Collect all hooks from all personas
    const allHooks = [];
    personas.forEach(p => {
        const personaName = p.persona || 'Unknown Persona';
        (p.hooks || []).forEach(hook => {
            allHooks.push({ persona: personaName, hook: hook });
        });
    });
    
    if (allHooks.length === 0) {
        alert('No hooks data available');
        return;
    }
    
    const modalBody = document.getElementById('hooks-modal-body');
    const html = allHooks.map(item => `
        <div class="detail-card">
            <h3>${item.persona}</h3>
            <p>${item.hook}</p>
        </div>
    `).join('');
    
    modalBody.innerHTML = html;
    document.getElementById('hooks-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeHooksModal(event) {
    if (event.target.id === 'hooks-modal' || event.target.classList.contains('modal-close')) {
        document.getElementById('hooks-modal').classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Update hero analytics (simplified - hero card no longer has filter info or chart)
function updateHeroAnalytics() {
    // Update stats
    const projectName = window.PROJECT_NAME || 'Ad Gallery';
    const jobData = window.JOB_DATA || {};
    const genParams = jobData.generation_params || {};
    
    // Populate dynamic control bar (consolidated header)
    const dynamicProjectName = document.getElementById('dynamic-project-name');
    if (dynamicProjectName) {
        dynamicProjectName.textContent = projectName;
    }
    
    // Build stats with clickable chips if job metadata available
    let statsHTML = `${allData.length} total ads generated`;
    if (genParams.n_styles || genParams.n_personas) {
        const chips = [];
        
        if (genParams.n_styles) {
            chips.push(`<button class="stat-chip" onclick="openStylesModal()">${genParams.n_styles} style${genParams.n_styles > 1 ? 's' : ''}</button>`);
        }
        
        if (genParams.n_personas) {
            chips.push(`<button class="stat-chip" onclick="openPersonasModal()">${genParams.n_personas} persona${genParams.n_personas > 1 ? 's' : ''}</button>`);
        }
        
        if (genParams.hooks_per_persona) {
            const totalHooks = (genParams.n_personas || 0) * (genParams.hooks_per_persona || 0);
            chips.push(`<button class="stat-chip" onclick="openHooksModal()">${totalHooks} hook${totalHooks > 1 ? 's' : ''}</button>`);
        }
        
        if (jobData.timestamp) {
            const date = new Date(jobData.timestamp_iso || jobData.timestamp);
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            chips.push(`<span class="stat-text">Generated ${dateStr}</span>`);
        }
        
        statsHTML = chips.join(' <span class="stat-separator">•</span> ');
    }
    
    const dynamicStats = document.getElementById('dynamic-stats');
    if (dynamicStats) {
        dynamicStats.innerHTML = statsHTML;
    }
}

// Update tags chart (removed - chart no longer exists in simplified hero card)
function updateTagsChart() {
    // Chart removed from simplified hero card
    return;
}

// Update filter and render to include tag filters AND metadata filters AND perfect mode
const originalFilterAndRender = filterAndRender;
filterAndRender = function() {
    const searchQuery = document.getElementById('search').value.trim();
    let items = allData;
    
    // Filter by tab
    if (currentTab === 'crushes') {
        const crushedFilenames = crushManager.getAll();
        items = items.filter(item => crushedFilenames.includes(item.filename));
    }
    
    // Filter by Perfect mode (hide items with typos)
    if (perfectModeActive) {
        items = items.filter(item => {
            const hasTypo = item.tags.some(tag => 
                tag.toLowerCase().includes('text_typo_detected') || 
                tag.toLowerCase().includes('typo:')
            );
            return !hasTypo;
        });
    }
    
    // Filter by search
    if (searchQuery) {
        const results = fuseInstance.search(searchQuery);
        const resultFilenames = new Set(results.map(r => r.item.filename));
        items = items.filter(item => resultFilenames.has(item.filename));
    }
    
    // Filter by metadata (Multi-select OR logic within each category)
    if (activePersonaFilters.size > 0) {
        items = items.filter(item => {
            const itemPersona = formatText(item.persona);
            return Array.from(activePersonaFilters).some(persona => persona === itemPersona);
        });
    }
    
    if (activeHookFilters.size > 0) {
        items = items.filter(item => {
            const itemHook = formatText(item.hook);
            return Array.from(activeHookFilters).some(hook => hook === itemHook);
        });
    }
    
    if (activeStyleFilters.size > 0) {
        items = items.filter(item => {
            const itemStyle = formatText(item.style);
            return Array.from(activeStyleFilters).some(style => style === itemStyle);
        });
    }
    
    // Filter by active tags (AND logic)
    if (activeTagFilters.size > 0) {
        items = items.filter(item => {
            const itemTags = new Set(item.tags.map(t => t.toLowerCase()));
            return Array.from(activeTagFilters).every(tag => 
                itemTags.has(tag.toLowerCase())
            );
        });
    }
    
    // Reset progressive loading
    currentItems = items;
    displayedCount = 0;
    renderGalleryProgressive();
    renderMetadataFilters();  // Update metadata filter counts
    renderTagPills();
    updateCounts(); // Update tab counts
    updateClearAllButton(); // Update Clear All button visibility
};

// Batch Download Modal
function openBatchDownloadModal() {
    if (currentItems.length === 0) {
        alert('No images to download in current view!');
        return;
    }
    
    const modal = document.getElementById('batch-download-modal');
    const count = document.getElementById('batch-download-count');
    const filters = document.getElementById('batch-download-filters');
    
    // Update count
    count.textContent = currentItems.length;
    
    // Build filter description
    const filterInfo = [];
    if (currentTab === 'crushes') {
        filterInfo.push('Crushes Only');
    }
    if (perfectModeActive) {
        filterInfo.push('Perfect Mode (no typos)');
    }
    if (document.getElementById('search').value.trim()) {
        filterInfo.push('Search: "' + document.getElementById('search').value.trim() + '"');
    }
    if (activeTagFilters.size > 0) {
        filterInfo.push(`${activeTagFilters.size} tag filter(s)`);
    }
    if (activePersonaFilters.size + activeHookFilters.size + activeStyleFilters.size > 0) {
        filterInfo.push('Generation filters active');
    }
    
    filters.textContent = filterInfo.length > 0 ? filterInfo.join(' • ') : 'All ads';
    
    // Open modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeBatchDownloadModal(event) {
    if (event.target.id === 'batch-download-modal' || event.target.classList.contains('modal-close')) {
        document.getElementById('batch-download-modal').classList.remove('active');
        document.body.style.overflow = '';
    }
}

function startBatchDownload() {
    const itemsToDownload = currentItems; // Download ALL items, not just 50
    
    if (itemsToDownload.length === 0) {
        alert('No images to download in current view!');
        return;
    }
    
    // Check if we're on file:// protocol (local)
    const isLocal = window.location.protocol === 'file:';
    
    let message = `Download ${itemsToDownload.length} image(s) from current view?\n\n`;
    if (isLocal) {
        message += '⚠️ Note: Batch download has limitations when viewing locally (file://).\n';
        message += 'For best results, publish to GitHub Pages or a web server.\n\n';
        message += 'Locally, you may need to manually allow each download in your browser.\n';
    } else {
        message += 'Files will download one by one with a small delay between each.\n';
    }
    
    const confirmation = confirm(message);
    if (!confirmation) return;
    
    let downloaded = 0;
    let failed = 0;
    
    // Try to download each file
    itemsToDownload.forEach((item, idx) => {
        setTimeout(() => {
            try {
                const a = document.createElement('a');
                a.href = item.filename;
                a.download = item.filename.split('/').pop(); // Just the filename
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                downloaded++;
            } catch (error) {
                console.error(`Failed to download ${item.filename}:`, error);
                failed++;
            }
            
            // Show summary after last item
            if (idx === itemsToDownload.length - 1) {
                setTimeout(() => {
                    if (isLocal) {
                        alert(
                            `Download initiated for ${downloaded} file(s).\n\n` +
                            `If downloads were blocked:\n` +
                            `1. Check your browser's download permissions\n` +
                            `2. Look for a browser notification to allow downloads\n` +
                            `3. Or publish to GitHub Pages for seamless downloads`
                        );
                    } else {
                        alert(`Successfully initiated ${downloaded} download(s)!`);
                    }
                }, 1000);
            }
        }, idx * 500); // 500ms delay between downloads
    });
    
    // Close modal after initiating downloads
    closeBatchDownloadModal({ target: { id: 'batch-download-modal' } });
}

// Open Generation Filters Modal
function openGenerationFiltersModal() {
    const modal = document.getElementById('generation-filters-modal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Populate filters
    renderMetadataFilters();
}

// Close Generation Filters Modal
function closeGenerationFiltersModal(event) {
    if (event.target.id === 'generation-filters-modal' || event.target.classList.contains('modal-close')) {
        const modal = document.getElementById('generation-filters-modal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Apply Generation Filters (apply filters and close modal)
function applyGenerationFilters(event) {
    if (event) {
        event.stopPropagation();
    }
    
    // Apply filters to gallery
    filterAndRender();
    
    // Close modal
    const modal = document.getElementById('generation-filters-modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// New menu system functions
function openMenu() {
    // Update crushes count in menu before opening
    const crushesCount = crushManager.getAll().length;
    document.getElementById('menu-crushes-count').textContent = crushesCount;
    
    // Update download counts
    document.getElementById('menu-download-all-count').textContent = currentItems.length;
    document.getElementById('menu-download-crushes-count').textContent = crushesCount;
    
    const modal = document.getElementById('menu-modal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Toggle download submenu
function toggleDownloadSubmenu(event) {
    event.stopPropagation();
    const submenu = document.getElementById('download-submenu');
    const parent = submenu.closest('.menu-option-expandable');
    
    // Toggle collapsed class
    submenu.classList.toggle('collapsed');
    parent.classList.toggle('expanded');
}

// Download all from menu
function downloadAllFromMenu() {
    // Close menu
    closeMenu({ target: { id: 'menu-modal' } });
    
    // Small delay to let modal close smoothly
    setTimeout(() => {
        openBatchDownloadModal();
    }, 200);
}

// Download crushes from menu
function downloadCrushesFromMenu() {
    const crushesCount = crushManager.getAll().length;
    
    if (crushesCount === 0) {
        alert('No crushes yet! Click the bolt icon on any ad to add it to your favorites.');
        return;
    }
    
    // Close menu
    closeMenu({ target: { id: 'menu-modal' } });
    
    // Small delay, then switch to crushes tab and open download modal
    setTimeout(() => {
        // Switch to crushes tab
        switchTab('crushes');
        
        // Wait for tab to update, then open download
        setTimeout(() => {
            openBatchDownloadModal();
        }, 100);
    }, 200);
}

function openAboutModal() {
    closeMenu({ target: { id: 'menu-modal' } });
    document.getElementById('about-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeAboutModal(event) {
    if (event.target.id === 'about-modal' || event.target.classList.contains('modal-close')) {
        document.getElementById('about-modal').classList.remove('active');
        document.body.style.overflow = '';
    }
}

function openViewConfigModal() {
    closeMenu({ target: { id: 'menu-modal' } });
    const modal = document.getElementById('view-config-modal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Load brand config by default
    switchConfigTab('brand');
}

function closeViewConfigModal(event) {
    if (event.target.id === 'view-config-modal' || event.target.classList.contains('modal-close')) {
        document.getElementById('view-config-modal').classList.remove('active');
        document.body.style.overflow = '';
    }
}

function switchConfigTab(configType) {
    // Update active tab
    document.querySelectorAll('#view-config-modal .config-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.config === configType);
    });
    
    // Load config content
    const viewer = document.getElementById('config-viewer');
    const configFiles = window.JOB_DATA?.config_files || {};
    viewer.value = configFiles[configType] || `# ${configType}.txt not available`;
}

function openRequestDeckModal() {
    closeMenu({ target: { id: 'menu-modal' } });
    const modal = document.getElementById('request-deck-modal');
    const modalBody = modal.querySelector('.modal-body');
    
    // Show modal with loading state
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Add loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'request-modal-loading';
    loadingOverlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(24, 24, 27, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        border-radius: 12px;
    `;
    loadingOverlay.innerHTML = `
        <div style="text-align: center; color: #a1a1aa;">
            <div style="width: 48px; height: 48px; border: 4px solid #27272a; border-top-color: #6366f1; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
            <p>Loading configuration...</p>
        </div>
        <style>
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        </style>
    `;
    modalBody.style.position = 'relative';
    modalBody.appendChild(loadingOverlay);
    
    // Use requestAnimationFrame + setTimeout for guaranteed rendering
    requestAnimationFrame(() => {
        setTimeout(() => {
            try {
                // Pre-fill project name
                const projectInput = document.getElementById('request-project-name');
                if (projectInput) {
                    projectInput.value = window.PROJECT_NAME || '';
                }
                
                // Load config files for editing
                const configFiles = window.JOB_DATA?.config_files || {};
                
                window.requestConfigs = {
                    brand: configFiles.brand || '',
                    personas: configFiles.personas || '',
                    styles: configFiles.styles || '',
                    overlays: configFiles.overlays || ''
                };
                
                // Now that data is ready, load brand config
                const editor = document.getElementById('request-config-editor');
                if (editor) {
                    // Set initial value
                    editor.value = window.requestConfigs.brand || '';
                    
                    // Set active tab
                    const activeTypeInput = document.getElementById('active-config-type');
                    if (activeTypeInput) {
                        activeTypeInput.value = 'brand';
                    }
                    
                    // Ensure brand tab is active
                    document.querySelectorAll('#request-batch-modal .config-tab').forEach(tab => {
                        tab.classList.toggle('active', tab.dataset.config === 'brand');
                    });
                }
                
                // Calculate initial total
                calculateTotal();
                
                // Setup email caching
                setupEmailCaching('request-email');
                
                // Remove loading overlay
                if (loadingOverlay && loadingOverlay.parentNode) {
                    loadingOverlay.parentNode.removeChild(loadingOverlay);
                }
            } catch (error) {
                console.error('Error loading request modal:', error);
                // Remove loading overlay even on error
                if (loadingOverlay && loadingOverlay.parentNode) {
                    loadingOverlay.parentNode.removeChild(loadingOverlay);
                }
                alert('Error loading configuration. Please try again.');
            }
        }, 100); // 100ms delay to ensure full render
    });
}

function closeRequestDeckModal(event) {
    if (event.target.id === 'request-deck-modal' || event.target.classList.contains('modal-close')) {
        document.getElementById('request-deck-modal').classList.remove('active');
        document.body.style.overflow = '';
    }
}

function switchRequestConfigTab(event, configType) {
    if (event) {
        event.preventDefault();
    }
    
    // Save current config content (only if there's a current type)
    const editor = document.getElementById('request-config-editor');
    const currentType = document.getElementById('active-config-type').value;
    
    // Only save if we have a valid current type (not first load)
    if (currentType && window.requestConfigs) {
        window.requestConfigs[currentType] = editor.value;
    }
    
    // Update active tab
    document.querySelectorAll('#request-deck-modal .config-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.config === configType);
    });
    
    // Load new config content
    editor.value = window.requestConfigs[configType] || '';
    document.getElementById('active-config-type').value = configType;
}

function calculateTotal() {
    const personas = parseInt(document.getElementById('num-personas').value) || 0;
    const styles = parseInt(document.getElementById('num-styles').value) || 0;
    const perCombo = parseInt(document.getElementById('images-per-combo').value) || 0;
    const total = personas * styles * perCombo;
    document.getElementById('total-images').textContent = total;
}

function toggleConfigPanel() {
    const panel = document.getElementById('config-panel');
    const toggleBtn = document.querySelector('.config-toggle-btn');
    
    if (panel.classList.contains('collapsed')) {
        // Expand
        panel.classList.remove('collapsed');
        toggleBtn.classList.add('expanded');
    } else {
        // Collapse
        panel.classList.add('collapsed');
        toggleBtn.classList.remove('expanded');
    }
}

function openShareCrushesModal() {
    closeMenu({ target: { id: 'menu-modal' } });
    const modal = document.getElementById('share-crushes-modal');
    const crushes = crushManager.getAll();
    
    // Check if there are any crushes
    if (crushes.length === 0) {
        document.getElementById('share-crushes-empty').style.display = 'block';
        document.getElementById('share-crushes-form').style.display = 'none';
    } else {
        document.getElementById('share-crushes-empty').style.display = 'none';
        document.getElementById('share-crushes-form').style.display = 'block';
        
        // Update count
        document.getElementById('share-crushes-total').textContent = crushes.length;
        document.getElementById('share-crushes-count-field').value = crushes.length;
        
        // Populate list
        const listHTML = crushes.map(filename => 
            `<div>• ${filename}</div>`
        ).join('');
        document.getElementById('share-crushes-list').innerHTML = listHTML;
        
        // Set hidden field with JSON array
        document.getElementById('share-crushes-data').value = JSON.stringify(crushes);
        
        // Pre-fill project name
        document.getElementById('share-project-name').value = window.PROJECT_NAME || '';
        
        // Setup email caching
        setupEmailCaching('share-email');
    }
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeShareCrushesModal(event) {
    if (event.target.id === 'share-crushes-modal' || event.target.classList.contains('modal-close')) {
        document.getElementById('share-crushes-modal').classList.remove('active');
        document.body.style.overflow = '';
    }
}

async function submitShareCrushes(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('.submit-btn');
    
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-icons">hourglass_empty</span> Sending...';
    
    // Prepare form data
    const formData = new FormData(form);
    
    try {
        // Submit to Formspree
        const response = await fetch('https://formspree.io/f/mzzjnoaw', {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            // Success
            alert('✅ Crushes shared successfully!\n\nYou\'ll receive an email with your favorite ads.');
            closeShareCrushesModal({ target: { id: 'share-crushes-modal' } });
            form.reset();
        } else {
            throw new Error('Submission failed');
        }
    } catch (error) {
        console.error('Form submission error:', error);
        alert('❌ Failed to share crushes. Please try again or contact hassan@waken.ai directly.');
    } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-icons">send</span> Share Crushes';
    }
}

async function submitDeckRequest(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('.submit-btn');
    
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-icons">hourglass_empty</span> Submitting...';
    
    // Save all config edits to hidden fields
    const editor = document.getElementById('request-config-editor');
    const currentType = document.getElementById('active-config-type').value;
    window.requestConfigs[currentType] = editor.value;
    
    document.getElementById('brand-config-hidden').value = window.requestConfigs.brand || '';
    document.getElementById('personas-config-hidden').value = window.requestConfigs.personas || '';
    document.getElementById('styles-config-hidden').value = window.requestConfigs.styles || '';
    document.getElementById('overlays-config-hidden').value = window.requestConfigs.overlays || '';
    
    // Prepare form data
    const formData = new FormData(form);
    
    try {
        // Submit to Formspree
        const response = await fetch('https://formspree.io/f/mzzjnoaw', {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            // Success
            alert('✅ Deck request submitted successfully!\n\nWe\'ll review your request and get back to you soon.');
            closeRequestDeckModal({ target: { id: 'request-deck-modal' } });
            form.reset();
            calculateTotal();
        } else {
            throw new Error('Submission failed');
        }
    } catch (error) {
        console.error('Form submission error:', error);
        alert('❌ Failed to submit request. Please try again or contact hassan@waken.ai directly.');
    } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-icons">rocket_launch</span> Submit Batch Request';
    }
}

// Browse Index Modal Functions
function openBrowseIndexModal() {
    const modal = document.getElementById('browse-index-modal');
    renderBrowseIndex();
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeBrowseIndexModal(event) {
    if (event.target.id === 'browse-index-modal' || event.target.classList.contains('modal-close')) {
        const modal = document.getElementById('browse-index-modal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function renderBrowseIndex() {
    // Get unique values with best representative image
    const personasMap = new Map();
    const hooksMap = new Map();
    const stylesMap = new Map();
    
    allData.forEach(item => {
        const personaKey = item.persona.toLowerCase();
        const hookKey = item.hook.toLowerCase();
        const styleKey = item.style.toLowerCase();
        
        // For personas: use first occurrence
        if (!personasMap.has(personaKey)) {
            personasMap.set(personaKey, {
                display: formatText(item.persona),
                thumbnail: item.thumbnail,
                count: 0
            });
        }
        personasMap.get(personaKey).count++;
        
        // For hooks: collect thumbnails where filename actually contains this hook slug
        if (!hooksMap.has(hookKey)) {
            hooksMap.set(hookKey, {
                display: formatText(item.hook),
                thumbnail: item.thumbnail,
                thumbnails: [],
                count: 0,
                hookSlug: item.hook
            });
        }
        
        // Only add thumbnail if filename contains the hook slug (ensures visual accuracy)
        const hookData = hooksMap.get(hookKey);
        if (item.filename.toLowerCase().includes(`__${item.hook.toLowerCase()}__`)) {
            hookData.thumbnails.push(item.thumbnail);
        }
        hookData.count++;
        
        // For styles: use first occurrence
        if (!stylesMap.has(styleKey)) {
            stylesMap.set(styleKey, {
                display: formatText(item.style),
                thumbnail: item.thumbnail,
                count: 0
            });
        }
        stylesMap.get(styleKey).count++;
    });
    
    // Render Personas Grid
    const personasGrid = document.getElementById('index-personas-grid');
    const personasHTML = Array.from(personasMap.values()).map(item => `
        <div class="index-card" onclick="selectCategoryAndClose('persona', '${item.display}')">
            <img class="index-card-image" src="${item.thumbnail}" alt="${item.display}" loading="lazy">
            <div class="index-card-content">
                <div class="index-card-title">${item.display}</div>
                <div class="index-card-count">${item.count} ad${item.count > 1 ? 's' : ''}</div>
            </div>
        </div>
    `).join('');
    personasGrid.innerHTML = personasHTML;
    
    // Pick middle thumbnail for each hook (more likely to be representative)
    hooksMap.forEach(hookData => {
        const midIndex = Math.floor(hookData.thumbnails.length / 2);
        hookData.thumbnail = hookData.thumbnails[midIndex];
    });
    
    // Render Hooks Grid
    const hooksGrid = document.getElementById('index-hooks-grid');
    const hooksHTML = Array.from(hooksMap.values()).map(item => `
        <div class="index-card" onclick="selectCategoryAndClose('hook', '${item.display}')">
            <img class="index-card-image" src="${item.thumbnail}" alt="${item.display}" loading="lazy">
            <div class="index-card-content">
                <div class="index-card-title">${item.display}</div>
                <div class="index-card-count">${item.count} ad${item.count > 1 ? 's' : ''}</div>
            </div>
        </div>
    `).join('');
    hooksGrid.innerHTML = hooksHTML;
    
    // Render Styles Grid
    const stylesGrid = document.getElementById('index-styles-grid');
    const stylesHTML = Array.from(stylesMap.values()).map(item => `
        <div class="index-card" onclick="selectCategoryAndClose('style', '${item.display}')">
            <img class="index-card-image" src="${item.thumbnail}" alt="${item.display}" loading="lazy">
            <div class="index-card-content">
                <div class="index-card-title">${item.display}</div>
                <div class="index-card-count">${item.count} ad${item.count > 1 ? 's' : ''}</div>
            </div>
        </div>
    `).join('');
    stylesGrid.innerHTML = stylesHTML;
}

function selectCategoryAndClose(type, value) {
    // Clear ALL filters
    document.getElementById('search').value = '';
    activeTagFilters.clear();
    activePersonaFilters.clear();
    activeHookFilters.clear();
    activeStyleFilters.clear();
    perfectModeActive = false;
    
    // Clear perfect mode button
    const perfectBtn = document.getElementById('perfect-toggle');
    if (perfectBtn) {
        perfectBtn.classList.remove('active');
    }
    
    // Set ONLY the selected filter
    if (type === 'persona') {
        activePersonaFilters.add(value);
    } else if (type === 'hook') {
        activeHookFilters.add(value);
    } else if (type === 'style') {
        activeStyleFilters.add(value);
    }
    
    // Close modal
    const modal = document.getElementById('browse-index-modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    
    // Apply filters
    filterAndRender();
}

// Tutorial Modal Functions
function openTutorialModal() {
    const modal = document.getElementById('tutorial-modal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeTutorialModal(event) {
    if (event.target.id === 'tutorial-modal' || event.target.classList.contains('modal-close') || 
        (event.target.closest && event.target.closest('.modal-apply-btn'))) {
        
        // Check if "don't show again" is checked
        const dontShowCheckbox = document.getElementById('dont-show-tutorial');
        if (dontShowCheckbox && dontShowCheckbox.checked) {
            localStorage.setItem('hideAdCrushTutorial', 'true');
        }
        
        const modal = document.getElementById('tutorial-modal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Check if tutorial should show on first visit
function checkFirstVisit() {
    const hasSeenTutorial = localStorage.getItem('hideAdCrushTutorial');
    if (!hasSeenTutorial) {
        // Show tutorial after a short delay to let gallery load
        setTimeout(() => {
            openTutorialModal();
        }, 1000);
    }
}

// Current item for Download/Edit modals
let currentModalItem = null;

// Open Download Options Modal
function openDownloadModal(event, filename) {
    event.stopPropagation();
    
    // Find the item
    const item = allData.find(d => d.filename === filename);
    if (!item) {
        alert('Image not found');
        return;
    }
    
    currentModalItem = item;
    
    const modal = document.getElementById('download-options-modal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close Download Options Modal
function closeDownloadOptionsModal(event) {
    if (event.target.id === 'download-options-modal' || 
        event.target.classList.contains('modal-close') ||
        event.target.closest('.menu-option-btn')?.onclick?.toString().includes('closeDownloadOptionsModal')) {
        const modal = document.getElementById('download-options-modal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
        currentModalItem = null;
    }
}

// Download HQ Image
function downloadHQImage() {
    if (!currentModalItem) {
        alert('No image selected');
        return;
    }
    
    try {
        const a = document.createElement('a');
        a.href = currentModalItem.filename;
        a.download = currentModalItem.filename.split('/').pop();
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Close modal after download
        closeDownloadOptionsModal({ target: { id: 'download-options-modal' } });
    } catch (error) {
        console.error('Download failed:', error);
        alert('Failed to download image');
    }
}

// Copy Facebook Text
function copyFacebookText() {
    if (!currentModalItem) {
        alert('No ad selected');
        return;
    }
    
    const text = currentModalItem.fbCopy || '';
    if (!text) {
        alert('No Facebook text available for this ad');
        return;
    }
    
    navigator.clipboard.writeText(text).then(() => {
        alert('✅ Facebook ad copy copied to clipboard!');
        closeDownloadOptionsModal({ target: { id: 'download-options-modal' } });
    }).catch(err => {
        console.error('Copy failed:', err);
        alert('Failed to copy to clipboard');
    });
}

// Open Edit Request Modal
function openEditModal(event, filename) {
    event.stopPropagation();
    
    // Find the item
    const item = allData.find(d => d.filename === filename);
    if (!item) {
        alert('Image not found');
        return;
    }
    
    currentModalItem = item;
    
    // Set image preview
    const preview = document.getElementById('edit-image-preview');
    preview.src = item.filename;
    
    // Set hidden fields
    document.getElementById('edit-project-name').value = window.PROJECT_NAME || '';
    document.getElementById('edit-image-filename').value = item.filename;
    
    // Clear form
    document.getElementById('edit-request-text').value = '';
    document.getElementById('edit-variations-count').value = '4';
    
    // Setup email caching
    setupEmailCaching('edit-email');
    
    const modal = document.getElementById('edit-request-modal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close Edit Request Modal
function closeEditRequestModal(event) {
    if (event.target.id === 'edit-request-modal' || event.target.classList.contains('modal-close')) {
        const modal = document.getElementById('edit-request-modal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
        currentModalItem = null;
    }
}

// Submit Edit Request
async function submitEditRequest(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('.submit-btn');
    
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-icons">hourglass_empty</span> Submitting...';
    
    // Prepare form data
    const formData = new FormData(form);
    
    // Add current item metadata
    if (currentModalItem) {
        formData.append('persona', currentModalItem.persona);
        formData.append('hook', currentModalItem.hook);
        formData.append('style', currentModalItem.style);
        formData.append('prompt', currentModalItem.prompt || '');
        formData.append('fb_copy', currentModalItem.fbCopy || '');
    }
    
    try {
        // Submit to Formspree
        const response = await fetch('https://formspree.io/f/mzzjnoaw', {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            // Success
            alert('✅ Edit request submitted successfully!\n\nWe\'ll review your request and generate the variations.');
            closeEditRequestModal({ target: { id: 'edit-request-modal' } });
            form.reset();
        } else {
            throw new Error('Submission failed');
        }
    } catch (error) {
        console.error('Form submission error:', error);
        alert('❌ Failed to submit request. Please try again or contact hassan@waken.ai directly.');
    } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-icons">send</span> Submit Edit Request';
    }
}

// Progressive Image Upload Functions
async function handleImageUpload(event, context, slotNum) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Show loading state
    const slot = document.getElementById(`${context}-slot-${slotNum}`);
    const placeholder = slot.querySelector('.upload-placeholder');
    const previewContainer = slot.querySelector('.image-preview-container');
    
    placeholder.innerHTML = '<span class="material-icons" style="font-size: 2rem; color: var(--primary); animation: spin 1s linear infinite;">hourglass_empty</span>';
    
    try {
        // Resize image to max 1024px
        const resizedBase64 = await resizeImage(file, 1024);
        
        // Store in hidden field
        document.getElementById(`${context}-image-data-${slotNum}`).value = resizedBase64;
        
        // Show preview
        const previewImg = previewContainer.querySelector('.preview-img');
        previewImg.src = resizedBase64;
        
        // Hide placeholder, show preview
        placeholder.style.display = 'none';
        previewContainer.style.display = 'block';
        
        // Show next slot (progressive reveal)
        showNextSlot(context, slotNum);
        
    } catch (error) {
        console.error('Image upload failed:', error);
        alert('Failed to process image. Please try again.');
        // Reset placeholder
        placeholder.innerHTML = `
            <span class="material-icons" style="font-size: 2rem; color: var(--primary);">add_photo_alternate</span>
            <span style="font-size: 0.875rem; color: var(--text-light); margin-top: 0.5rem;">Click to upload</span>
        `;
    }
}

async function resizeImage(file, maxDimension) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                // Calculate new dimensions
                let width = img.width;
                let height = img.height;
                
                if (width > height && width > maxDimension) {
                    height = (height / width) * maxDimension;
                    width = maxDimension;
                } else if (height > maxDimension) {
                    width = (width / height) * maxDimension;
                    height = maxDimension;
                }
                
                // Create canvas
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to base64 (JPEG 80% quality)
                const resizedBase64 = canvas.toDataURL('image/jpeg', 0.8);
                resolve(resizedBase64);
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target.result;
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

function showNextSlot(context, currentSlot) {
    // Show next slot if exists and not already visible
    const nextSlotNum = currentSlot + 1;
    if (nextSlotNum <= 3) {
        const nextSlot = document.getElementById(`${context}-slot-${nextSlotNum}`);
        if (nextSlot) {
            nextSlot.style.display = 'block';
        }
    }
}

function removeImage(context, slotNum) {
    const slot = document.getElementById(`${context}-slot-${slotNum}`);
    const fileInput = document.getElementById(`${context}-image-${slotNum}`);
    const placeholder = slot.querySelector('.upload-placeholder');
    const previewContainer = slot.querySelector('.image-preview-container');
    const hiddenField = document.getElementById(`${context}-image-data-${slotNum}`);
    
    // Clear file input
    fileInput.value = '';
    
    // Clear hidden field
    hiddenField.value = '';
    
    // Hide preview, show placeholder
    previewContainer.style.display = 'none';
    placeholder.style.display = 'flex';
    
    // Reset placeholder content
    placeholder.innerHTML = `
        <span class="material-icons" style="font-size: 2rem; color: var(--primary);">add_photo_alternate</span>
        <span style="font-size: 0.875rem; color: var(--text-light); margin-top: 0.5rem;">Click to upload</span>
    `;
    
    // Reorganize slots: hide empty slots after the last filled one
    reorganizeSlots(context);
}

function reorganizeSlots(context) {
    // Find the last filled slot
    let lastFilledSlot = 0;
    for (let i = 1; i <= 3; i++) {
        const hiddenField = document.getElementById(`${context}-image-data-${i}`);
        if (hiddenField && hiddenField.value) {
            lastFilledSlot = i;
        }
    }
    
    // Show slots up to last filled + 1, hide the rest
    for (let i = 1; i <= 3; i++) {
        const slot = document.getElementById(`${context}-slot-${i}`);
        if (slot) {
            if (i === 1 || i <= lastFilledSlot + 1) {
                slot.style.display = 'block';
            } else {
                slot.style.display = 'none';
            }
        }
    }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initGallery();
        checkFirstVisit();
    });
} else {
    initGallery();
    checkFirstVisit();
}
