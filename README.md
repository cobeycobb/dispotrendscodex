# New Mexico Dispensary Trends Dashboard

Interactive dashboard for analyzing cannabis dispensary sales trends in New Mexico (January - August 2025).

## Features

- **📊 Interactive Charts**: View individual dispensary sales trends over time
- **🔍 Search & Filter**: Search by dispensary name and filter by city/county
- **📈 Trend Analysis**: Identify dispensaries trending up, down, or stable
- **📱 Responsive Design**: Works on desktop and mobile devices
- **🎯 Real-time Filtering**: Instant results as you type and filter

## Data Overview

- **728 dispensaries** tracked across New Mexico
- **8 months** of sales data (Jan-Aug 2025)
- **Trend Categories**:
  - 249 dispensaries trending up
  - 208 dispensaries trending down  
  - 271 dispensaries stable

## Usage

Visit the live dashboard: [https://your-username.github.io/dispotrendsclaude](https://your-username.github.io/dispotrendsclaude)

### Local Development

1. Clone the repository
2. Run a local server: `python3 -m http.server 8000`
3. Open http://localhost:8000

## Data Processing

The dashboard uses data processed from official New Mexico Cannabis Control Division market reports. Raw Excel files are processed using the `process_data.py` script to:

- Extract sales data from monthly reports
- Calculate growth rates and trend directions
- Generate consolidated JSON for the web interface

## Technologies Used

- Pure HTML/CSS/JavaScript (no frameworks)
- Chart.js for visualizations
- Responsive CSS Grid and Flexbox
- GitHub Pages for hosting