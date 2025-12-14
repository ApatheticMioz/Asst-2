# D3 Interactive Dashboards

Production-grade interactive data visualization dashboards built with pure D3.js (v7+). Features advanced interactions including semantic zooming, force simulations, brushing, dragging, and real-time animations.

## Overview

This project contains two interactive dashboards:

### Task 1: Global Power Plant Dashboard (IEA)
- **Zoomable Aggregate Map**: 4-level semantic zooming handling ~35,000 power plants
- **Force-Directed Fuel Clustering**: Interactive bubble chart with click-to-filter
- **Brushable Timeline**: Focus+Context stacked area chart with linked views

### Task 2: Gapminder Motion Chart (UNDP)
- **Animated Scatter Plot**: GDP vs Life Expectancy with play/pause animation
- **Synchronized Choropleth Map**: Real-time color updates matching current year
- **Interactive Controls**: D3-drag year slider and Sunburst drill-down

## Project Structure

```
├── task1.html          # Power Plant Dashboard entry point
├── task2.html          # Gapminder Dashboard entry point
├── css/
│   └── style.css       # Shared styling and responsive grid layouts
├── js/
│   ├── state.js        # Centralized state management
│   ├── utils.js        # Data loading and aggregation utilities
│   ├── map.js          # Task 1: Semantic zoom map
│   ├── force.js        # Task 1: Force-directed fuel chart
│   ├── timeline.js     # Task 1: Brushable timeline
│   ├── main.js         # Task 1: Orchestration
│   ├── motion_chart.js # Task 2: Animated scatter plot
│   ├── choropleth_map.js # Task 2: Synchronized map
│   ├── controls.js     # Task 2: Slider and sunburst
│   └── task2_main.js   # Task 2: Orchestration
├── Data/
│   ├── global_power_plant_database.csv
│   └── gapminder_clean.json
├── images/             # Dashboard screenshots
└── analysis.ipynb      # Data preparation notebook
```

## Installation

No dependencies to install. This is a pure HTML/CSS/JavaScript application.

## Usage

1. Start a local HTTP server from the project root:
   ```bash
   # Python 3
   python -m http.server 8000

   # Node.js (if http-server is installed)
   npx http-server -p 8000
   ```

2. Open in browser:
   - **Task 1 (Power Plants)**: http://localhost:8000/task1.html
   - **Task 2 (Gapminder)**: http://localhost:8000/task2.html

> **Note**: A local server is required to avoid CORS issues when loading data files.

## Data Sources

- **Global Power Plant Database**: [World Resources Institute](https://github.com/wri/global-power-plant-database)
- **Gapminder Indicators**: [Gapminder Foundation](https://www.gapminder.org/data/)

## Technologies

- **D3.js v7** - Data visualization library
- **TopoJSON** - Geographic data encoding
- **Pure JavaScript (ES6+)** - No frameworks or build tools required

## Status

**Archived / Refactored**

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
