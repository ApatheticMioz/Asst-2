/**
 * @file main.js
 * @description Main initialization and orchestration for Task 1 - Power Plant Dashboard
 * 
 * Orchestrates:
 * - Component initialization (map, force layout, timeline)
 * - Event handling via d3.dispatch
 * - Statistics display updates
 * 
 * Architecture:
 * - Uses event-driven pattern with centralized state (state.js)
 * - Components are decoupled and communicate via dispatch events
 * - Initialization order: Create SVGs first, then load data, then render
 * 
 * @author DAV Assignment 2
 * @see Requirement 1.1 (Map), 1.2 (Force), 1.3 (Timeline)
 */

document.addEventListener("DOMContentLoaded", () => {
    // =========================================================================
    // STEP 1: INITIALIZE VISUALIZATION COMPONENTS
    // Creates SVG containers and sets up behaviors (zoom, brush, force)
    // NO DATA RENDERING YET - just structural setup
    // =========================================================================
    mapViz.init("map-container");
    forceViz.init("force-container");
    timelineViz.init("timeline-container");

    // =========================================================================
    // STEP 2: SETUP EVENT LISTENERS
    // Using d3.dispatch for loose coupling between components
    // =========================================================================
    
    /**
     * Data loaded handler
     * Triggered when utils.loadData() finishes loading CSV and TopoJSON
     * Now safe to render visualizations with actual data
     */
    state.dispatch.on("dataLoaded", () => {
        console.log("Task 1: Data loaded, initializing visualizations");
        mapViz.update();      // Render map with aggregates
        forceViz.update();    // Render force layout
        timelineViz.update(); // Render stacked area chart
        updateStats();        // Update header statistics
    });

    /**
     * State changed handler
     * Triggered when filters change (fuel selection, year range brush)
     * Updates map and force layout with filtered data
     */
    state.dispatch.on("stateChanged", () => {
        mapViz.update();
        forceViz.update();
        updateStats();
    });
    
    /**
     * Level changed handler (optional)
     * Triggered when semantic zoom level changes
     * Can be used for additional UI feedback
     */
    state.dispatch.on("levelChanged", (level) => {
        console.log(`Zoom level changed to: ${level}`);
    });

    // =========================================================================
    // STEP 3: START DATA LOADING
    // Async load triggers dataLoaded event when complete
    // =========================================================================
    utils.loadData();
});

/**
 * Updates the statistics display in the header
 * Shows count of visible plants, total capacity, and active filters
 * Provides clear feedback on current visualization state
 */
function updateStats() {
    // Safety check for early calls before data loads
    if (!state.filteredData || state.filteredData.length === 0) {
        d3.select("#stats-total").text("Loading data...");
        d3.select("#stats-filter").text("");
        return;
    }
    
    // Calculate total capacity
    const totalCapacity = d3.sum(state.filteredData, d => d.capacity);
    const formattedCapacity = totalCapacity > 1000000 
        ? d3.format(",.1f")(totalCapacity / 1000000) + " TW"
        : d3.format(",.0f")(totalCapacity / 1000) + " GW";
    
    // Update plant count with capacity
    d3.select("#stats-total").html(
        `<strong>${d3.format(",")(state.filteredData.length)}</strong> Power Plants | ` +
        `<strong>${formattedCapacity}</strong> Total Capacity`
    );
    
    // Build filter description with clear labels
    const filters = [];
    if (state.filterFuel) {
        filters.push(`<span style="color: ${FUEL_COLORS(state.filterFuel)}; font-weight: bold;">● ${state.filterFuel}</span>`);
    }
    if (state.filterRange) {
        filters.push(`Years: ${state.filterRange[0]}–${state.filterRange[1]}`);
    }
    
    if (filters.length > 0) {
        d3.select("#stats-filter").html("Filters: " + filters.join(" | "));
    } else {
        d3.select("#stats-filter").html("<em>Showing all data – click fuel bubbles or brush timeline to filter</em>");
    }
}