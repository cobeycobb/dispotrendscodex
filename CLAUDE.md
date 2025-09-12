# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a New Mexico Dispensary Trends Dashboard - a static web application that analyzes cannabis dispensary sales data from January-August 2025. The dashboard provides interactive visualizations, filtering, and geographic mapping of dispensary performance trends across New Mexico.

## Architecture

### Data Flow
1. **Raw Data**: Excel files in `dispodata/` containing monthly sales reports from NM Cannabis Control Division
2. **Data Processing**: `process_data.py` extracts and consolidates data into `dispensary_data.json`
3. **Web Interface**: Pure HTML/CSS/JavaScript dashboard with dual-view capabilities (location vs company analysis)

### Key Components

**Data Processing Layer**:
- `process_data.py`: Main data extraction and processing script
- `nm_regions.py`: Regional mapping for New Mexico territories  
- `dispensary_data.json`: Consolidated output with both location and company datasets

**Frontend**:
- `index.html`: Main dashboard with stats, filtering, and interactive table
- `dashboard.js`: Core application logic, view switching, filtering, and Chart.js integration
- `map.html` + `map.js`: Territory mapping page with Leaflet.js and popup sparklines

### Dual-View System
The dashboard supports two distinct analysis modes:
- **Location View**: Individual dispensary locations (772 entries)
- **Company View**: Aggregated company data (727 companies) - companies with multiple locations show combined metrics

## Development Commands

### Data Processing
```bash
# Regenerate dashboard data from Excel files
python3 process_data.py

# Required dependencies for data processing
pip install pandas openpyxl xlrd
```

### Local Development  
```bash
# Start local web server
python3 -m http.server 8000

# Access dashboard
open http://localhost:8000/index.html

# Access territory map
open http://localhost:8000/map.html
```

### Data Requirements
- Excel files must be placed in `dispodata/` directory
- Files should follow naming pattern: "[Month] [Year] Market Sales by Licensee*.xlsx"
- Both .xlsx and .xls formats supported

## Key Technical Features

### Multi-Select City Filtering
- Checkbox-based interface allowing selection of multiple cities
- "Show All" button clears all selections  
- Works across both location and company views
- City names in table are clickable to toggle selection

### Responsive Design Optimizations  
- Optimized for 13-inch screens with fixed table column widths
- Compact header and spacing for better screen utilization
- Progressive responsive breakpoints at 1200px and 768px

### Interactive Mapping
- Leaflet.js integration with color-coded markers based on trends
- Mini sparkline charts in map popups showing sales trends
- Territory-based filtering for sales planning

### Performance Features
- Canvas-based sparklines for efficient rendering
- Client-side filtering and sorting
- Fixed table layout for consistent column sizing

## Data Structure Notes

The `dispensary_data.json` contains:
- `locations`: Individual dispensary location data (772 entries)
- `companies`: Aggregated company data (727 entries)  
- `regions`: New Mexico territorial divisions
- Regional statistics for both view types

Companies with multiple locations aggregate:
- Total sales across all locations
- Cities served (displayed as "Albuquerque, Santa Fe +2 more")
- Combined monthly trend data
- Growth rates calculated from aggregated data

## Cache Management

The application includes cache-busting parameters on script includes to ensure updates are loaded. When making JavaScript changes, update the version parameter in script tags:
```html
<script src="dashboard.js?v=[timestamp]"></script>
```