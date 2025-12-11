/**
 * @file motion_chart.js
 * @description Motion chart (animated scatter plot) for Task 2 - Gapminder visualization
 * 
 * Features:
 * - X-axis: GDP per Capita (logarithmic scale as required)
 * - Y-axis: Life Expectancy (linear scale)
 * - Bubble radius: Population (sqrt scale)
 * - Color: Continent
 * - Smooth transitions during animation
 * - Continent color legend
 * 
 * @author DAV Assignment 2
 * @see Requirement 2.1 - Motion Chart
 */

const motionChart = {
    svg: null,
    bubbles: null,
    width: 0,
    height: 0,
    margin: null,
    x: null,      // GDP per capita scale (log)
    y: null,      // Life expectancy scale (linear)
    r: null,      // Population scale (sqrt)
    color: null,  // Continent color scale
    initialized: false,  // Track whether scales have been computed
    
    /**
     * Initializes the motion chart container
     * Sets up SVG element only - scales computed after data loads
     * @param {string} containerId - DOM element ID to render into
     */
    init: function (containerId) {
        const container = document.getElementById(containerId);
        this.margin = { top: 20, right: 120, bottom: 40, left: 60 };
        this.width = container.clientWidth - this.margin.left - this.margin.right;
        this.height = container.clientHeight - this.margin.top - this.margin.bottom;

        this.svg = d3.select("#" + containerId).append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .attr("viewBox", [0, 0, this.width + this.margin.left + this.margin.right, this.height + this.margin.top + this.margin.bottom])
            .append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);
        
        // Color scale doesn't depend on data
        this.color = d3.scaleOrdinal()
            .domain(["africa", "americas", "asia", "europe", "oceania"])
            .range(d3.schemeCategory10);
    },
    
    /**
     * Initializes scales and axes AFTER data is loaded
     * Must be called once data is available in state2.data
     */
    initScales: function() {
        if (this.initialized || !state2.data || state2.data.length === 0) return;
        
        // =====================================================================
        // CALCULATE GLOBAL DOMAINS
        // Pre-compute min/max across ALL years for consistent scales
        // =====================================================================
        let maxIncome = 0, minIncome = Infinity;
        let maxLife = 0, minLife = Infinity;
        let maxPop = 0;

        state2.data.forEach(year => {
            year.countries.forEach(c => {
                if (c.income) {
                    if (c.income > maxIncome) maxIncome = c.income;
                    if (c.income < minIncome) minIncome = c.income;
                }
                if (c.life_exp) {
                    if (c.life_exp > maxLife) maxLife = c.life_exp;
                    if (c.life_exp < minLife) minLife = c.life_exp;
                }
                if (c.population > maxPop) maxPop = c.population;
            });
        });

        // Add padding to domains for visual breathing room
        minIncome = (minIncome && minIncome > 0 && minIncome !== Infinity) ? minIncome * 0.5 : 100;
        maxIncome = (maxIncome && maxIncome > 0) ? maxIncome * 1.8 : 100000;
        minLife = (minLife && minLife !== Infinity) ? Math.max(0, minLife - 5) : 20;
        maxLife = (maxLife && maxLife > 0) ? Math.min(100, maxLife + 5) : 90;

        // =====================================================================
        // SCALES (as per assignment requirements)
        // =====================================================================
        // X: GDP per capita - MUST use d3.scaleLog (assignment requirement)
        this.x = d3.scaleLog()
            .domain([minIncome, maxIncome])
            .range([0, this.width])
            .clamp(true);  // Clamp values to stay within bounds
        
        // Y: Life expectancy - Linear scale
        this.y = d3.scaleLinear()
            .domain([minLife, maxLife])
            .range([this.height, 0])
            .clamp(true);  // Clamp values to stay within bounds
        
        // R: Population - Sqrt scale (prevents over-emphasizing large populations)
        this.r = d3.scaleSqrt()
            .domain([0, maxPop])
            .range([2, 25]);
        
        // Color: By continent (using lowercase to match data)
        // Domain uses lowercase since data has lowercase continents
        this.color = d3.scaleOrdinal()
            .domain(["africa", "americas", "asia", "europe", "oceania"])
            .range(d3.schemeCategory10);

        // =====================================================================
        // CLIPPING PATH
        // Prevents bubbles from overflowing chart area
        // =====================================================================
        this.svg.append("defs").append("clipPath")
            .attr("id", "chart-clip")
            .append("rect")
            .attr("width", this.width)
            .attr("height", this.height);

        // Group for bubbles with clipping applied
        this.bubbles = this.svg.append("g")
            .attr("clip-path", "url(#chart-clip)");

        // =====================================================================
        // AXES
        // =====================================================================
        this.svg.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${this.height})`)
            .call(d3.axisBottom(this.x)
                .ticks(5, ",")
                .tickFormat(d3.format(","))
            );

        this.svg.append("g")
            .attr("class", "y-axis")
            .call(d3.axisLeft(this.y));

        // =====================================================================
        // AXIS LABELS
        // =====================================================================
        this.svg.append("text")
            .attr("class", "x-label")
            .attr("x", this.width / 2)
            .attr("y", this.height + 35)
            .style("text-anchor", "middle")
            .style("font-size", "12px")
            .text("GDP per Capita (Log Scale)");

        this.svg.append("text")
            .attr("class", "y-label")
            .attr("transform", "rotate(-90)")
            .attr("x", -this.height / 2)
            .attr("y", -45)
            .style("text-anchor", "middle")
            .style("font-size", "12px")
            .text("Life Expectancy (Years)");
        
        // =====================================================================
        // CONTINENT COLOR LEGEND
        // =====================================================================
        this.initContinentLegend();
        
        this.initialized = true;
        console.log("Motion chart scales initialized with data range:", 
                   "income:", minIncome, "-", maxIncome,
                   "life_exp:", minLife, "-", maxLife);
    },
    
    /**
     * Initializes the continent color legend
     * Shows color coding for each continent
     * Uses lowercase continent names to match data, displays capitalized
     */
    initContinentLegend: function() {
        // Use lowercase to match data, display will be capitalized
        const continents = ["africa", "americas", "asia", "europe", "oceania"];
        const legendX = this.width + 15;
        const legendY = 20;
        
        const legend = this.svg.append("g")
            .attr("class", "continent-legend")
            .attr("transform", `translate(${legendX}, ${legendY})`);
        
        // Background
        legend.append("rect")
            .attr("x", -8)
            .attr("y", -15)
            .attr("width", 95)
            .attr("height", continents.length * 20 + 20)
            .attr("fill", "rgba(255,255,255,0.9)")
            .attr("stroke", "#ccc")
            .attr("rx", 5);
        
        // Title
        legend.append("text")
            .attr("x", 0)
            .attr("y", 0)
            .attr("font-weight", "bold")
            .attr("font-size", "11px")
            .text("Continent");
        
        // Legend items
        continents.forEach((cont, i) => {
            const row = legend.append("g")
                .attr("transform", `translate(0, ${i * 20 + 18})`);
            
            row.append("circle")
                .attr("r", 6)
                .attr("fill", this.color(cont))
                .attr("opacity", 0.8);
            
            row.append("text")
                .attr("x", 14)
                .attr("y", 4)
                .text(capitalizeContinent(cont))  // Display capitalized
                .style("font-size", "10px")
                .style("fill", "#333");
        });
    },

    /**
     * Updates the motion chart for a given year's data
     * Uses smooth transitions for animation effect
     * Data is clamped to scale bounds via .clamp(true) on scales
     * @param {Array} data - Array of country data objects for current year
     */
    update: function (data) {
        // Initialize scales on first update (after data is loaded)
        if (!this.initialized) {
            this.initScales();
        }
        
        // Safety check - scales must be ready
        if (!this.x || !this.y || !this.r || !this.bubbles) {
            console.warn("Motion chart not fully initialized");
            return;
        }
        
        const self = this;
        
        // Filter out invalid data points (missing income or life_exp)
        const validData = data.filter(d => 
            d.income != null && d.income > 0 && 
            d.life_exp != null && d.life_exp > 0
        );
        
        // Data join with key function for stable transitions
        this.bubbles.selectAll(".bubble")
            .data(validData, d => d.country)
            .join(
                // ENTER: New countries appearing
                enter => enter.append("circle")
                    .attr("class", "bubble")
                    .attr("fill", d => this.color(d.continent || 'unknown'))
                    .attr("opacity", 0.75)
                    .attr("cx", d => this.x(Math.max(this.x.domain()[0], d.income)))
                    .attr("cy", d => this.y(d.life_exp))
                    .attr("r", d => this.r(d.population || 0))
                    .each(function(d) {
                        // Add tooltip
                        d3.select(this).append("title")
                            .text(`${d.name}\nGDP: $${d3.format(",")(Math.round(d.income))}\nLife Exp: ${Math.round(d.life_exp)} yrs\nPop: ${d3.format(".2s")(d.population)}`);
                    }),
                
                // UPDATE: Existing countries transitioning
                update => update
                    .transition()
                    .duration(200)
                    .ease(d3.easeLinear)
                    .attr("fill", d => this.color(d.continent || 'unknown'))
                    .attr("cx", d => this.x(Math.max(this.x.domain()[0], d.income)))
                    .attr("cy", d => this.y(d.life_exp))
                    .attr("r", d => this.r(d.population || 0))
                    .selection()
                    .each(function(d) {
                        // Update tooltip
                        d3.select(this).select("title").remove();
                        d3.select(this).append("title")
                            .text(`${d.name}\nGDP: $${d3.format(",")(Math.round(d.income))}\nLife Exp: ${Math.round(d.life_exp)} yrs\nPop: ${d3.format(".2s")(d.population)}`);
                    }),
                
                // EXIT: Countries disappearing
                exit => exit.remove()
            );
    },

    /**
     * Highlights bubbles belonging to a specific continent or country
     * Used for drill-down hover interaction
     * Handles both lowercase (data) and capitalized (UI) continent names
     * @param {string|null} continent - Continent to highlight, null to reset
     * @param {string|null} countryCode - Specific country ISO code to highlight, null for continent-level
     */
    highlight: function (continent, countryCode) {
        // Safety check - bubbles might not be initialized yet
        if (!this.bubbles) return;
        
        if (!continent && !countryCode) {
            // Reset all bubbles to normal opacity
            this.bubbles.selectAll(".bubble").style("opacity", 0.75);
        } else if (countryCode) {
            // Highlight specific country
            const normalizedCode = countryCode.toLowerCase();
            this.bubbles.selectAll(".bubble")
                .style("opacity", d => {
                    const dataCountry = (d.country || '').toLowerCase();
                    return dataCountry === normalizedCode ? 0.95 : 0.08;
                });
        } else {
            // Highlight continent
            const normalizedContinent = continent.toLowerCase();
            this.bubbles.selectAll(".bubble")
                .style("opacity", d => {
                    const dataContinent = (d.continent || '').toLowerCase();
                    return dataContinent === normalizedContinent ? 0.9 : 0.1;
                });
        }
    }
};