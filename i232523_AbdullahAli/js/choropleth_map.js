/**
 * @file choropleth_map.js
 * @description Synchronized choropleth map for Task 2 - Life Expectancy visualization
 * 
 * Features:
 * - Color-coded countries by life expectancy (Viridis scale)
 * - Real-time synchronization with motion chart
 * - Gradient color legend showing life expectancy scale
 * 
 * @author DAV Assignment 2
 * @see Requirement 2.2 - Synchronized Choropleth Map
 */

const choroplethMap = {
    svg: null,
    projection: null,
    path: null,
    color: null,
    width: 0,
    height: 0,
    
    /**
     * Initializes the choropleth map visualization
     * @param {string} containerId - DOM element ID to render into
     */
    init: function (containerId) {
        const container = document.getElementById(containerId);
        this.width = container.clientWidth;
        this.height = container.clientHeight;

        this.svg = d3.select("#" + containerId).append("svg")
            .attr("width", this.width)
            .attr("height", this.height)
            .attr("viewBox", [0, 0, this.width, this.height]);  // viewBox for responsiveness

        // Mercator projection for consistency with Task 1
        this.projection = d3.geoMercator()
            .scale(100)
            .translate([this.width / 2, this.height / 1.5]);
        this.path = d3.geoPath(this.projection);

        // Sequential color scale for life expectancy
        // Viridis: Dark purple (low) → Yellow (high)
        // Domain [20, 85] covers historical to modern life expectancy range
        this.color = d3.scaleSequential(d3.interpolateViridis).domain([20, 85]);
        
        // Initialize color legend
        this.initColorLegend();
    },
    
    /**
     * Initializes the color legend showing life expectancy scale
     * Uses gradient bar with axis labels
     */
    initColorLegend: function() {
        const legendWidth = 200;
        const legendHeight = 15;
        const legendX = 20;
        const legendY = this.height - 50;
        
        const legend = this.svg.append("g")
            .attr("class", "color-legend")
            .attr("transform", `translate(${legendX}, ${legendY})`);
        
        // Background for better visibility
        legend.append("rect")
            .attr("x", -10)
            .attr("y", -25)
            .attr("width", legendWidth + 20)
            .attr("height", 55)
            .attr("fill", "rgba(255,255,255,0.9)")
            .attr("stroke", "#ccc")
            .attr("rx", 5);
        
        // Title
        legend.append("text")
            .attr("x", legendWidth / 2)
            .attr("y", -8)
            .attr("text-anchor", "middle")
            .attr("font-size", "11px")
            .attr("font-weight", "bold")
            .text("Life Expectancy");
        
        // Create gradient definition
        const defs = this.svg.append("defs");
        const gradient = defs.append("linearGradient")
            .attr("id", "life-exp-gradient")
            .attr("x1", "0%")
            .attr("x2", "100%")
            .attr("y1", "0%")
            .attr("y2", "0%");
        
        // Add color stops for smooth gradient
        // More stops = smoother gradient
        const numStops = 20;
        for (let i = 0; i <= numStops; i++) {
            const t = i / numStops;
            const value = 20 + t * (85 - 20);  // Map to life expectancy domain
            gradient.append("stop")
                .attr("offset", `${t * 100}%`)
                .attr("stop-color", this.color(value));
        }
        
        // Gradient rectangle
        legend.append("rect")
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .style("fill", "url(#life-exp-gradient)")
            .attr("stroke", "#333")
            .attr("stroke-width", 0.5);
        
        // Create axis scale
        const legendScale = d3.scaleLinear()
            .domain([20, 85])
            .range([0, legendWidth]);
        
        // Axis with tick marks
        const legendAxis = d3.axisBottom(legendScale)
            .ticks(5)
            .tickFormat(d => d + " yrs");
        
        legend.append("g")
            .attr("transform", `translate(0, ${legendHeight})`)
            .call(legendAxis)
            .style("font-size", "9px");
    },

    /**
     * Updates the map colors for a given year's data
     * @param {Array} data - Array of country data objects for current year
     */
    update: function (data) {
        // Safety checks
        if (!state2.geoData) {
            console.warn('Choropleth: No geoData available yet');
            return;
        }
        
        if (!state2.isoMapping || Object.keys(state2.isoMapping).length === 0) {
            console.warn('Choropleth: ISO mapping not loaded yet');
            return;
        }
        
        if (!state2.countryMap || state2.countryMap.size === 0) {
            console.warn('Choropleth: Country map is empty');
            return;
        }

        const countries = topojson.feature(state2.geoData, state2.geoData.objects.countries);
        
        let matchCount = 0;
        const self = this;
        
        const paths = this.svg.selectAll("path.country")
            .data(countries.features)
            .join("path")
            .attr("class", "country")
            .attr("d", this.path)
            .style("fill", function(d) {  // Use .style() to override CSS
                // Convert numeric country ID to lowercase alpha-3 code
                const numericId = parseInt(d.id, 10);
                const alpha3 = state2.isoMapping[numericId];
                
                if (!alpha3) {
                    return "#eee";  // No ISO mapping for this country
                }

                // Lookup country data for current year
                const countryData = state2.countryMap.get(alpha3);
                if (!countryData) {
                    return "#ddd";  // No gapminder data for this country
                }

                // Ensure life_exp is valid
                if (countryData.life_exp == null || isNaN(countryData.life_exp)) {
                    return "#ddd";
                }

                matchCount++;
                return self.color(countryData.life_exp);
            })
            .attr("stroke", "#333")
            .attr("stroke-width", 0.3);

        console.log(`Choropleth: Colored ${matchCount} of ${countries.features.length} countries for year ${state2.year}`);

        // Update tooltips
        paths.select("title").remove();
        paths.append("title")
            .text(d => {
                const numericId = parseInt(d.id, 10);
                const alpha3 = state2.isoMapping[numericId];
                if (!alpha3) return "No data available";
                const countryData = state2.countryMap.get(alpha3);
                return countryData 
                    ? `${countryData.name}: ${countryData.life_exp.toFixed(1)} years` 
                    : "No data available";
            });
    },

    /**
     * Highlights countries on the map based on continent or specific country
     * Used for drill-down hover interaction from sunburst
     * @param {string|null} continent - Continent to highlight (lowercase), null to reset
     * @param {string|null} countryCode - Specific country ISO code to highlight, null for continent-level
     */
    highlight: function (continent, countryCode) {
        // Safety check
        if (!this.svg || !state2.geoData) return;
        
        const self = this;
        
        if (!continent && !countryCode) {
            // Reset all countries to normal opacity
            this.svg.selectAll("path.country")
                .style("opacity", 1)
                .attr("stroke-width", 0.3);
        } else if (countryCode) {
            // Highlight specific country
            const normalizedCode = countryCode.toLowerCase();
            this.svg.selectAll("path.country")
                .style("opacity", function(d) {
                    const numericId = parseInt(d.id, 10);
                    const alpha3 = state2.isoMapping[numericId];
                    return alpha3 === normalizedCode ? 1 : 0.2;
                })
                .attr("stroke-width", function(d) {
                    const numericId = parseInt(d.id, 10);
                    const alpha3 = state2.isoMapping[numericId];
                    return alpha3 === normalizedCode ? 2 : 0.3;
                });
        } else {
            // Highlight continent
            const normalizedContinent = continent.toLowerCase();
            this.svg.selectAll("path.country")
                .style("opacity", function(d) {
                    const numericId = parseInt(d.id, 10);
                    const alpha3 = state2.isoMapping[numericId];
                    if (!alpha3) return 0.2;
                    const countryData = state2.countryMap.get(alpha3);
                    if (!countryData) return 0.2;
                    return (countryData.continent || '').toLowerCase() === normalizedContinent ? 1 : 0.2;
                })
                .attr("stroke-width", function(d) {
                    const numericId = parseInt(d.id, 10);
                    const alpha3 = state2.isoMapping[numericId];
                    if (!alpha3) return 0.3;
                    const countryData = state2.countryMap.get(alpha3);
                    if (!countryData) return 0.3;
                    return (countryData.continent || '').toLowerCase() === normalizedContinent ? 1 : 0.3;
                });
        }
    },

    /**
     * Converts numeric country ID to lowercase ISO alpha-3 code
     * @param {string|number} id - Numeric country identifier
     * @returns {string|null} Lowercase ISO alpha-3 code or null
     */
    numericToAlpha3: function (id) {
        const numericID = parseInt(id, 10);
        if (state2.isoMapping && state2.isoMapping[numericID]) {
            return state2.isoMapping[numericID];
        }
        return null;
    }
};
