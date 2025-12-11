/**
 * @file state.js
 * @description Global application state for Task 1 - Power Plant Dashboard
 * 
 * Manages centralized state including:
 * - Raw and filtered data storage
 * - Multi-level semantic zoom configuration (4 levels)
 * - Filter states for fuel type and year range
 * - Event dispatch for reactive updates
 * 
 * @author DAV Assignment 2
 * @see Requirement 1.1 - Semantic Zooming
 */

const state = {
    // =====================================================================
    // DATA STORAGE
    // =====================================================================
    rawData: [],        // Full CSV dataset (~35k power plants)
    geoData: null,      // TopoJSON world map for base layer
    
    // =====================================================================
    // DERIVED/AGGREGATED DATA
    // Pre-computed aggregates for each semantic zoom level
    // =====================================================================
    filteredData: [],       // Currently visible plants after filtering
    regionalAggregates: [], // Level 1: Continental/regional groupings
    countryAggregates: [],  // Level 2: Per-country aggregates { country, lat, lon, totalCapacity }
    clusterAggregates: [],  // Level 3: Quadtree-based spatial clusters
    
    // =====================================================================
    // INTERACTION STATE
    // =====================================================================
    filterFuel: null,   // Active fuel type filter (null = show all)
    filterRange: null,  // Year range [min, max] from timeline brush
    
    // =====================================================================
    // SEMANTIC ZOOM CONFIGURATION
    // 4 distinct levels demonstrating gradual complexity increase
    // =====================================================================
    zoomLevel: 1,
    currentSemanticLevel: 'REGIONAL',  // Track current level for transitions
    
    /**
     * Zoom thresholds defining semantic level boundaries
     * WHY these values:
     * - 1.0-2.0: Initial view shows entire world, regional aggregates appropriate
     * - 2.0-4.0: User zoomed to continent level, country detail becomes visible
     * - 4.0-6.0: User focused on region/country, show spatial clusters
     * - 6.0+: High zoom, show individual power plants
     */
    ZOOM_THRESHOLDS: {
        REGIONAL: 1.0,    // Level 1: Show continental/regional aggregates (6 regions)
        COUNTRY: 2.0,     // Level 2: Show country-level aggregates
        CLUSTER: 4.0,     // Level 3: Show quadtree spatial clusters
        INDIVIDUAL: 6.0   // Level 4: Show individual power plant points
    },

    // =====================================================================
    // EVENT DISPATCHER
    // Enables reactive updates across decoupled modules
    // =====================================================================
    dispatch: d3.dispatch("dataLoaded", "stateChanged", "zoomChanged", "levelChanged")
};

/**
 * Global Color Scale for fuel types
 * Shared across map.js and force.js modules
 * Using d3.schemeTableau10 for colorblind-friendly palette
 */
const FUEL_COLORS = d3.scaleOrdinal()
    .domain(['Hydro', 'Solar', 'Gas', 'Other', 'Oil', 'Wind', 'Nuclear', 'Coal', 'Waste', 'Biomass'])
    .range(d3.schemeTableau10);

/**
 * Regional mapping for Level 1 aggregation
 * Maps countries to broad geographic regions for continental view
 */
const REGION_MAPPING = {
    'Africa': ['Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cameroon', 'Cape Verde', 'Central African Republic', 'Chad', 'Comoros', 'Congo', 'Cote dIvoire', 'Democratic Republic of the Congo', 'Djibouti', 'Egypt', 'Equatorial Guinea', 'Eritrea', 'Ethiopia', 'Gabon', 'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Kenya', 'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Mauritius', 'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria', 'Rwanda', 'Sao Tome and Principe', 'Senegal', 'Seychelles', 'Sierra Leone', 'Somalia', 'South Africa', 'South Sudan', 'Sudan', 'Swaziland', 'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe'],
    'Asia': ['Afghanistan', 'Armenia', 'Azerbaijan', 'Bahrain', 'Bangladesh', 'Bhutan', 'Brunei', 'Cambodia', 'China', 'Cyprus', 'Georgia', 'India', 'Indonesia', 'Iran', 'Iraq', 'Israel', 'Japan', 'Jordan', 'Kazakhstan', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Lebanon', 'Malaysia', 'Maldives', 'Mongolia', 'Myanmar', 'Nepal', 'North Korea', 'Oman', 'Pakistan', 'Palestine', 'Philippines', 'Qatar', 'Russia', 'Saudi Arabia', 'Singapore', 'South Korea', 'Sri Lanka', 'Syria', 'Taiwan', 'Tajikistan', 'Thailand', 'Timor-Leste', 'Turkey', 'Turkmenistan', 'United Arab Emirates', 'Uzbekistan', 'Vietnam', 'Yemen'],
    'Europe': ['Albania', 'Andorra', 'Austria', 'Belarus', 'Belgium', 'Bosnia and Herzegovina', 'Bulgaria', 'Croatia', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Ireland', 'Italy', 'Kosovo', 'Latvia', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Macedonia', 'Malta', 'Moldova', 'Monaco', 'Montenegro', 'Netherlands', 'Norway', 'Poland', 'Portugal', 'Romania', 'San Marino', 'Serbia', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'Ukraine', 'United Kingdom', 'Vatican City'],
    'North America': ['Antigua and Barbuda', 'Bahamas', 'Barbados', 'Belize', 'Canada', 'Costa Rica', 'Cuba', 'Dominica', 'Dominican Republic', 'El Salvador', 'Grenada', 'Guatemala', 'Haiti', 'Honduras', 'Jamaica', 'Mexico', 'Nicaragua', 'Panama', 'Puerto Rico', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Trinidad and Tobago', 'United States of America'],
    'South America': ['Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia', 'Ecuador', 'Guyana', 'Paraguay', 'Peru', 'Suriname', 'Uruguay', 'Venezuela'],
    'Oceania': ['Australia', 'Fiji', 'Kiribati', 'Marshall Islands', 'Micronesia', 'Nauru', 'New Zealand', 'Palau', 'Papua New Guinea', 'Samoa', 'Solomon Islands', 'Tonga', 'Tuvalu', 'Vanuatu']
};

/**
 * Reverse lookup: Country -> Region
 * Built programmatically from REGION_MAPPING
 */
const COUNTRY_TO_REGION = {};
Object.entries(REGION_MAPPING).forEach(([region, countries]) => {
    countries.forEach(country => COUNTRY_TO_REGION[country] = region);
});