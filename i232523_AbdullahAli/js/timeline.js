/**
 * @file timeline.js
 * @description Brushable stacked area chart for Task 1 - Time range selection
 * 
 * Features:
 * - Stacked area chart showing capacity by fuel type over time
 * - Focus+Context design pattern (main chart + minimap with brush)
 * - Linked view: Brush selection filters Map and Force Layout
 * 
 * Layout:
 * - Top: Focus area (detailed view, updates based on brush)
 * - Bottom: Context area (minimap with brush control)
 * - margin2.top = 190: Context positioned 140px (focus) + 40px gap + 10px margin
 * 
 * @author DAV Assignment 2
 * @see Requirement 1.3 - Brushable Timeline
 */

const timelineViz = {
    // SVG and groups
    svg: null,
    focus: null,        // Main detailed chart
    context: null,      // Minimap with brush
    focusLayers: null,
    contextLayers: null,
    
    // Axes elements
    xAxisFocus: null,
    yAxisFocus: null,
    xAxisContext: null,
    
    // Brush element
    brush: null,
    gBrush: null,
    
    // Scales
    x: null, y: null,   // Focus scales
    x2: null, y2: null, // Context scales
    
    // Dimensions
    width: 0,
    height: 0,    // Focus height
    height2: 0,   // Context height
    
    // Flag to prevent filter update during initialization
    initializing: true,
    
    /**
     * Initializes the timeline visualization
     * @param {string} containerId - DOM element ID to render into
     */
    init: function (containerId) {
        const container = document.getElementById(containerId);
        
        // Margins for focus (top) and context (bottom) areas
        const margin = { top: 10, right: 30, bottom: 20, left: 50 };
        // Context positioned below focus: 140px focus + 40px gap + 10px margin = 190
        const margin2 = { top: 190, right: 30, bottom: 20, left: 50 };

        const totalWidth = container.offsetWidth;
        const totalHeight = container.offsetHeight;

        this.width = totalWidth - margin.left - margin.right;
        this.height = 140;  // Focus chart height
        this.height2 = 60;  // Context minimap height

        // Create main SVG with viewBox for responsiveness
        this.svg = d3.select("#" + containerId)
            .append("svg")
            .attr("width", totalWidth)
            .attr("height", totalHeight)
            .attr("viewBox", [0, 0, totalWidth, totalHeight]);

        // Clipping path to prevent overflow in focus area
        this.svg.append("defs")
            .append("clipPath")
            .attr("id", "clip-timeline")
            .append("rect")
            .attr("width", this.width)
            .attr("height", this.height);
        
        // Focus group (main detailed chart)
        this.focus = this.svg.append("g")
            .attr("class", "focus")
            .attr("transform", `translate(${margin.left},${margin.top})`);
        
        // Context group (minimap with brush)
        this.context = this.svg.append("g")
            .attr("class", "context")
            .attr("transform", `translate(${margin2.left},${margin2.top})`);

        // Initialize scales
        this.x = d3.scaleLinear().range([0, this.width]);
        this.y = d3.scaleLinear().range([this.height, 0]);
        this.x2 = d3.scaleLinear().range([0, this.width]);
        this.y2 = d3.scaleLinear().range([this.height2, 0]);

        // Layer groups for stacked areas
        this.focusLayers = this.focus.append("g")
            .attr("class", "layers")
            .attr("clip-path", "url(#clip-timeline)");
        this.contextLayers = this.context.append("g")
            .attr("class", "layers");

        // Axis groups
        this.xAxisFocus = this.focus.append("g")
            .attr("class", "axis axis--x")
            .attr("transform", `translate(0,${this.height})`);
        this.yAxisFocus = this.focus.append("g")
            .attr("class", "axis axis--y");
        this.xAxisContext = this.context.append("g")
            .attr("class", "axis axis--x")
            .attr("transform", `translate(0,${this.height2})`);

        // Initialize brush
        const self = this;
        this.brush = d3.brushX()
            .extent([[0, 0], [this.width, this.height2]])
            .on("brush end", (e) => self.brushed(e));
        
        this.gBrush = this.context.append("g")
            .attr("class", "brush")
            .call(this.brush);
    },

    /**
     * Updates the timeline with current data
     * Renders stacked area chart for both focus and context
     */
    update: function () {
        // Get stacked data grouped by year and fuel type
        const stackData = utils.getStackedData(state.rawData);
        const keys = FUEL_COLORS.domain();
        const stacked = d3.stack().keys(keys)(stackData);

        // Update scale domains
        this.x.domain(d3.extent(stackData, d => d.year));
        this.y.domain([0, d3.max(stacked, layer => d3.max(layer, d => d[1]))]);
        this.x2.domain(this.x.domain());
        this.y2.domain(this.y.domain());

        // Area generators
        const areaFocus = d3.area()
            .x(d => this.x(d.data.year))
            .y0(d => this.y(d[0]))
            .y1(d => this.y(d[1]));
        
        const areaContext = d3.area()
            .x(d => this.x2(d.data.year))
            .y0(d => this.y2(d[0]))
            .y1(d => this.y2(d[1]));

        // Render focus layers
        this.focusLayers.selectAll("path")
            .data(stacked)
            .join("path")
            .attr("fill", (d, i) => FUEL_COLORS(keys[i]))
            .attr("d", areaFocus)
            .style("opacity", 0.7);
        
        // Render context layers
        this.contextLayers.selectAll("path")
            .data(stacked)
            .join("path")
            .attr("fill", (d, i) => FUEL_COLORS(keys[i]))
            .attr("d", areaContext)
            .style("opacity", 0.5);

        // Update axes
        this.xAxisFocus.call(d3.axisBottom(this.x).tickFormat(d3.format("d")));
        this.yAxisFocus.call(d3.axisLeft(this.y));
        this.xAxisContext.call(d3.axisBottom(this.x2).tickFormat(d3.format("d")));

        // Initialize brush to full range (this triggers brushed event)
        // Set initializing flag to prevent filter update on first render
        this.initializing = true;
        this.gBrush.call(this.brush.move, this.x2.range());
        // Clear the flag after a short delay to allow the brush event to complete
        setTimeout(() => {
            this.initializing = false;
        }, 100);
    },

    /**
     * Handles brush events - updates focus view and filters data
     * @param {Object} event - D3 brush event
     */
    brushed: function (event) {
        // Ignore brush events triggered by zoom
        if (event.sourceEvent && event.sourceEvent.type === "zoom") return;
        
        // Get brush selection or default to full range
        const s = event.selection || this.x2.range();
        
        // Update focus x-scale domain based on brush selection
        this.x.domain(s.map(this.x2.invert, this.x2));

        // Re-render focus area with new domain
        const keys = FUEL_COLORS.domain();
        const stackData = utils.getStackedData(state.rawData);
        const stacked = d3.stack().keys(keys)(stackData);
        
        const areaFocus = d3.area()
            .x(d => this.x(d.data.year))
            .y0(d => this.y(d[0]))
            .y1(d => this.y(d[1]));

        this.focusLayers.selectAll("path").attr("d", areaFocus);
        this.xAxisFocus.call(d3.axisBottom(this.x).tickFormat(d3.format("d")));

        // Update global filter state and trigger updates
        // Skip during initialization to prevent double filtering
        if (event.sourceEvent && !this.initializing) {
            const [x0, x1] = s.map(this.x2.invert);
            state.filterRange = [Math.round(x0), Math.round(x1)];
            utils.updateFilters();
        }
    }
};