# New Mexico Dispensary Trends Dashboard

Interactive dashboard for analyzing cannabis dispensary sales trends in New Mexico (January - November 2025 data, including the latest November report).

## Features

- **📊 Interactive Charts**: View individual dispensary sales trends over time
- **🔍 Search & Filter**: Search by dispensary name and filter by city/county
- **📈 Trend Analysis**: Identify dispensaries trending up, down, or stable
- **📱 Responsive Design**: Works on desktop and mobile devices
- **🎯 Real-time Filtering**: Instant results as you type and filter

## Data Overview

- **795 dispensaries** tracked across New Mexico
- **9 months** of sales data (Jan-Nov 2025)
- **Trend Categories**:
  - 71 dispensaries trending up (including strong up)
  - 103 dispensaries trending down (including strong down)
  - 514 dispensaries stable
  - 107 dispensaries with limited/insufficient data

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
