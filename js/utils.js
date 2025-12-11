/**
 * @file utils.js
 * @description Utility functions for data loading, filtering, and aggregation
 * 
 * Key responsibilities:
 * - Async data loading (CSV + TopoJSON)
 * - Multi-level aggregation computation for semantic zoom
 * - Filter management (fuel type, year range)
 * - Stacked area chart data preparation
 * 
 * @author DAV Assignment 2
 */

/**
 * Helper function to capitalize continent names for display
 * Data contains lowercase (asia, africa) but display should be (Asia, Africa)
 * @param {string} continent - Lowercase continent name
 * @returns {string} Capitalized continent name
 */
function capitalizeContinent(continent) {
    if (!continent) return 'Unknown';
    return continent.charAt(0).toUpperCase() + continent.slice(1);
}

const utils = {
    /**
     * Loads all required datasets asynchronously
     * - World TopoJSON for map background
     * - Power plant CSV (~35k records)
     * Pre-computes aggregates for all 4 semantic zoom levels
     */
    loadData: async function () {
        try {
            const [world, csv] = await Promise.all([
                d3.json("https://unpkg.com/world-atlas@2.0.2/countries-50m.json"),
                d3.csv("Data/global_power_plant_database.csv", d => ({
                    id: d.gppd_idnr,
                    name: d.name,
                    lat: +d.latitude,
                    lon: +d.longitude,
                    capacity: +d.capacity_mw,
                    fuel: d.primary_fuel,
                    country: d.country_long,
                    year: +d.commissioning_year
                }))
            ]);

            state.geoData = world;
            // Filter invalid data (missing coordinates or negative capacity)
            state.rawData = csv.filter(d => d.lat && d.lon && d.capacity >= 0);
            state.filteredData = state.rawData;

            // =========================================================
            // PRE-CALCULATE AGGREGATES FOR ALL 4 SEMANTIC ZOOM LEVELS
            // =========================================================
            
            // Level 1: Regional Aggregates (6 world regions)
            this.computeRegionalAggregates(state.rawData);
            
            // Level 2: Country Aggregates
            this.computeCountryAggregates(state.rawData);
            
            // Level 3: Spatial Clusters (using quadtree)
            this.computeClusterAggregates(state.rawData);

            console.log("Data Loaded:", state.rawData.length, "plants");
            console.log("Aggregates computed - Regional:", state.regionalAggregates.length, 
                       "Country:", state.countryAggregates.length,
                       "Clusters:", state.clusterAggregates.length);
            
            state.dispatch.call("dataLoaded");

        } catch (error) {
            console.error("Data Load Error:", error);
            document.querySelector("header").innerHTML += `<span style="color:red"> Error Loading Data</span>`;
        }
    },
    
    /**
     * Computes Level 1 aggregates: Continental/Regional groupings
     * Groups all power plants into 6 world regions
     * @param {Array} data - Power plant records
     */
    computeRegionalAggregates: function(data) {
        const regionData = {};
        
        // Initialize regions with centroid coordinates
        const regionCentroids = {
            'Africa': { lat: 0, lon: 20 },
            'Asia': { lat: 35, lon: 100 },
            'Europe': { lat: 50, lon: 10 },
            'North America': { lat: 40, lon: -100 },
            'South America': { lat: -15, lon: -60 },
            'Oceania': { lat: -25, lon: 140 }
        };
        
        Object.keys(regionCentroids).forEach(region => {
            regionData[region] = { 
                totalCapacity: 0, 
                count: 0,
                lats: [],
                lons: [],
                fuels: new Map()  // Track fuel distribution for coloring
            };
        });
        
        // Aggregate data by region
        data.forEach(d => {
            const region = COUNTRY_TO_REGION[d.country] || 'Other';
            if (regionData[region]) {
                regionData[region].totalCapacity += d.capacity;
                regionData[region].count++;
                regionData[region].lats.push(d.lat);
                regionData[region].lons.push(d.lon);
                
                // Track fuel distribution by capacity
                const fuelCapacity = regionData[region].fuels.get(d.fuel) || 0;
                regionData[region].fuels.set(d.fuel, fuelCapacity + d.capacity);
            }
        });
        
        // Convert to array format with computed centroids and dominant fuel
        state.regionalAggregates = Object.entries(regionData)
            .filter(([_, data]) => data.count > 0)
            .map(([region, data]) => {
                // Find dominant fuel type by capacity
                let dominantFuel = 'Other';
                let maxCapacity = 0;
                data.fuels.forEach((capacity, fuel) => {
                    if (capacity > maxCapacity) {
                        maxCapacity = capacity;
                        dominantFuel = fuel;
                    }
                });
                
                return {
                    region,
                    totalCapacity: data.totalCapacity,
                    count: data.count,
                    dominantFuel,
                    // Use actual data centroid for accurate positioning
                    lat: data.lats.length > 0 ? d3.mean(data.lats) : regionCentroids[region].lat,
                    lon: data.lons.length > 0 ? d3.mean(data.lons) : regionCentroids[region].lon
                };
            });
    },
    
    /**
     * Computes Level 2 aggregates: Per-country totals
     * Groups power plants by country with capacity sums and dominant fuel
     * @param {Array} data - Power plant records
     */
    computeCountryAggregates: function(data) {
        const nested = d3.rollups(data,
            v => {
                // Track fuel distribution by capacity
                const fuels = new Map();
                v.forEach(d => {
                    const fuelCapacity = fuels.get(d.fuel) || 0;
                    fuels.set(d.fuel, fuelCapacity + d.capacity);
                });
                
                // Find dominant fuel
                let dominantFuel = 'Other';
                let maxCapacity = 0;
                fuels.forEach((capacity, fuel) => {
                    if (capacity > maxCapacity) {
                        maxCapacity = capacity;
                        dominantFuel = fuel;
                    }
                });
                
                return {
                    totalCapacity: d3.sum(v, d => d.capacity),
                    lat: d3.mean(v, d => d.lat),
                    lon: d3.mean(v, d => d.lon),
                    count: v.length,
                    dominantFuel
                };
            },
            d => d.country
        );

        state.countryAggregates = nested.map(([country, data]) => ({
            country,
            region: COUNTRY_TO_REGION[country] || 'Other',
            ...data
        })).sort((a, b) => a.totalCapacity - b.totalCapacity); // Small bubbles on top
    },
    
    /**
     * Computes Level 3 aggregates: Spatial clusters using quadtree
     * Creates approximately 200-500 clusters for intermediate zoom
     * Uses grid-based clustering for performance
     * @param {Array} data - Power plant records
     */
    computeClusterAggregates: function(data) {
        // Grid-based clustering (simpler than quadtree, more predictable)
        // Divide world into grid cells of approximately 5 degrees
        const gridSize = 5;
        const clusters = new Map();
        
        data.forEach(d => {
            // Round to grid cell
            const gridLat = Math.floor(d.lat / gridSize) * gridSize;
            const gridLon = Math.floor(d.lon / gridSize) * gridSize;
            const key = `${gridLat},${gridLon}`;
            
            if (!clusters.has(key)) {
                clusters.set(key, {
                    totalCapacity: 0,
                    count: 0,
                    lats: [],
                    lons: [],
                    fuels: new Map()
                });
            }
            
            const cluster = clusters.get(key);
            cluster.totalCapacity += d.capacity;
            cluster.count++;
            cluster.lats.push(d.lat);
            cluster.lons.push(d.lon);
            
            // Track fuel distribution
            const fuelCount = cluster.fuels.get(d.fuel) || 0;
            cluster.fuels.set(d.fuel, fuelCount + d.capacity);
        });
        
        // Convert to array with computed centroids
        state.clusterAggregates = Array.from(clusters.entries()).map(([key, data]) => {
            // Find dominant fuel type
            let dominantFuel = 'Other';
            let maxCapacity = 0;
            data.fuels.forEach((capacity, fuel) => {
                if (capacity > maxCapacity) {
                    maxCapacity = capacity;
                    dominantFuel = fuel;
                }
            });
            
            return {
                id: key,
                totalCapacity: data.totalCapacity,
                count: data.count,
                lat: d3.mean(data.lats),
                lon: d3.mean(data.lons),
                dominantFuel
            };
        }).filter(d => d.count > 0);
    },

    /**
     * Central filtering logic - applies fuel and year filters
     * Recomputes aggregates for filtered data
     * Triggers stateChanged event for reactive updates
     */
    updateFilters: function () {
        let data = state.rawData;

        // 1. Filter by Fuel Type (from Force Layout click)
        if (state.filterFuel) {
            data = data.filter(d => d.fuel === state.filterFuel);
        }

        // 2. Filter by Year Range (from Timeline Brush)
        // Include plants without year data (NaN/null) along with those in range
        // This ensures ~17k plants without commissioning_year are not excluded
        if (state.filterRange) {
            const [min, max] = state.filterRange;
            data = data.filter(d => !d.year || isNaN(d.year) || (d.year >= min && d.year <= max));
        }

        state.filteredData = data;
        
        // Recompute aggregates for filtered data
        this.computeRegionalAggregates(data);
        this.computeCountryAggregates(data);
        this.computeClusterAggregates(data);
        
        state.dispatch.call("stateChanged");
    },

    // Helper for Stacked Area Chart
    getStackedData: function (data) {
        // Group by Year -> Fuel -> Sum(Capacity)
        const years = d3.rollups(data,
            v => {
                const map = new Map();
                // Initialize all fuels to 0 for this year
                FUEL_COLORS.domain().forEach(f => map.set(f, 0));
                // Sum actual values
                v.forEach(d => {
                    const current = map.get(d.fuel) || 0;
                    map.set(d.fuel, current + d.capacity);
                });
                return map;
            },
            d => d.year
        ).filter(([year, _]) => year > 1900 && year < 2024) // Filter outliers
            .sort((a, b) => a[0] - b[0]);

        // Convert to array of objects for d3.stack
        return years.map(([year, map]) => {
            const obj = { year };
            map.forEach((val, key) => obj[key] = val);
            return obj;
        });
    },

    loadGapminderData: function () {
        Promise.all([
            d3.json("https://unpkg.com/world-atlas@2.0.2/countries-50m.json"),
            d3.json("Data/gapminder_clean.json"),
            d3.json("https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.json")
        ]).then(([geoData, gapminderData, isoData]) => {
            state2.geoData = geoData;
            state2.data = gapminderData;

            // Create ISO Mapping: numeric code -> lowercase alpha-3
            // The TopoJSON uses string IDs like "004", "840" which we convert to numbers
            // The gapminder uses lowercase alpha-3 like "afg", "usa"
            state2.isoMapping = {};
            isoData.forEach(d => {
                const numericCode = parseInt(d["country-code"], 10);
                const alpha3Lower = d["alpha-3"].toLowerCase();
                state2.isoMapping[numericCode] = alpha3Lower;
            });
            
            // Debug: log a sample mapping
            console.log("ISO Mapping sample: 4 ->", state2.isoMapping[4], 
                       ", 840 ->", state2.isoMapping[840],
                       ", 36 ->", state2.isoMapping[36]);
            console.log("Total ISO mappings:", Object.keys(state2.isoMapping).length);

            state2.dispatch.call("dataLoaded", null, state2.data);
        }).catch(error => {
            console.error("Error loading Task 2 data:", error);
        });
    }
};