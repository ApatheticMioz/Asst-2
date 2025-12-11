/**
 * @file controls.js
 * @description Interactive controls for Task 2 - Gapminder Dashboard
 * 
 * Key components:
 * 1. Custom SVG year slider using d3.drag (NOT HTML input)
 * 2. Play/Pause button for animation control
 * 3. Sunburst drill-down chart for hierarchical navigation
 * 
 * @author DAV Assignment 2
 * @see Requirement 2.3 - Interactive State Controls (d3.drag slider)
 */

const controls = {
    // Slider components
    sliderSvg: null,
    sliderHandle: null,
    sliderXScale: null,
    sliderYearLabel: null,
    sliderTrackFill: null,
    
    // Drill-down chart components
    svg: null,
    partition: null,
    arc: null,
    color: null,
    
    /**
     * Initializes all control components
     * @param {string} containerId - DOM element ID for drill-down chart
     */
    init: function (containerId) {
        // =====================================================================
        // PLAY/PAUSE BUTTON
        // =====================================================================
        d3.select("#play-btn").on("click", () => {
            const isPlaying = !state2.playing;
            d3.select("#play-btn").text(isPlaying ? "Pause" : "Play");
            state2.dispatch.call("playToggled", null, isPlaying);
        });

        // =====================================================================
        // CUSTOM D3 DRAG-BASED YEAR SLIDER
        // Using d3.drag() as required by assignment (NOT HTML input)
        // =====================================================================
        this.initDragSlider();

        // =====================================================================
        // DRILL-DOWN SUNBURST CHART
        // World → Continent → Country hierarchy
        // =====================================================================
        const container = document.getElementById("drilldown-container");
        const w = container.clientWidth, h = container.clientHeight;
        const radius = Math.min(w, h) / 2 - 10;

        this.svg = d3.select("#drilldown-container").append("svg")
            .attr("width", w).attr("height", h)
            .attr("viewBox", [0, 0, w, h])  // viewBox for responsiveness
            .append("g")
            .attr("transform", `translate(${w / 2},${h / 2})`);

        // Partition layout for sunburst
        this.partition = d3.partition()
            .size([2 * Math.PI, radius]);

        // Arc generator for sunburst segments
        this.arc = d3.arc()
            .startAngle(d => d.x0)
            .endAngle(d => d.x1)
            .innerRadius(d => d.y0)
            .outerRadius(d => d.y1);

        // Color scale for continents
        this.color = d3.scaleOrdinal(d3.schemeCategory10);
    },
    
    /**
     * Initializes the custom SVG-based year slider with d3.drag
     * This is the CRITICAL implementation required by the assignment
     * Replaces HTML <input type="range"> with pure D3 implementation
     */
    initDragSlider: function() {
        const sliderContainer = d3.select("#year-slider-container");
        
        // Get container dimensions
        const containerNode = sliderContainer.node();
        const sliderWidth = containerNode ? containerNode.clientWidth || 400 : 400;
        const sliderHeight = 40;
        const padding = 20;
        
        // Create SVG for slider
        this.sliderSvg = sliderContainer.append("svg")
            .attr("width", "100%")
            .attr("height", sliderHeight)
            .attr("viewBox", `0 0 ${sliderWidth} ${sliderHeight}`);
        
        // Year scale: Maps pixel position to year value
        this.sliderXScale = d3.scaleLinear()
            .domain([1800, 2023])  // Year range
            .range([padding, sliderWidth - padding])
            .clamp(true);  // Prevents handle from going outside bounds
        
        const trackY = sliderHeight / 2;
        
        // Slider track background (full track)
        this.sliderSvg.append("line")
            .attr("class", "slider-track-bg")
            .attr("x1", this.sliderXScale.range()[0])
            .attr("x2", this.sliderXScale.range()[1])
            .attr("y1", trackY)
            .attr("y2", trackY)
            .attr("stroke", "#ddd")
            .attr("stroke-width", 8)
            .attr("stroke-linecap", "round");
        
        // Slider track fill (shows progress)
        this.sliderTrackFill = this.sliderSvg.append("line")
            .attr("class", "slider-track-fill")
            .attr("x1", this.sliderXScale.range()[0])
            .attr("x2", this.sliderXScale(state2.year))
            .attr("y1", trackY)
            .attr("y2", trackY)
            .attr("stroke", "#3498db")
            .attr("stroke-width", 8)
            .attr("stroke-linecap", "round");
        
        // Click anywhere on track to jump to that year
        this.sliderSvg.append("rect")
            .attr("class", "slider-track-overlay")
            .attr("x", this.sliderXScale.range()[0])
            .attr("y", trackY - 10)
            .attr("width", this.sliderXScale.range()[1] - this.sliderXScale.range()[0])
            .attr("height", 20)
            .attr("fill", "transparent")
            .style("cursor", "pointer")
            .on("click", (event) => {
                // Stop animation if playing
                if (state2.playing) {
                    d3.select("#play-btn").text("Play");
                    state2.dispatch.call("playToggled", null, false);
                }
                
                // Calculate year from click position
                const [x] = d3.pointer(event);
                const year = Math.round(this.sliderXScale.invert(x));
                state2.dispatch.call("yearChanged", null, year);
            });
        
        // Year tick marks
        const tickYears = [1800, 1850, 1900, 1950, 2000, 2023];
        this.sliderSvg.selectAll(".slider-tick")
            .data(tickYears)
            .join("line")
            .attr("class", "slider-tick")
            .attr("x1", d => this.sliderXScale(d))
            .attr("x2", d => this.sliderXScale(d))
            .attr("y1", trackY + 8)
            .attr("y2", trackY + 14)
            .attr("stroke", "#999")
            .attr("stroke-width", 1);
        
        // Year tick labels
        this.sliderSvg.selectAll(".slider-tick-label")
            .data(tickYears)
            .join("text")
            .attr("class", "slider-tick-label")
            .attr("x", d => this.sliderXScale(d))
            .attr("y", trackY + 26)
            .attr("text-anchor", "middle")
            .attr("font-size", "9px")
            .attr("fill", "#666")
            .text(d => d);
        
        // Slider handle (draggable circle)
        this.sliderHandle = this.sliderSvg.append("circle")
            .attr("class", "slider-handle")
            .attr("cx", this.sliderXScale(state2.year))
            .attr("cy", trackY)
            .attr("r", 12)
            .attr("fill", "#3498db")
            .attr("stroke", "#fff")
            .attr("stroke-width", 3)
            .style("cursor", "grab")
            .style("filter", "drop-shadow(0 2px 3px rgba(0,0,0,0.3))");
        
        // Year label above handle
        this.sliderYearLabel = this.sliderSvg.append("text")
            .attr("class", "slider-year-label")
            .attr("x", this.sliderXScale(state2.year))
            .attr("y", trackY - 18)
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .attr("font-weight", "bold")
            .attr("fill", "#333")
            .text(state2.year);
        
        // =====================================================================
        // D3.DRAG IMPLEMENTATION (CRITICAL ASSIGNMENT REQUIREMENT)
        // =====================================================================
        const self = this;
        const drag = d3.drag()
            .on("start", function(event) {
                // Stop animation when user starts dragging
                if (state2.playing) {
                    d3.select("#play-btn").text("Play");
                    state2.dispatch.call("playToggled", null, false);
                }
                // Change cursor to indicate dragging
                d3.select(this)
                    .style("cursor", "grabbing")
                    .attr("r", 14);  // Slightly enlarge handle
            })
            .on("drag", function(event) {
                // Constrain x position to slider range
                const newX = Math.max(
                    self.sliderXScale.range()[0],
                    Math.min(self.sliderXScale.range()[1], event.x)
                );
                
                // Update handle position immediately
                d3.select(this).attr("cx", newX);
                
                // Calculate year from position
                const year = Math.round(self.sliderXScale.invert(newX));
                
                // Update label and track fill
                self.sliderYearLabel
                    .attr("x", newX)
                    .text(year);
                self.sliderTrackFill
                    .attr("x2", newX);
                
                // Dispatch year change event for all views to update
                state2.dispatch.call("yearChanged", null, year);
            })
            .on("end", function(event) {
                // Reset cursor
                d3.select(this)
                    .style("cursor", "grab")
                    .attr("r", 12);  // Reset handle size
                
                // Snap to nearest integer year with smooth transition
                const currentX = +d3.select(this).attr("cx");
                const year = Math.round(self.sliderXScale.invert(currentX));
                const snappedX = self.sliderXScale(year);
                
                d3.select(this)
                    .transition()
                    .duration(100)
                    .attr("cx", snappedX);
                
                self.sliderYearLabel
                    .transition()
                    .duration(100)
                    .attr("x", snappedX);
                
                self.sliderTrackFill
                    .transition()
                    .duration(100)
                    .attr("x2", snappedX);
            });
        
        // Apply drag behavior to handle
        this.sliderHandle.call(drag);
    },

    /**
     * Updates all controls for a given year
     * Called when year changes (animation, slider drag, etc.)
     * @param {number} year - Year to display (1800-2023)
     */
    update: function (year) {
        // Update year display text
        d3.select("#year-display").text(year);
        
        // Update custom slider position (if not currently being dragged)
        if (this.sliderHandle && this.sliderXScale) {
            this.sliderHandle
                .transition()
                .duration(100)
                .attr("cx", this.sliderXScale(year));
            
            this.sliderYearLabel
                .transition()
                .duration(100)
                .attr("x", this.sliderXScale(year))
                .text(year);
            
            this.sliderTrackFill
                .transition()
                .duration(100)
                .attr("x2", this.sliderXScale(year));
        }

        // =====================================================================
        // DRILL-DOWN SUNBURST UPDATE
        // =====================================================================
        const yearData = state2.data.find(d => d.year === year);
        if (!yearData) return;

        // Build hierarchy: World → Continent → Country
        const grouped = d3.group(yearData.countries, d => d.continent);

        const hierarchyData = {
            name: "World",
            children: Array.from(grouped, ([key, values]) => ({
                name: key,
                children: values.map(v => ({ ...v, name: v.name }))  // Ensure name property
            }))
            // Sort continents alphabetically for consistent ordering
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        };

        const root = d3.hierarchy(hierarchyData)
            .sum(d => d.population || 0)  // Size slices by population
            // CONSISTENT SORTING: Sort by name within each level for stable order
            .sort((a, b) => (a.data.name || '').localeCompare(b.data.name || ''));

        this.partition(root);

        // Render sunburst slices
        this.svg.selectAll("path")
            .data(root.descendants().filter(d => d.depth > 0), d => d.data.name)  // Use name as key for stable updates
            .join("path")
            .attr("d", this.arc)
            .style("fill", d => {
                // Color by continent (depth 1 = continent, depth 2 = country)
                if (d.depth === 1) return this.color(d.data.name);
                return this.color(d.parent.data.name);  // Inherit parent color
            })
            .style("stroke", "white")
            .style("stroke-width", "0.5px")
            .style("opacity", 1)
            .on("mouseover", (e, d) => {
                // Determine continent and country being hovered
                const continent = d.depth === 1 ? d.data.name : d.parent.data.name;
                // For country level (depth 2), pass the country ISO code
                const countryCode = d.depth === 2 ? d.data.country : null;
                
                // Dispatch hover event with both continent and country info
                state2.dispatch.call("hoverContinent", null, { continent, countryCode });

                // Dim non-hovered slices - highlight hovered slice and siblings (same continent)
                if (d.depth === 2) {
                    // Hovering a country: highlight just that country's slice and dim others
                    this.svg.selectAll("path").style("opacity", p => {
                        if (p === d) return 1;  // Hovered country
                        if (p.depth === 1 && p.data.name === continent) return 0.7;  // Parent continent
                        return 0.2;
                    });
                } else {
                    // Hovering a continent: highlight continent and all its countries
                    this.svg.selectAll("path").style("opacity", p => {
                        if (p === d) return 1;  // Hovered continent
                        if (p.depth === 2 && p.parent.data.name === continent) return 0.8;  // Child countries
                        return 0.2;
                    });
                }
            })
            .on("mouseout", (e, d) => {
                state2.dispatch.call("hoverContinent", null, null);
                this.svg.selectAll("path").style("opacity", 1);
            })
            .select("title").remove();
        
        // Add tooltips with proper name display
        this.svg.selectAll("path")
            .append("title")
            .text(d => {
                const displayName = d.depth === 1 
                    ? capitalizeContinent(d.data.name)  // Capitalize continent 
                    : d.data.name;  // Country name as-is
                return `${displayName}\nPopulation: ${d3.format(".2s")(d.value)}`;
            });
    }
};
