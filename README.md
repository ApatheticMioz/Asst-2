# Asst-2

Interactive D3.js dashboards for a data visualization assignment. The workspace contains two HTML experiences backed by shared JS utilities, CSS styling, and CSV/JSON data. Supporting LaTeX sources are included for the written report.

## Contents
- Task 1: Global Power Plant dashboard with zoomable maps, force layout by fuel type, and a linked timeline.
- Task 2: Gapminder wealth vs. health dashboard with motion chart, choropleth map, and interactive controls.
- Assets: `css/` for styling, `js/` for D3 views and state management, `Data/` for CSV/JSON datasets.
- Report: LaTeX sources and generated artifacts in `report.*` for the accompanying write-up.

## Run Locally
1) Open a terminal in the project root.
2) Start a simple HTTP server (Python example):
   ```powershell
   python -m http.server 8000
   ```
3) Open the dashboards:
   - Task 1 (Power Plant): http://localhost:8000/task1.html
   - Task 2 (Gapminder): http://localhost:8000/task2.html

> Note: Avoid opening HTML via file:// to prevent CORS issues. If port 8000 is busy, try 8080.

## Data Sources
- `Data/global_power_plant_database.csv`: Global Power Plant Database snapshot.
- `Data/gapminder_clean.json`: Processed Gapminder indicators for motion chart and map.

## Development Notes
- JS modules live in `js/`; shared helpers are in `utils.js` and `state.js`.
- Styles are centralized in `css/style.css`.
- LaTeX build artifacts are ignored via `.gitignore`.
