/**
 * @file force.js
 * @description Force-directed fuel clustering visualization (Task 1, Requirement 1.2)
 * 
 * Features:
 * - Force simulation with nodes representing fuel types
 * - Node size proportional to total capacity for that fuel
 * - d3.forceCollide prevents overlap
 * - Click interaction for global filtering (click fuel → filter map)
 * - Integrated fuel type color legend
 * - Nodes return to clustered state after drag
 * 
 * Force Configuration:
 * - forceCenter: Centers the simulation in the container
 * - forceManyBody: Slight attraction between nodes
 * - forceCollide: Prevents node overlap with radius + padding
 * 
 * @author DAV Assignment 2
 * @see Requirement 1.2 - Force-Directed Fuel Clustering
 */

const forceViz = {
    container: null,
    svg: null,
    simulation: null,
    centerX: 0,
    centerY: 0,
    
    /**
     * Initializes the force layout visualization
     * @param {string} containerId - DOM element ID to render into
     */
    init: function (containerId) {
        this.container = document.getElementById(containerId);
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        
        // Store center for force positioning
        this.centerX = w / 2;
        this.centerY = h / 2;

        this.svg = d3.select("#" + containerId).append("svg")
            .attr("width", w)
            .attr("height", h)
            .attr("viewBox", [0, 0, w, h]);  // Added viewBox for responsiveness

        // Configure force simulation
        // - center: Pulls nodes toward center of container
        // - charge: Slight positive strength creates clustering
        // - collide: Prevents overlap using node radius + 2px padding
        // - x/y: Additional centering forces to bring nodes back together after drag
        this.simulation = d3.forceSimulation()
            .force("center", d3.forceCenter(this.centerX, this.centerY))
            .force("charge", d3.forceManyBody().strength(20))
            .force("collide", d3.forceCollide().strength(0.8).radius(d => d.r + 3).iterations(3))
            .force("x", d3.forceX(this.centerX).strength(0.05))
            .force("y", d3.forceY(this.centerY).strength(0.05));

        // =====================================================================
        // FUEL TYPE COLOR LEGEND
        // Positioned in top-right corner
        // =====================================================================
        const legend = this.svg.append("g")
            .attr("transform", `translate(${w - 120}, 20)`);

        FUEL_COLORS.domain().forEach((fuel, i) => {
            const row = legend.append("g")
                .attr("transform", `translate(0, ${i * 18})`);
            
            row.append("circle")
                .attr("r", 5)
                .attr("fill", FUEL_COLORS(fuel))
                .attr("stroke", "none");
            
            row.append("text")
                .attr("x", 12)
                .attr("y", 4)
                .text(fuel)
                .style("font-size", "11px")
                .style("fill", "#333");
        });
    },

    /**
     * Updates the force layout with current filtered data
     * Aggregates capacity by fuel type and updates node sizes
     */
    update: function () {
        const self = this;
        
        // Aggregate capacity by fuel type from filtered data
        const fuelData = d3.rollups(state.filteredData,
            v => d3.sum(v, d => d.capacity),
            d => d.fuel
        ).map(([fuel, capacity]) => ({ fuel, capacity }));

        // Scale for node radius based on capacity
        // Sqrt scale prevents large capacities from dominating
        const rScale = d3.scaleSqrt()
            .domain([0, d3.max(fuelData, d => d.capacity) || 1])
            .range([5, 40]);

        // Pre-assign radius for collision force
        fuelData.forEach(d => d.r = rScale(d.capacity));

        // Data join for fuel nodes
        const nodes = this.svg.selectAll(".fuel-node")
            .data(fuelData, d => d.fuel)
            .join(
                // ENTER: New fuel types
                enter => enter.append("circle")
                    .attr("class", "fuel-node")
                    .attr("fill", d => FUEL_COLORS(d.fuel))
                    // Make nodes draggable within the simulation
                    .call(d3.drag()
                        .on("start", (e, d) => {
                            // Activate simulation during drag
                            if (!e.active) self.simulation.alphaTarget(0.3).restart();
                            d.fx = d.x; 
                            d.fy = d.y;
                        })
                        .on("drag", (e, d) => {
                            // Update fixed position during drag
                            d.fx = e.x; 
                            d.fy = e.y;
                        })
                        .on("end", (e, d) => {
                            // CRITICAL: Release fixed position so forces can reconverge
                            d.fx = null; 
                            d.fy = null;
                            
                            // Let simulation run to bring nodes back together
                            // Higher alpha = more energy = faster reconvergence
                            if (!e.active) {
                                self.simulation.alphaTarget(0.1);
                                // Gradually cool down to let nodes settle
                                setTimeout(() => {
                                    self.simulation.alphaTarget(0);
                                }, 500);
                            }
                        })
                    )
                    // Click to filter map by fuel type
                    .on("click", (e, d) => {
                        // Toggle filter: click same fuel again to clear
                        state.filterFuel = state.filterFuel === d.fuel ? null : d.fuel;
                        utils.updateFilters();

                        // Visual feedback: dim non-selected fuels
                        self.svg.selectAll(".fuel-node")
                            .classed("dimmed", n => state.filterFuel && n.fuel !== state.filterFuel);
                    }),
                update => update,
                exit => exit.remove()
            );

        // Animate radius changes
        nodes.transition().duration(500)
            .attr("r", d => rScale(d.capacity));

        // Update tooltips
        nodes.select("title").remove();
        nodes.append("title").text(d => `${d.fuel}: ${d3.format(",")(Math.round(d.capacity))} MW`);

        // Update collision force with new radii
        this.simulation.force("collide")
            .radius(d => d.r + 3);

        // Update simulation with new data
        this.simulation.nodes(fuelData)
            .on("tick", () => {
                nodes
                    .attr("cx", d => d.x)
                    .attr("cy", d => d.y);
            });

        // Restart simulation with fresh alpha
        this.simulation.alpha(1).restart();
    }
};