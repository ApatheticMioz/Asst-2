/**
 * @file task2_main.js
 * @description Main initialization and state management for Task 2 - Gapminder Dashboard
 * 
 * Orchestrates:
 * - Data loading via utils.loadGapminderData()
 * - Event dispatching between components (yearChanged, playToggled, hoverContinent)
 * - Animation control via d3.interval
 * - Year-based data filtering and synchronization
 * 
 * Components:
 * - motionChart: Animated scatter plot (GDP vs Life Expectancy)
 * - choroplethMap: Color-coded world map (Life Expectancy)
 * - controls: Year slider (d3.drag), play button, sunburst drill-down
 * 
 * @author DAV Assignment 2
 * @see Requirement 2.1, 2.2, 2.3
 */

const state2 = {
    // Full dataset: Array of { year, countries: [...] }
    data: [],
    
    // Current year being displayed (1800-2023)
    year: 1800,
    
    // Animation state
    playing: false,
    timer: null,
    
    // Geographic data for choropleth
    geoData: null,
    
    // Lookup maps for efficient data access
    countryMap: new Map(),  // ISO code → country data for current year
    isoMapping: null,       // Numeric ID → Alpha-3 ISO code
    
    // Event dispatcher for reactive updates
    // - yearChanged: Triggered when year changes (animation, slider drag)
    // - playToggled: Triggered when play/pause button clicked
    // - hoverContinent: Triggered when continent hovered in drill-down
    // - dataLoaded: Triggered when all data finished loading
    dispatch: d3.dispatch("yearChanged", "playToggled", "hoverContinent", "dataLoaded")
};

/**
 * Application entry point
 * Initializes all components and sets up event listeners
 */
document.addEventListener("DOMContentLoaded", async () => {
    try {
        // =====================================================================
        // INITIALIZE VISUALIZATION COMPONENTS
        // Order matters: init creates SVG elements needed by update
        // =====================================================================
        motionChart.init("motion-container");
        choroplethMap.init("choropleth-container");
        controls.init("controls-container");

        // Set initial year display
        updateYear(1800);

        // =====================================================================
        // EVENT LISTENERS
        // Using d3.dispatch for decoupled communication
        // =====================================================================
        
        /**
         * Year change handler
         * Updates all views when year changes (animation, slider, etc.)
         */
        state2.dispatch.on("yearChanged", (year) => {
            state2.year = year;
            updateYear(year);
        });

        /**
         * Play/Pause handler
         * Controls animation via d3.interval
         * Animation advances 1 year every 200ms
         */
        state2.dispatch.on("playToggled", (isPlaying) => {
            state2.playing = isPlaying;
            
            if (isPlaying) {
                // Start animation timer
                state2.timer = d3.interval(() => {
                    // Stop at end of dataset
                    if (state2.year >= 2023) {
                        state2.dispatch.call("playToggled", null, false);
                        d3.select("#play-btn").text("Play");
                        return;
                    }
                    // Advance to next year
                    state2.dispatch.call("yearChanged", null, state2.year + 1);
                }, 200);  // 200ms = 5 years per second
            } else {
                // Stop animation timer
                if (state2.timer) {
                    state2.timer.stop();
                    state2.timer = null;
                }
            }
        });

        /**
         * Continent/Country hover handler
         * Highlights bubbles in motion chart and countries in choropleth
         * matching hovered region from sunburst drill-down
         * Supports both continent-level and country-level filtering
         */
        state2.dispatch.on("hoverContinent", (hoverData) => {
            if (!hoverData) {
                // Reset both views
                motionChart.highlight(null, null);
                choroplethMap.highlight(null, null);
            } else {
                const { continent, countryCode } = hoverData;
                // Highlight both motion chart and choropleth
                motionChart.highlight(continent, countryCode);
                choroplethMap.highlight(continent, countryCode);
            }
        });

        /**
         * Data loaded handler
         * Triggers initial render after data is available
         */
        state2.dispatch.on("dataLoaded", (data) => {
            updateYear(1800);
        });

        // =====================================================================
        // LOAD DATA
        // Async load of Gapminder JSON and geographic data
        // =====================================================================
        utils.loadGapminderData();

    } catch (error) {
        console.error("Error initializing Task 2:", error);
    }
});

/**
 * Updates all visualizations for a specific year
 * @param {number} year - Year to display (1800-2023)
 */
function updateYear(year) {
    // Wait for data to be available
    if (!state2.data || state2.data.length === 0) return;

    // Find data for requested year
    const yearData = state2.data.find(d => d.year === year);
    if (!yearData) return;

    // Update country lookup map for choropleth
    state2.countryMap.clear();
    yearData.countries.forEach(c => {
        state2.countryMap.set(c.country, c);
    });

    // Update all views
    motionChart.update(yearData.countries);
    choroplethMap.update(yearData.countries);
    controls.update(year);
}
