/**
 * New Mexico Dispensary Territory Map JavaScript
 */

class TerritoryMap {
    constructor() {
        this.data = null;
        this.filteredData = [];
        this.map = null;
        this.markers = [];
        this.nmCenter = [34.5199, -105.8701];
        this.geoCache = null; // raw cache
        this.geoCacheNorm = null; // normalized lookup
        
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.populateFilters();
        this.initMap();
        this.updateDisplay();
    }

    async loadData() {
        try {
            console.log('Loading data...');
            const response = await fetch('dispensary_data.json');
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.data = await response.json();

            // Load geocoded cache for precise coordinates
            try {
                const geoResp = await fetch('geocoded_cache.json');
                if (geoResp.ok) {
                    this.geoCache = await geoResp.json();
                    // Build normalized index for fuzzy matching
                    this.geoCacheNorm = {};
                    const norm = (s) => String(s || '')
                        .toLowerCase()
                        .replace(/[.,]/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    Object.keys(this.geoCache).forEach(key => {
                        this.geoCacheNorm[norm(key)] = this.geoCache[key];
                    });
                    console.log('Geocoded cache loaded:', Object.keys(this.geoCache).length, 'entries');
                } else {
                    console.warn('Geocoded cache not found or failed to load');
                }
            } catch (e) {
                console.warn('Error loading geocoded cache:', e);
            }

            // Use unified locations dataset
            if (this.data && this.data.locations && Array.isArray(this.data.locations.data)) {
                this.filteredData = [...this.data.locations.data];
                console.log('Data loaded successfully:', this.data.locations.data.length, 'locations');
            } else if (Array.isArray(this.data.dispensaries)) {
                // Fallback for older schema
                this.filteredData = [...this.data.dispensaries];
                console.log('Using legacy dispensaries schema:', this.data.dispensaries.length);
            } else {
                throw new Error('No dispensary locations found in data');
            }
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load dispensary data: ' + error.message);
        }
    }

    setupEventListeners() {
        // Search functionality
        document.getElementById('search').addEventListener('input', (e) => {
            this.applyFilters();
        });

        // Region filter
        document.getElementById('region-filter').addEventListener('change', (e) => {
            this.applyFilters();
        });

        // City filter
        document.getElementById('city-filter').addEventListener('change', (e) => {
            this.applyFilters();
        });

        // Trend filters
        document.querySelectorAll('.trend-filter').forEach(filter => {
            filter.addEventListener('click', (e) => {
                // Update active state
                document.querySelectorAll('.trend-filter').forEach(f => f.classList.remove('active'));
                e.target.classList.add('active');
                this.applyFilters();
            });
        });
    }

    populateFilters() {
        if (!this.data) return;

        // Populate regions
        const regionSelect = document.getElementById('region-filter');
        (this.data.regions || []).forEach(region => {
            const option = document.createElement('option');
            option.value = region;
            option.textContent = region;
            regionSelect.appendChild(option);
        });

        // Get unique cities
        const source = this.data.locations && this.data.locations.data ? this.data.locations.data : this.data.dispensaries;
        const cities = [...new Set(source.map(d => d.city))]
            .filter(city => city && city.trim() !== '')
            .sort();

        const citySelect = document.getElementById('city-filter');
        cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            citySelect.appendChild(option);
        });
    }

    applyFilters() {
        if (!this.data) return;

        const source = this.data.locations && this.data.locations.data ? this.data.locations.data : this.data.dispensaries;
        let filtered = [...source];

        // Search filter
        const searchTerm = document.getElementById('search').value.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(d => 
                d.licensee.toLowerCase().includes(searchTerm) ||
                d.address.toLowerCase().includes(searchTerm) ||
                d.city.toLowerCase().includes(searchTerm)
            );
        }

        // Region filter
        const selectedRegion = document.getElementById('region-filter').value;
        if (selectedRegion) {
            filtered = filtered.filter(d => d.region === selectedRegion);
        }

        // City filter
        const selectedCity = document.getElementById('city-filter').value;
        if (selectedCity) {
            filtered = filtered.filter(d => d.city === selectedCity);
        }

        // Trend filter
        const activeTrendFilter = document.querySelector('.trend-filter.active');
        const trendFilter = activeTrendFilter ? activeTrendFilter.dataset.trend : 'all';
        if (trendFilter !== 'all') {
            filtered = filtered.filter(d => this.baseTrend(d.trend_direction) === trendFilter);
        }

        this.filteredData = filtered;
        this.updateDisplay();
    }

    baseTrend(trend) {
        if (!trend) return 'stable';
        const t = String(trend).toLowerCase();
        if (t.includes('up')) return 'up';
        if (t.includes('down')) return 'down';
        return 'stable';
    }

    // Stable, deterministic jitter for a given seed
    getStableJitter(seed, scale = 0.01) {
        const r1 = this.seededRandom(seed + ':lat');
        const r2 = this.seededRandom(seed + ':lng');
        const half = scale / 2;
        return [(r1 - 0.5) * scale, (r2 - 0.5) * scale];
    }

    // Simple seeded PRNG returning [0,1)
    seededRandom(seed) {
        let h = 2166136261 >>> 0;
        const str = String(seed);
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
        }
        // Convert to [0,1)
        return (h >>> 0) / 4294967296;
    }

    updateDisplay() {
        console.log('Updating display with', this.filteredData ? this.filteredData.length : 0, 'dispensaries');
        this.updateMap();
        this.updateStats();
    }

    updateStats() {
        const resultsCount = document.getElementById('map-results-count');
        if (this.filteredData.length === 0) {
            resultsCount.textContent = 'No dispensaries match your filters';
            return;
        }

        const stats = this.calculateStats(this.filteredData);
        resultsCount.innerHTML = `
            Showing ${this.filteredData.length.toLocaleString()} dispensaries: 
            <span style="color: #10b981">${stats.up} trending up</span>, 
            <span style="color: #ef4444">${stats.down} trending down</span>, 
            <span style="color: #f59e0b">${stats.stable} stable</span>
        `;
    }

    calculateStats(dispensaries) {
        const stats = { up: 0, down: 0, stable: 0 };
        dispensaries.forEach(d => {
            const key = this.baseTrend(d.trend_direction);
            stats[key]++;
        });
        return stats;
    }

    initMap() {
        // Initialize Leaflet map centered on New Mexico
        this.map = L.map('nm-map').setView([34.5199, -105.8701], 7);
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(this.map);

        // Map initialized successfully
        console.log('Map initialized successfully');
    }

    updateMap() {
        console.log('updateMap called, map exists:', !!this.map, 'filtered data exists:', !!this.filteredData);
        
        if (!this.map || !this.filteredData) {
            console.log('Returning early - missing map or data');
            return;
        }
        
        console.log('Clearing', this.markers.length, 'existing markers');
        
        // Clear existing markers
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];
        
        // City coordinates
        const cityCoords = this.getCityCoordinates();
        console.log('City coordinates loaded:', Object.keys(cityCoords).length, 'cities');
        
        // Add markers for filtered dispensaries
        let markersAdded = 0;
        let coordsNotFound = 0;
        
        this.filteredData.forEach((dispensary, index) => {
            let lat = null;
            let lng = null;

            // Prefer precise coordinates if present in data
            if (dispensary.latitude != null && dispensary.longitude != null) {
                const latNum = parseFloat(dispensary.latitude);
                const lngNum = parseFloat(dispensary.longitude);
                if (isFinite(latNum) && isFinite(lngNum)) {
                    lat = latNum;
                    lng = lngNum;
                }
            }

            // Fall back to geocoded cache by address + city (+zip) if available
            if ((lat == null || lng == null) && this.geoCache) {
                const addr = (dispensary.address || '').trim();
                const city = (dispensary.city || '').trim();
                const zip = dispensary.zip;
                const candidates = [];
                if (addr && city) {
                    candidates.push(`${addr}, ${city}`);
                    if (zip != null) {
                        const zipStr = String(zip);
                        candidates.push(`${addr}, ${city} ${zipStr}`);
                        // Some cache entries store zip with one decimal (e.g., 87507.0)
                        if (!zipStr.includes('.')) {
                            candidates.push(`${addr}, ${city} ${Number(zip).toFixed(1)}`);
                        }
                    }
                }

                // Try exact keys first, then normalized matching
                for (const key of candidates) {
                    const hit = this.geoCache[key];
                    if (hit && isFinite(hit.lat) && isFinite(hit.lng)) {
                        lat = hit.lat;
                        lng = hit.lng;
                        break;
                    }
                }
                if ((lat == null || lng == null) && this.geoCacheNorm && candidates.length) {
                    const norm = (s) => String(s || '')
                        .toLowerCase()
                        .replace(/[.,]/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    for (const key of candidates) {
                        const nkey = norm(key);
                        const hit = this.geoCacheNorm[nkey];
                        if (hit && isFinite(hit.lat) && isFinite(hit.lng)) {
                            lat = hit.lat;
                            lng = hit.lng;
                            break;
                        }
                    }
                }
            }

            // Fall back to city centroid with small stable jitter (for overlap avoidance)
            if (lat == null || lng == null) {
                const coords = cityCoords[dispensary.city];
                if (!coords) {
                    coordsNotFound++;
                    if (index < 5) console.log('No coords for city:', dispensary.city, 'dispensary:', dispensary.licensee);
                    return;
                }
                const jitter = this.getStableJitter(`${dispensary.address}|${dispensary.licensee}`, 0.004);
                lat = coords[0] + jitter[0];
                lng = coords[1] + jitter[1];
            }
            
            // Color based on trend
            const colors = {
                'up': '#10b981',
                'down': '#ef4444', 
                'stable': '#f59e0b'
            };
            const trendKey = this.baseTrend(dispensary.trend_direction);
            
            // Size based on sales volume (scale between 4-15)
            const minRadius = 4;
            const maxRadius = 15;
            const salesRange = 1000000; // Scale factor
            const radius = minRadius + (dispensary.avg_monthly_sales / salesRange) * (maxRadius - minRadius);
            const clampedRadius = Math.min(maxRadius, Math.max(minRadius, radius));
            
            const marker = L.circleMarker([lat, lng], {
                color: colors[trendKey],
                fillColor: colors[trendKey],
                fillOpacity: 0.7,
                radius: clampedRadius,
                weight: 2
            }).addTo(this.map);
            
            // Create unique ID for this marker's chart
            const chartId = `popup-chart-${markersAdded}`;
            
            // Add popup with detailed info including mini chart
            marker.bindPopup(`
                <div style="max-width: 280px;">
                    <strong>${dispensary.licensee}</strong><br>
                    <em>${dispensary.address}</em><br>
                    <strong>${dispensary.city}</strong>, ${dispensary.region}<br><br>
                    
                    <div style="text-align: center; margin: 10px 0;">
                        <canvas id="${chartId}" width="100" height="40" style="border: 1px solid #e5e7eb; border-radius: 4px;"></canvas>
                        <div style="font-size: 0.75rem; color: #666; margin-top: 4px;">Sales Trend (${dispensary.total_months} months)</div>
                    </div>
                    
                    <strong>Performance:</strong><br>
                    Trend: <span style="color: ${colors[trendKey]}; font-weight: bold;">
                        ${dispensary.trend_direction.toUpperCase()}
                    </span><br>
                    Growth Rate: <span style="color: ${dispensary.growth_rate >= 0 ? '#10b981' : '#ef4444'};">
                        ${dispensary.growth_rate >= 0 ? '+' : ''}${dispensary.growth_rate.toFixed(1)}%
                    </span><br><br>
                    
                    <strong>Sales Data:</strong><br>
                    Latest Month: $${dispensary.latest_sales.toLocaleString()}<br>
                    Monthly Average: $${dispensary.avg_monthly_sales.toLocaleString()}
                </div>
            `, {
                maxWidth: 320,
                className: 'custom-popup'
            });
            
            // Generate chart when popup opens
            marker.on('popupopen', () => {
                setTimeout(() => {
                    this.createMiniSparkline(chartId, dispensary.monthly_data);
                }, 100); // Small delay to ensure DOM is ready
            });
            
            // Hover effect
            marker.on('mouseover', function() {
                this.setStyle({
                    fillOpacity: 0.9,
                    weight: 3
                });
            });
            
            marker.on('mouseout', function() {
                this.setStyle({
                    fillOpacity: 0.7,
                    weight: 2
                });
            });
            
            this.markers.push(marker);
            markersAdded++;
        });

        console.log('Markers processing complete:', markersAdded, 'added,', coordsNotFound, 'coords not found');
        console.log('Total markers on map:', this.markers.length);

        // Adjust map view to show all markers if we have filtered data
        const totalCount = this.data.locations && this.data.locations.data ? this.data.locations.data.length : (this.data.dispensaries ? this.data.dispensaries.length : 0);
        if (this.markers.length > 0 && this.markers.length < totalCount) {
            const group = new L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds().pad(0.1));
            console.log('Map view adjusted to fit markers');
        }
    }

    getCityCoordinates() {
        // Comprehensive coordinates for New Mexico cities
        return {
            'Albuquerque': [35.0844, -106.6504],
            'Albquerque': [35.0844, -106.6504], // Common misspelling
            'Santa Fe': [35.6870, -105.9378],
            'Las Cruces': [32.3199, -106.7637],
            'Roswell': [33.3943, -104.5230],
            'Farmington': [36.7281, -108.2187],
            'Clovis': [34.4048, -103.2052],
            'Hobbs': [32.7426, -103.1372],
            'Alamogordo': [32.8995, -105.9603],
            'Carlsbad': [32.4207, -104.2288],
            'Gallup': [35.5281, -108.7426],
            'Las Vegas': [35.5939, -105.2230],
            'Silver City': [32.7701, -108.2803],
            'Los Alamos': [35.8781, -106.2978],
            'Taos': [36.4073, -105.5731],
            'Espanola': [35.9911, -106.0803],
            'Rio Rancho': [35.2328, -106.6630],
            'Deming': [32.2687, -107.7586],
            'Grants': [35.1473, -107.8548],
            'Socorro': [34.0582, -106.8906],
            'Portales': [34.1862, -103.3538],
            'Tucumcari': [35.1717, -103.7250],
            'Truth or Consequences': [33.1284, -107.2528],
            'Ruidoso': [33.3317, -105.6731],
            'Artesia': [32.8426, -104.4028],
            'Lovington': [32.9445, -103.3488],
            'Belen': [34.6620, -106.7764],
            'Los Lunas': [34.8064, -106.7331],
            'Bernalillo': [35.3103, -106.5517],
            'Corrales': [35.2317, -106.6142],
            'Edgewood': [35.0654, -106.1964],
            'Chaparral': [31.9135, -106.3839],
            'Sunland Park': [31.7951, -106.5806],
            'Anthony': [31.9979, -106.6011],
            'Mesilla': [32.2723, -106.8006],
            'Mesilla Park': [32.2840, -106.7614],
            'Jal': [32.1126, -103.1921],
            'Eunice': [32.4390, -103.1549],
            'Clayton': [36.4556, -103.1893],
            'Raton': [36.9042, -104.4394],
            'Angel Fire': [36.4067, -105.2897],
            'Red River': [36.7053, -105.4072],
            'Questa': [36.7067, -105.5942],
            'Chama': [36.9030, -106.5814],
            'Aztec': [36.8381, -108.0009],
            'Bloomfield': [36.7072, -107.9848],
            'Kirtland': [36.7381, -108.3148],
            'Cuba': [36.0311, -107.0936],
            'Milan': [35.1750, -107.8889],
            'White Rock': [35.8314, -106.2083],
            'Alcalde': [36.0886, -106.0536],
            'El Prado': [36.4406, -105.5689],
            'Taos Ski Valley': [36.5928, -105.4467],
            'Picuris Pueblo': [36.1892, -105.7578],
            'Placitas': [35.3314, -106.5633],
            'Los Ranchos': [35.1417, -106.6472],
            'Bosque Farms': [34.8589, -106.7103],
            'Peralta': [34.8203, -106.6931],
            'Rio Communities': [34.6531, -106.7483],
            'Cedar Crest': [35.1364, -106.3661],
            'Moriarty': [35.0047, -106.0489],
            'Estancia': [34.7592, -106.0517],
            'Madrid': [35.2644, -106.1500],
            'Pena Blanca': [35.5653, -106.3361],
            'San Ysidro': [35.5214, -106.7789],
            'Jemez Springs': [35.7739, -106.6917],
            'Santa Rosa': [34.9381, -104.6836],
            'Fort Sumner': [34.4725, -104.2436],
            'Logan': [35.3586, -103.4189],
            'Vaughn': [34.5931, -105.1703],
            'Santa Teresa': [31.7901, -106.7019],
            'Vado': [32.1162, -106.6603],
            'Hatch': [32.6612, -107.1531],
            'Arrey': [32.8292, -107.2758],
            'Elephant Butte': [33.1470, -107.1858],
            'Bayard': [32.7898, -108.1311],
            'San Lorenzo': [32.8631, -108.1300],
            'Columbus': [31.8281, -107.6411],
            'Lordsburg': [32.3506, -108.7114],
            'Tularosa': [33.0742, -105.9547],
            'Cloudcroft': [32.9595, -105.7408],
            'Ruidoso Downs': [33.3206, -105.6086],
            'Carrizozo': [33.6431, -105.8769],
            'Capitan': [33.5453, -105.5850],
            'Alto': [33.3658, -105.6836],
            'Loving': [32.2890, -103.9311],
            'Tatum': [33.2531, -103.3155],
            'Texico': [34.3925, -103.0497],
            'Glenrio': [35.1856, -103.0419],
            'Rodeo': [31.8356, -109.0311],
            'Timberon': [32.6281, -105.6969],
            'Yah Ta Hey': [35.6508, -108.7881],
            'Mora': [36.0047, -105.3281],
            'Eagle Nest': [36.5394, -105.2708]
        };
    }

    showError(message) {
        const resultsCount = document.getElementById('map-results-count');
        resultsCount.textContent = `Error: ${message}`;
    }

    createMiniSparkline(canvasId, monthlyData) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Clear canvas first  
        ctx.clearRect(0, 0, 100, 40);
        
        const width = 100;
        const height = 40;
        
        // Sort data by month and filter out invalid values
        const sortedData = monthlyData
            .filter(d => d && d.month && d.total_sales !== undefined && d.total_sales !== null)
            .sort((a, b) => a.month.localeCompare(b.month));
        const values = sortedData.map(d => d.total_sales).filter(v => !isNaN(v) && v >= 0);
        
        if (values.length < 2) {
            // Draw a simple dot for single data point
            ctx.fillStyle = '#999';
            ctx.beginPath();
            ctx.arc(width / 2, height / 2, 3, 0, 2 * Math.PI);
            ctx.fill();
            return;
        }
        
        // Calculate scaling
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        const range = maxValue - minValue;
        
        if (range === 0) {
            // Draw flat line if no variation
            ctx.strokeStyle = '#999';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(5, height / 2);
            ctx.lineTo(width - 5, height / 2);
            ctx.stroke();
            return;
        }
        
        // Determine line color based on trend
        const firstValue = values[0];
        const lastValue = values[values.length - 1];
        const trend = lastValue > firstValue ? 'up' : lastValue < firstValue ? 'down' : 'stable';
        
        const colors = {
            up: '#10b981',
            down: '#ef4444',
            stable: '#f59e0b'
        };
        
        ctx.strokeStyle = colors[trend];
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        // Draw line with padding
        const padding = 5;
        const drawWidth = width - (padding * 2);
        const drawHeight = height - (padding * 2);
        
        values.forEach((value, index) => {
            const x = padding + (index / (values.length - 1)) * drawWidth;
            const y = padding + (drawHeight - ((value - minValue) / range * drawHeight));
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // Add small dots at endpoints for better visibility
        ctx.fillStyle = colors[trend];
        
        // First point
        const firstX = padding;
        const firstY = padding + (drawHeight - ((firstValue - minValue) / range * drawHeight));
        ctx.beginPath();
        ctx.arc(firstX, firstY, 2, 0, 2 * Math.PI);
        ctx.fill();
        
        // Last point
        const lastX = padding + drawWidth;
        const lastY = padding + (drawHeight - ((lastValue - minValue) / range * drawHeight));
        ctx.beginPath();
        ctx.arc(lastX, lastY, 2, 0, 2 * Math.PI);
        ctx.fill();
    }
}

// Initialize map when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TerritoryMap();
});
