/**
 * Task 1.3: localStorage Persistence for Active Tab Selection
 * 
 * Tests to verify that the active tab selection is persisted in localStorage
 * and restored when the page is reloaded.
 * 
 * Validates: Requirement 19.23
 */

describe('Task 1.3: localStorage Persistence for Active Tab Selection', () => {
    let tracker;
    let mockLocalStorage;
    
    beforeEach(() => {
        // Setup DOM
        document.body.innerHTML = `
            <div class="overview-tab-selector">
                <button class="tab-btn active" data-tab="overview-data">Overview</button>
                <button class="tab-btn" data-tab="analysis-data">Analysis</button>
            </div>
            <div id="overview-data" class="tab-content active"></div>
            <div id="analysis-data" class="tab-content"></div>
            <div id="spending-line-graph"></div>
            <div id="health-score"></div>
            <div id="spending-heatmap"></div>
            <div id="category-pie-chart"></div>
        `;
        
        // Mock localStorage
        mockLocalStorage = {};
        global.localStorage = {
            getItem: jest.fn((key) => mockLocalStorage[key] || null),
            setItem: jest.fn((key, value) => { mockLocalStorage[key] = value; }),
            removeItem: jest.fn((key) => { delete mockLocalStorage[key]; }),
            clear: jest.fn(() => { mockLocalStorage = {}; })
        };
        
        // Create tracker instance
        tracker = new ExpenseTracker();
    });
    
    afterEach(() => {
        jest.clearAllMocks();
    });
    
    describe('saveActiveTab', () => {
        test('should save overview tab to localStorage', () => {
            tracker.saveActiveTab('overview-data');
            
            expect(localStorage.setItem).toHaveBeenCalledWith('activeOverviewTab', 'overview-data');
            expect(mockLocalStorage['activeOverviewTab']).toBe('overview-data');
        });
        
        test('should save analysis tab to localStorage', () => {
            tracker.saveActiveTab('analysis-data');
            
            expect(localStorage.setItem).toHaveBeenCalledWith('activeOverviewTab', 'analysis-data');
            expect(mockLocalStorage['activeOverviewTab']).toBe('analysis-data');
        });
        
        test('should handle localStorage errors gracefully', () => {
            // Mock localStorage.setItem to throw error
            localStorage.setItem.mockImplementation(() => {
                throw new Error('Storage quota exceeded');
            });
            
            // Should not throw
            expect(() => tracker.saveActiveTab('overview-data')).not.toThrow();
        });
        
        test('should not save if storage is unavailable', () => {
            tracker.storageAvailable = false;
            tracker.saveActiveTab('overview-data');
            
            expect(localStorage.setItem).not.toHaveBeenCalled();
        });
    });
    
    describe('loadActiveTab', () => {
        test('should load overview tab from localStorage', () => {
            mockLocalStorage['activeOverviewTab'] = 'overview-data';
            
            tracker.loadActiveTab();
            
            const overviewBtn = document.querySelector('.tab-btn[data-tab="overview-data"]');
            const overviewContent = document.getElementById('overview-data');
            
            expect(overviewBtn.classList.contains('active')).toBe(true);
            expect(overviewContent.classList.contains('active')).toBe(true);
        });
        
        test('should load analysis tab from localStorage', () => {
            mockLocalStorage['activeOverviewTab'] = 'analysis-data';
            
            tracker.loadActiveTab();
            
            const analysisBtn = document.querySelector('.tab-btn[data-tab="analysis-data"]');
            const analysisContent = document.getElementById('analysis-data');
            
            expect(analysisBtn.classList.contains('active')).toBe(true);
            expect(analysisContent.classList.contains('active')).toBe(true);
        });
        
        test('should default to overview tab if no saved preference', () => {
            // No saved preference
            mockLocalStorage = {};
            
            tracker.loadActiveTab();
            
            const overviewBtn = document.querySelector('.tab-btn[data-tab="overview-data"]');
            const overviewContent = document.getElementById('overview-data');
            
            expect(overviewBtn.classList.contains('active')).toBe(true);
            expect(overviewContent.classList.contains('active')).toBe(true);
        });
        
        test('should default to overview tab if saved preference is invalid', () => {
            mockLocalStorage['activeOverviewTab'] = 'invalid-tab';
            
            tracker.loadActiveTab();
            
            const overviewBtn = document.querySelector('.tab-btn[data-tab="overview-data"]');
            const overviewContent = document.getElementById('overview-data');
            
            expect(overviewBtn.classList.contains('active')).toBe(true);
            expect(overviewContent.classList.contains('active')).toBe(true);
        });
        
        test('should handle localStorage errors gracefully', () => {
            // Mock localStorage.getItem to throw error
            localStorage.getItem.mockImplementation(() => {
                throw new Error('Storage access denied');
            });
            
            // Should not throw and should default to overview
            expect(() => tracker.loadActiveTab()).not.toThrow();
            
            const overviewBtn = document.querySelector('.tab-btn[data-tab="overview-data"]');
            expect(overviewBtn.classList.contains('active')).toBe(true);
        });
        
        test('should not load from localStorage if storage is unavailable', () => {
            tracker.storageAvailable = false;
            mockLocalStorage['activeOverviewTab'] = 'analysis-data';
            
            tracker.loadActiveTab();
            
            // Should default to overview tab
            const overviewBtn = document.querySelector('.tab-btn[data-tab="overview-data"]');
            expect(overviewBtn.classList.contains('active')).toBe(true);
        });
    });
    
    describe('Tab switching integration', () => {
        test('should save tab selection when clicking tab button', () => {
            const analysisBtn = document.querySelector('.tab-btn[data-tab="analysis-data"]');
            
            // Simulate click
            analysisBtn.click();
            
            expect(localStorage.setItem).toHaveBeenCalledWith('activeOverviewTab', 'analysis-data');
        });
        
        test('should persist tab selection across page reloads', () => {
            // First session: switch to analysis tab
            const analysisBtn = document.querySelector('.tab-btn[data-tab="analysis-data"]');
            analysisBtn.click();
            
            expect(mockLocalStorage['activeOverviewTab']).toBe('analysis-data');
            
            // Simulate page reload: create new tracker instance
            const newTracker = new ExpenseTracker();
            
            // Should load analysis tab
            const analysisContent = document.getElementById('analysis-data');
            expect(analysisContent.classList.contains('active')).toBe(true);
        });
        
        test('should update localStorage when switching between tabs', () => {
            const overviewBtn = document.querySelector('.tab-btn[data-tab="overview-data"]');
            const analysisBtn = document.querySelector('.tab-btn[data-tab="analysis-data"]');
            
            // Switch to analysis
            analysisBtn.click();
            expect(mockLocalStorage['activeOverviewTab']).toBe('analysis-data');
            
            // Switch back to overview
            overviewBtn.click();
            expect(mockLocalStorage['activeOverviewTab']).toBe('overview-data');
        });
    });
    
    describe('Requirement 19.23 validation', () => {
        test('THE Overview_Page SHALL persist the active tab selection in localStorage', () => {
            // Test overview tab persistence
            tracker.saveActiveTab('overview-data');
            expect(localStorage.getItem('activeOverviewTab')).toBe('overview-data');
            
            // Test analysis tab persistence
            tracker.saveActiveTab('analysis-data');
            expect(localStorage.getItem('activeOverviewTab')).toBe('analysis-data');
            
            // Test persistence survives page reload
            const savedTab = localStorage.getItem('activeOverviewTab');
            expect(savedTab).toBe('analysis-data');
            
            // Create new tracker to simulate reload
            const newTracker = new ExpenseTracker();
            newTracker.loadActiveTab();
            
            const analysisContent = document.getElementById('analysis-data');
            expect(analysisContent.classList.contains('active')).toBe(true);
        });
    });
});
