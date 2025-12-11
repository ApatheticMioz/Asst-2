/**
 * @file map.js
 * @description Zoomable Geographic Visualization (Task 1, Requirement 1.1)
 * 
 * Implements semantic zooming with 4 distinct aggregation levels:
 * - Level 1 (zoom 1.0-2.0): Regional aggregates - Continental scale circles
 * - Level 2 (zoom 2.0-4.0): Country aggregates - Per-country capacity bubbles  
 * - Level 3 (zoom 4.0-6.0): Spatial clusters - Grid-based groupings
 * - Level 4 (zoom 6.0+): Individual points - Exact power plant locations
 * 
 * Performance Optimizations:
 * - Viewport culling for large datasets (only render visible points)
 * - Progressive rendering limited to 5000 points max
 * - Lazy rendering of individual points (only at high zoom)
 * 
 * Projection: geoMercator - Chosen for familiarity and good continental shapes
 * Scale 130, centered below equator (h/1.5) to show all landmasses
 * 
 * @author DAV Assignment 2
 * @see Assignment Requirement 1.1 - Semantic Zooming
 */

const mapViz = {
    // SVG elements and layers
    svg: null, 
    gMap: null,           // Base map layer (country shapes)
    gRegional: null,      // Level 1: Regional aggregates
    gCountries: null,     // Level 2: Country aggregates  
    gClusters: null,      // Level 3: Spatial clusters
    gPoints: null,        // Level 4: Individual power plants
    gLegend: null,        // Size legend group
    
    // Projection and path generator
    projection: null, 
    path: null,
    
    // Dimensions
    width: 0,
    height: 0,
    
    // Current semantic level for transition detection
    previousLevel: 'REGIONAL',

    /**
     * Initializes the map visualization
     * Sets up SVG, projection, layers, zoom behavior, and tooltip
     * @param {string} containerId - DOM element ID to render into
     */
    init: function (containerId) {
        const container = document.getElementById(containerId);
        this.width = container.clientWidth;
        this.height = container.clientHeight;

        // Create SVG with viewBox for responsiveness
        this.svg = d3.select("#" + containerId).append("svg")
            .attr("width", this.width)
            .attr("height", this.height)
            .attr("viewBox", [0, 0, this.width, this.height]);

        // Mercator projection - standard for web maps
        // Scale 130 fits world nicely, translate y by h/1.5 shifts view slightly south
        this.projection = d3.geoMercator()
            .scale(130)
            .translate([this.width / 2, this.height / 1.5]);
        this.path = d3.geoPath(this.projection);

        // Create layer groups in draw order (back to front)
        // Map background first, then aggregates, then points on top
        this.gMap = this.svg.append("g").attr("class", "layer-map");
        this.gRegional = this.svg.append("g").attr("class", "layer-regional");
        this.gCountries = this.svg.append("g").attr("class", "layer-countries");
        this.gClusters = this.svg.append("g").attr("class", "layer-clusters");
        this.gPoints = this.svg.append("g").attr("class", "layer-points");
        this.gLegend = this.svg.append("g").attr("class", "layer-legend");

        // Initialize visibility - start at Level 1 (Regional)
        this.gRegional.style("opacity", 1);
        this.gCountries.style("opacity", 0);
        this.gClusters.style("opacity", 0);
        this.gPoints.style("opacity", 0);

        // Configure zoom behavior
        // Scale extent [1, 12] allows zooming from world view to city level
        const zoom = d3.zoom()
            .scaleExtent([1, 12])
            .on("zoom", e => this.handleZoom(e));
        this.svg.call(zoom);

        // Tooltip for hover information
        this.tooltip = d3.select("body").append("div")
            .attr("class", "d3-tooltip")
            .style("opacity", 0);
            
        // Initialize legend
        this.initLegend();
    },
    
    /**
     * Initializes the size legend showing capacity to radius mapping
     * Positioned in bottom-right corner
     */
    initLegend: function() {
        // Legend values representing typical capacity ranges
        const legendData = [1000, 10000, 50000]; // MW
        const legendX = this.width - 130;
        const legendY = this.height - 120;
        
        const legend = this.gLegend
            .attr("transform", `translate(${legendX}, ${legendY})`);
        
        // Semi-transparent background
        legend.append("rect")
            .attr("x", -10)
            .attr("y", -25)
            .attr("width", 130)
            .attr("height", 115)
            .attr("fill", "rgba(255,255,255,0.9)")
            .attr("stroke", "#ccc")
            .attr("rx", 5);
        
        // Title
        legend.append("text")
            .attr("x", 0)
            .attr("y", -8)
            .attr("font-weight", "bold")
            .attr("font-size", "11px")
            .text("Capacity (MW)");
        
        // Create a scale matching the aggregate scale
        const rScaleLegend = d3.scaleSqrt()
            .domain([0, 100000])
            .range([2, 25]);
        
        // Draw circles and labels
        legendData.forEach((value, i) => {
            const y = i * 30 + 20;
            
            legend.append("circle")
                .attr("cx", 20)
                .attr("cy", y)
                .attr("r", rScaleLegend(value))
                .attr("fill", "rgba(52, 152, 219, 0.6)")
                .attr("stroke", "#333")
                .attr("stroke-width", 1);
            
            legend.append("text")
                .attr("x", 50)
                .attr("y", y + 4)
                .attr("font-size", "10px")
                .text(d3.format(",")(value));
        });
    },

    /**
     * Main update function - called when data changes
     * Renders all 4 levels of aggregation
     * Uses viewport culling for performance on large datasets
     */
    update: function () {
        // A. Draw base map (only once)
        if (state.geoData && this.gMap.selectAll("path").empty()) {
            const countries = topojson.feature(state.geoData, state.geoData.objects.countries);
            this.gMap.selectAll("path")
                .data(countries.features)
                .join("path")
                .attr("class", "country")
                .attr("d", this.path);
        }

        // Debug logging
        console.log("Map update - Aggregates:", {
            regional: state.regionalAggregates?.length || 0,
            country: state.countryAggregates?.length || 0,
            cluster: state.clusterAggregates?.length || 0,
            individual: state.filteredData?.length || 0
        });

        // B. Render all 4 aggregation levels
        this.renderRegionalLevel();
        this.renderCountryLevel();
        this.renderClusterLevel();
        this.renderIndividualLevel();
        
        // Update visibility based on current zoom
        this.updateVisibility();
    },
    
    /**
     * Renders Level 1: Regional/Continental aggregates
     * Shows 6 large circles representing world regions
     * Colored by dominant fuel type for consistency with other levels
     */
    renderRegionalLevel: function() {
        if (!state.regionalAggregates || state.regionalAggregates.length === 0) {
            console.warn("No regional aggregates available");
            return;
        }
        
        console.log("Rendering regional level with", state.regionalAggregates.length, "regions");
        
        const rScale = d3.scaleSqrt()
            .domain([0, d3.max(state.regionalAggregates, d => d.totalCapacity) || 1])
            .range([15, 60]);
        
        const self = this;
        
        this.gRegional.selectAll("circle")
            .data(state.regionalAggregates, d => d.region)
            .join(
                enter => enter.append("circle")
                    .attr("class", "regional-node")
                    .attr("fill", d => FUEL_COLORS(d.dominantFuel))
                    .style("opacity", 0.7)
                    .attr("stroke", d => d3.color(FUEL_COLORS(d.dominantFuel)).darker(0.5))
                    .attr("stroke-width", 2)
                    .style("cursor", "pointer")
                    .attr("cx", d => {
                        const coords = self.projection([d.lon, d.lat]);
                        return coords ? coords[0] : -9999;
                    })
                    .attr("cy", d => {
                        const coords = self.projection([d.lon, d.lat]);
                        return coords ? coords[1] : -9999;
                    })
                    .attr("r", d => rScale(d.totalCapacity))
                    .on("mouseover", (e, d) => self.showTooltip(e, 
                        `<strong>${d.region}</strong><br>
                         Plants: ${d3.format(",")(d.count)}<br>
                         Total: ${d3.format(",.0f")(d.totalCapacity)} MW<br>
                         Primary: ${d.dominantFuel}`))
                    .on("mouseout", () => self.hideTooltip()),
                update => update
                    .attr("fill", d => FUEL_COLORS(d.dominantFuel))
                    .attr("stroke", d => d3.color(FUEL_COLORS(d.dominantFuel)).darker(0.5))
                    .attr("cx", d => {
                        const coords = self.projection([d.lon, d.lat]);
                        return coords ? coords[0] : -9999;
                    })
                    .attr("cy", d => {
                        const coords = self.projection([d.lon, d.lat]);
                        return coords ? coords[1] : -9999;
                    })
                    .attr("r", d => rScale(d.totalCapacity)),
                exit => exit.remove()
            );
        
        console.log("Regional circles created:", this.gRegional.selectAll("circle").size());
    },
    
    /**
     * Renders Level 2: Country aggregates
     * Shows per-country capacity bubbles colored by dominant fuel type
     */
    renderCountryLevel: function() {
        // Handle empty data case
        if (!state.countryAggregates || state.countryAggregates.length === 0) {
            console.warn("No country aggregates available");
            return;
        }
        
        console.log("Rendering country level with", state.countryAggregates.length, "countries");
        
        const rScale = d3.scaleSqrt()
            .domain([0, d3.max(state.countryAggregates, d => d.totalCapacity) || 1])
            .range([3, 35]);
        
        const self = this;
        
        this.gCountries.selectAll("circle")
            .data(state.countryAggregates, d => d.country)
            .join(
                enter => enter.append("circle")
                    .attr("class", "aggregate-node")
                    .attr("fill", d => FUEL_COLORS(d.dominantFuel))
                    .style("opacity", 0.7)
                    .attr("stroke", d => d3.color(FUEL_COLORS(d.dominantFuel)).darker(0.5))
                    .attr("stroke-width", 1)
                    .style("cursor", "pointer")
                    .attr("cx", d => {
                        const coords = self.projection([d.lon, d.lat]);
                        return coords ? coords[0] : -9999;
                    })
                    .attr("cy", d => {
                        const coords = self.projection([d.lon, d.lat]);
                        return coords ? coords[1] : -9999;
                    })
                    .attr("r", d => rScale(d.totalCapacity))
                    .on("mouseover", (e, d) => self.showTooltip(e, 
                        `<strong>${d.country}</strong><br>
                         Plants: ${d3.format(",")(d.count)}<br>
                         Total: ${d3.format(",.0f")(d.totalCapacity)} MW<br>
                         Primary: ${d.dominantFuel}`))
                    .on("mouseout", () => self.hideTooltip()),
                update => update
                    .attr("fill", d => FUEL_COLORS(d.dominantFuel))
                    .attr("stroke", d => d3.color(FUEL_COLORS(d.dominantFuel)).darker(0.5))
                    .attr("stroke-width", 1)
                    .attr("cx", d => {
                        const coords = self.projection([d.lon, d.lat]);
                        return coords ? coords[0] : -9999;
                    })
                    .attr("cy", d => {
                        const coords = self.projection([d.lon, d.lat]);
                        return coords ? coords[1] : -9999;
                    })
                    .attr("r", d => rScale(d.totalCapacity)),
                exit => exit.remove()
            );
        
        console.log("Country circles created:", this.gCountries.selectAll("circle").size());
    },
    
    /**
     * Renders Level 3: Spatial clusters
     * Shows grid-based cluster aggregates colored by dominant fuel
     */
    renderClusterLevel: function() {
        if (!state.clusterAggregates || state.clusterAggregates.length === 0) {
            console.warn("No cluster aggregates available");
            return;
        }
        
        console.log("Rendering cluster level with", state.clusterAggregates.length, "clusters");
        
        const rScale = d3.scaleSqrt()
            .domain([0, d3.max(state.clusterAggregates, d => d.totalCapacity) || 1])
            .range([2, 20]);
        
        const self = this;
        
        this.gClusters.selectAll("circle")
            .data(state.clusterAggregates, d => d.id)
            .join(
                enter => enter.append("circle")
                    .attr("class", "cluster-node")
                    .attr("fill", d => FUEL_COLORS(d.dominantFuel))
                    .style("opacity", 0.7)
                    .style("cursor", "pointer")
                    .attr("cx", d => {
                        const coords = self.projection([d.lon, d.lat]);
                        return coords ? coords[0] : -9999;
                    })
                    .attr("cy", d => {
                        const coords = self.projection([d.lon, d.lat]);
                        return coords ? coords[1] : -9999;
                    })
                    .attr("r", d => rScale(d.totalCapacity))
                    .on("mouseover", (e, d) => self.showTooltip(e, 
                        `<strong>Cluster</strong><br>
                         Plants: ${d3.format(",")(d.count)}<br>
                         Capacity: ${d3.format(",.0f")(d.totalCapacity)} MW<br>
                         Primary: ${d.dominantFuel}`))
                    .on("mouseout", () => self.hideTooltip()),
                update => update
                    .attr("fill", d => FUEL_COLORS(d.dominantFuel))
                    .attr("cx", d => {
                        const coords = self.projection([d.lon, d.lat]);
                        return coords ? coords[0] : -9999;
                    })
                    .attr("cy", d => {
                        const coords = self.projection([d.lon, d.lat]);
                        return coords ? coords[1] : -9999;
                    })
                    .attr("r", d => rScale(d.totalCapacity)),
                exit => exit.remove()
            );
        
        console.log("Cluster circles created:", this.gClusters.selectAll("circle").size());
    },
    
    /**
     * Renders Level 4: Individual power plants
     * Implements viewport culling and point limit for performance
     * Only renders when zoom >= INDIVIDUAL threshold
     */
    renderIndividualLevel: function() {
        const T = state.ZOOM_THRESHOLDS;
        
        // Only render points at high zoom for performance
        if (state.zoomLevel < T.INDIVIDUAL) {
            this.gPoints.selectAll("circle").remove();
            return;
        }
        
        // Performance optimization: Viewport culling
        // Only render points visible in current viewport
        const transform = d3.zoomTransform(this.svg.node());
        const visibleData = this.getVisibleData(state.filteredData, transform);
        
        // Limit to 5000 points max for performance
        // Sort by capacity descending to show largest plants first
        const MAX_POINTS = 5000;
        const renderData = visibleData.length > MAX_POINTS
            ? visibleData.sort((a, b) => b.capacity - a.capacity).slice(0, MAX_POINTS)
            : visibleData;
        
        const rScale = d3.scaleSqrt()
            .domain([0, 5000])
            .range([0.5, 4]);
        
        this.gPoints.selectAll("circle")
            .data(renderData, d => d.id)
            .join(
                enter => enter.append("circle")
                    .attr("class", "plant-node")
                    .attr("fill", d => FUEL_COLORS(d.fuel))
                    .on("mouseover", (e, d) => this.showTooltip(e, 
                        `<strong>${d.name}</strong><br>
                         ${d.fuel}<br>
                         ${d3.format(",")(d.capacity)} MW<br>
                         ${d.country}`))
                    .on("mouseout", () => this.hideTooltip()),
                update => update.attr("fill", d => FUEL_COLORS(d.fuel)),
                exit => exit.remove()
            )
            .attr("cx", d => {
                const coords = this.projection([d.lon, d.lat]);
                return coords ? coords[0] : -9999;
            })
            .attr("cy", d => {
                const coords = this.projection([d.lon, d.lat]);
                return coords ? coords[1] : -9999;
            })
            .attr("r", d => rScale(d.capacity));
    },
    
    /**
     * Filters data to only include points visible in current viewport
     * Performance optimization for large datasets
     * @param {Array} data - Full dataset
     * @param {Object} transform - Current d3 zoom transform
     * @returns {Array} Points within viewport bounds
     */
    getVisibleData: function(data, transform) {
        // Calculate viewport bounds in projection coordinates
        const viewportBounds = {
            minX: -transform.x / transform.k,
            maxX: (this.width - transform.x) / transform.k,
            minY: -transform.y / transform.k,
            maxY: (this.height - transform.y) / transform.k
        };
        
        return data.filter(d => {
            const coords = this.projection([d.lon, d.lat]);
            if (!coords) return false;
            const [x, y] = coords;
            return x >= viewportBounds.minX && x <= viewportBounds.maxX &&
                   y >= viewportBounds.minY && y <= viewportBounds.maxY;
        });
    },

    /**
     * Handles zoom events from d3.zoom
     * Determines semantic level and triggers transitions when crossing thresholds
     * @param {Object} e - D3 zoom event with transform data
     */
    handleZoom: function (e) {
        const t = e.transform;
        const oldZoom = state.zoomLevel;
        const oldLevel = this.getCurrentLevel(oldZoom);
        
        state.zoomLevel = t.k;
        const newLevel = this.getCurrentLevel(t.k);

        // Apply geometric transform to all layers
        this.gMap.attr("transform", t);
        this.gRegional.attr("transform", t);
        this.gCountries.attr("transform", t);
        this.gClusters.attr("transform", t);
        this.gPoints.attr("transform", t);

        // Adjust stroke width to maintain consistent appearance during zoom
        this.gMap.selectAll("path").style("stroke-width", 0.5 / t.k);

        // Check for semantic level crossing
        if (oldLevel !== newLevel) {
            console.log(`Semantic Zoom: ${oldLevel} → ${newLevel} (zoom: ${t.k.toFixed(2)})`);
            this.transitionBetweenLevels(oldLevel, newLevel);
            state.dispatch.call("levelChanged", null, newLevel);
        } else {
            this.updateVisibility();
        }
        
        // Re-render individual points on pan/zoom for viewport culling
        if (newLevel === 'INDIVIDUAL') {
            this.renderIndividualLevel();
        }
    },
    
    /**
     * Determines current semantic level based on zoom factor
     * @param {number} zoom - Current zoom scale factor
     * @returns {string} Level name: REGIONAL, COUNTRY, CLUSTER, or INDIVIDUAL
     */
    getCurrentLevel: function(zoom) {
        const T = state.ZOOM_THRESHOLDS;
        if (zoom < T.COUNTRY) return 'REGIONAL';
        if (zoom < T.CLUSTER) return 'COUNTRY';
        if (zoom < T.INDIVIDUAL) return 'CLUSTER';
        return 'INDIVIDUAL';
    },
    
    /**
     * Animates transition between semantic zoom levels
     * Creates "explosion" effect when zooming in, "coalescence" when zooming out
     * @param {string} oldLevel - Previous semantic level
     * @param {string} newLevel - New semantic level
     */
    transitionBetweenLevels: function(oldLevel, newLevel) {
        const duration = 400;
        const easing = d3.easeCubicInOut;
        
        // Determine direction (zooming in or out)
        const levels = ['REGIONAL', 'COUNTRY', 'CLUSTER', 'INDIVIDUAL'];
        const zoomingIn = levels.indexOf(newLevel) > levels.indexOf(oldLevel);
        
        console.log("Transition:", oldLevel, "->", newLevel, "(zooming " + (zoomingIn ? "in" : "out") + ")");
        
        // Layer map
        const layerMap = {
            'REGIONAL': this.gRegional,
            'COUNTRY': this.gCountries,
            'CLUSTER': this.gClusters,
            'INDIVIDUAL': this.gPoints
        };
        
        // Debug: check if circles exist in the new layer
        const circleCount = layerMap[newLevel].selectAll("circle").size();
        console.log("Circles in", newLevel, "layer:", circleCount);
        
        // Old layer fades out
        layerMap[oldLevel]
            .transition()
            .duration(duration / 2)
            .ease(easing)
            .style("opacity", 0)
            .style("pointer-events", "none");
        
        // New layer fades in
        layerMap[newLevel]
            .transition()
            .duration(duration)
            .ease(easing)
            .style("opacity", 1)
            .style("pointer-events", "all");
        
        this.previousLevel = newLevel;
    },

    /**
     * Updates layer visibility based on current zoom level
     * Called on zoom events that don't cross semantic thresholds
     */
    updateVisibility: function () {
        const level = this.getCurrentLevel(state.zoomLevel);
        
        // Set visibility for each layer
        this.gRegional
            .style("opacity", level === 'REGIONAL' ? 1 : 0)
            .style("pointer-events", level === 'REGIONAL' ? "all" : "none");
        
        this.gCountries
            .style("opacity", level === 'COUNTRY' ? 1 : 0)
            .style("pointer-events", level === 'COUNTRY' ? "all" : "none");
        
        this.gClusters
            .style("opacity", level === 'CLUSTER' ? 1 : 0)
            .style("pointer-events", level === 'CLUSTER' ? "all" : "none");
        
        this.gPoints
            .style("opacity", level === 'INDIVIDUAL' ? 1 : 0)
            .style("pointer-events", level === 'INDIVIDUAL' ? "all" : "none");
    },

    /**
     * Shows tooltip at mouse position with HTML content
     * @param {Object} e - Mouse event for positioning
     * @param {string} html - Tooltip HTML content
     */
    showTooltip: function (e, html) {
        this.tooltip.style("opacity", 1).html(html)
            .style("left", (e.pageX + 10) + "px")
            .style("top", (e.pageY - 20) + "px");
    },
    
    /**
     * Hides the tooltip
     */
    hideTooltip: function () { 
        this.tooltip.style("opacity", 0); 
    }
};