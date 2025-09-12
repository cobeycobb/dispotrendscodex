/**
 * New Mexico Dispensary Dashboard JavaScript
 */

class DispensaryDashboard {
    constructor() {
        this.data = null;
        this.filteredData = [];
        this.chart = null;
        this.currentView = 'location'; // 'location' or 'company'
        this.sortColumn = 'latest_sales';
        this.sortDirection = 'desc';
        
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.populateFilters();
        this.setCurrentData();
        this.updateSortIndicators();
        this.applyFilters(); // Apply filters initially to show all dispensaries
    }

    async loadData() {
        try {
            const response = await fetch('dispensary_data.json');
            this.data = await response.json();
            console.log('Data loaded successfully:', this.data);
            console.log('Locations data:', this.data.locations ? this.data.locations.data.length : 'missing');
            console.log('Companies data:', this.data.companies ? this.data.companies.data.length : 'missing');
            
            if (!this.data.companies || !this.data.companies.data) {
                console.error('Companies data is missing from JSON file');
                this.showError('Companies data not found - please regenerate data file');
                return;
            }
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load dispensary data');
        }
    }

    setupEventListeners() {
        try {
            // Search functionality
            const searchElement = document.getElementById('search');
            if (searchElement) {
                searchElement.addEventListener('input', (e) => {
                    this.applyFilters();
                });
            }

            // Region filter
            const regionElement = document.getElementById('region-filter');
            if (regionElement) {
                regionElement.addEventListener('change', (e) => {
                    this.applyFilters();
                });
            }

            // City dropdown functionality
            const cityDropdownButton = document.getElementById('city-dropdown-button');
            const cityDropdownMenu = document.getElementById('city-dropdown-menu');
            
            if (cityDropdownButton) {
                cityDropdownButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleCityDropdown();
                });
            }

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                const cityContainer = document.querySelector('.city-filter-container');
                if (cityContainer && !cityContainer.contains(e.target)) {
                    this.closeCityDropdown();
                }
            });
            
            // City selection buttons
            const selectAllButton = document.getElementById('select-all-cities');
            if (selectAllButton) {
                selectAllButton.addEventListener('click', (e) => {
                    this.selectAllCities();
                });
            }
            
            const selectNoneButton = document.getElementById('select-none-cities');
            if (selectNoneButton) {
                selectNoneButton.addEventListener('click', (e) => {
                    this.selectNoneCities();
                });
            }
        } catch (error) {
            console.error('Error setting up basic event listeners:', error);
        }

        // Trend filters
        document.querySelectorAll('.trend-filter').forEach(filter => {
            filter.addEventListener('click', (e) => {
                // Update active state
                document.querySelectorAll('.trend-filter').forEach(f => f.classList.remove('active'));
                e.target.classList.add('active');
                this.applyFilters();
            });
        });

        // Column sorting
        document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', (e) => {
                const column = header.dataset.column;
                
                if (this.sortColumn === column) {
                    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortColumn = column;
                    this.sortDirection = 'desc';
                }
                
                this.updateSortIndicators();
                this.updateDisplay();
            });
        });

        // View toggle buttons
        try {
            const toggleButtons = document.querySelectorAll('.toggle-button');
            console.log('Found toggle buttons:', toggleButtons.length);
            
            toggleButtons.forEach((button, index) => {
                console.log(`Toggle button ${index}:`, button.dataset.view, button.textContent);
                button.addEventListener('click', (e) => {
                    const newView = e.target.dataset.view;
                    console.log('View toggle clicked:', newView);
                    if (newView !== this.currentView) {
                        this.currentView = newView;
                        this.updateViewToggle();
                        this.setCurrentData();
                        this.updateTableHeaders();
                        this.applyFilters();
                    }
                });
            });
        } catch (error) {
            console.error('Error setting up view toggle buttons:', error);
        }
    }

    populateFilters() {
        if (!this.data) {
            console.error('No data available for populating filters');
            return;
        }

        try {
            // Populate regions
            const regionSelect = document.getElementById('region-filter');
            if (regionSelect && this.data.regions) {
                this.data.regions.forEach(region => {
                    const option = document.createElement('option');
                    option.value = region;
                    option.textContent = region;
                    regionSelect.appendChild(option);
                });
            }

            // Get unique cities from locations data and create dropdown items
            if (this.data.locations && this.data.locations.data) {
                const cities = [...new Set(this.data.locations.data.map(d => d.city))]
                    .filter(city => city && city.trim() !== '')
                    .sort();

                const cityDropdownMenu = document.getElementById('city-dropdown-menu');
                if (cityDropdownMenu) {
                    cityDropdownMenu.innerHTML = ''; // Clear existing content
                    
                    cities.forEach(city => {
                        const cityItem = document.createElement('div');
                        cityItem.className = 'city-dropdown-item';
                        
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.id = `city-${city.replace(/\s+/g, '-').toLowerCase()}`;
                        checkbox.value = city;
                        checkbox.checked = true; // Auto-select all cities by default
                        checkbox.addEventListener('change', (e) => {
                            e.stopPropagation();
                            this.updateCityDropdownText();
                            this.applyFilters();
                        });
                        
                        const label = document.createElement('label');
                        label.htmlFor = checkbox.id;
                        label.textContent = city;
                        
                        cityItem.addEventListener('click', (e) => {
                            if (e.target !== checkbox) {
                                checkbox.checked = !checkbox.checked;
                                this.updateCityDropdownText();
                                this.applyFilters();
                            }
                        });
                        
                        cityItem.appendChild(checkbox);
                        cityItem.appendChild(label);
                        cityDropdownMenu.appendChild(cityItem);
                    });
                    
                    this.updateCityDropdownText();
                }
            } else {
                console.error('Locations data is missing or malformed');
            }
        } catch (error) {
            console.error('Error populating filters:', error);
        }
    }

    setCurrentData() {
        if (!this.data) return;
        
        if (this.currentView === 'location') {
            this.currentDataset = this.data.locations.data;
        } else {
            this.currentDataset = this.data.companies.data;
        }
        
        console.log(`Switched to ${this.currentView} view with ${this.currentDataset.length} entries`);
    }

    updateViewToggle() {
        document.querySelectorAll('.toggle-button').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-view="${this.currentView}"]`).classList.add('active');
    }

    updateTableHeaders() {
        const nameHeader = document.getElementById('name-header');
        const locationHeader = document.getElementById('location-header');
        
        if (this.currentView === 'company') {
            nameHeader.innerHTML = 'Company <span class="sort-arrow"></span>';
            locationHeader.innerHTML = 'Markets <span class="sort-arrow"></span>';
            locationHeader.dataset.column = 'primary_city'; // Update sort column
        } else {
            nameHeader.innerHTML = 'Dispensary <span class="sort-arrow"></span>';
            locationHeader.innerHTML = 'City <span class="sort-arrow"></span>';
            locationHeader.dataset.column = 'city'; // Restore original sort column
        }
    }

    toggleCityDropdown() {
        try {
            const button = document.getElementById('city-dropdown-button');
            const menu = document.getElementById('city-dropdown-menu');
            
            if (button && menu) {
                const isOpen = menu.classList.contains('open');
                if (isOpen) {
                    this.closeCityDropdown();
                } else {
                    this.openCityDropdown();
                }
            }
        } catch (error) {
            console.error('Error toggling city dropdown:', error);
        }
    }

    openCityDropdown() {
        try {
            const button = document.getElementById('city-dropdown-button');
            const menu = document.getElementById('city-dropdown-menu');
            
            if (button && menu) {
                button.classList.add('open');
                menu.classList.add('open');
            }
        } catch (error) {
            console.error('Error opening city dropdown:', error);
        }
    }

    closeCityDropdown() {
        try {
            const button = document.getElementById('city-dropdown-button');
            const menu = document.getElementById('city-dropdown-menu');
            
            if (button && menu) {
                button.classList.remove('open');
                menu.classList.remove('open');
            }
        } catch (error) {
            console.error('Error closing city dropdown:', error);
        }
    }

    selectAllCities() {
        const checkboxes = document.querySelectorAll('#city-dropdown-menu input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
        });
        this.updateCityDropdownText();
        this.applyFilters();
    }

    selectNoneCities() {
        const checkboxes = document.querySelectorAll('#city-dropdown-menu input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        this.updateCityDropdownText();
        this.applyFilters();
    }

    updateCityDropdownText() {
        const selectedCities = this.getSelectedCities();
        const totalCities = document.querySelectorAll('#city-dropdown-menu input[type="checkbox"]').length;
        const textElement = document.getElementById('city-dropdown-text');
        
        if (selectedCities.length === 0) {
            textElement.textContent = 'No cities selected';
        } else if (selectedCities.length === totalCities) {
            textElement.textContent = 'All cities selected';
        } else if (selectedCities.length === 1) {
            textElement.textContent = selectedCities[0];
        } else if (selectedCities.length <= 3) {
            textElement.textContent = selectedCities.join(', ');
        } else {
            textElement.textContent = `${selectedCities.length} cities selected`;
        }
    }

    getSelectedCities() {
        const checkboxes = document.querySelectorAll('#city-dropdown-menu input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    applyFilters() {
        if (!this.data || !this.currentDataset) return;

        let filtered = [...this.currentDataset];

        // Search filter
        const searchTerm = document.getElementById('search').value.toLowerCase();
        if (searchTerm) {
            filtered = filtered.filter(d => {
                const searchIn = [d.licensee.toLowerCase()];
                
                if (this.currentView === 'location') {
                    searchIn.push(d.address.toLowerCase(), d.city.toLowerCase());
                } else {
                    // For company view, search in cities and company name
                    searchIn.push(...d.cities.map(city => city.toLowerCase()));
                }
                
                return searchIn.some(field => field.includes(searchTerm));
            });
        }

        // Region filter
        const selectedRegion = document.getElementById('region-filter').value;
        if (selectedRegion) {
            filtered = filtered.filter(d => d.region === selectedRegion);
        }

        // Multi-city filter - only filter if not all cities are selected
        const selectedCities = this.getSelectedCities();
        const totalCities = document.querySelectorAll('#city-dropdown-menu input[type="checkbox"]').length;
        if (selectedCities.length > 0 && selectedCities.length < totalCities) {
            if (this.currentView === 'location') {
                filtered = filtered.filter(d => selectedCities.includes(d.city));
            } else {
                // For company view, filter by companies that have locations in any of the selected cities
                filtered = filtered.filter(d => d.cities.some(city => selectedCities.includes(city)));
            }
        }

        // Trend filter
        const activeTrendFilter = document.querySelector('.trend-filter.active');
        const trendFilter = activeTrendFilter ? activeTrendFilter.dataset.trend : 'all';
        if (trendFilter !== 'all') {
            filtered = filtered.filter(d => {
                // Group enhanced trends into basic filter categories
                if (trendFilter === 'up') {
                    return d.trend_direction === 'up' || d.trend_direction === 'strong_up';
                } else if (trendFilter === 'down') {
                    return d.trend_direction === 'down' || d.trend_direction === 'strong_down';
                } else if (trendFilter === 'stable') {
                    return d.trend_direction === 'stable' || d.trend_direction === 'insufficient_data';
                }
                return d.trend_direction === trendFilter;
            });
        }

        this.filteredData = filtered;
        this.updateDisplay();
    }

    updateDisplay() {
        this.updateStats();
        this.updateTable();
    }

    updateSortIndicators() {
        // Clear all sort indicators
        document.querySelectorAll('.sortable').forEach(header => {
            header.removeAttribute('data-sort');
        });
        
        // Set current sort indicator
        const currentHeader = document.querySelector(`[data-column="${this.sortColumn}"]`);
        if (currentHeader) {
            currentHeader.setAttribute('data-sort', this.sortDirection);
        }
    }

    updateStats() {
        if (!this.data || !this.currentDataset) return;

        const stats = this.calculateStats(this.currentDataset);
        
        const totalCount = this.currentView === 'company' 
            ? this.data.companies.total_companies
            : this.data.locations.total_dispensaries;
            
        document.getElementById('total-dispensaries').textContent = totalCount.toLocaleString();
        document.getElementById('trending-up').textContent = stats.up.toLocaleString();
        document.getElementById('trending-down').textContent = stats.down.toLocaleString();
        document.getElementById('trending-stable').textContent = stats.stable.toLocaleString();
        
        // Update the stat label
        const totalLabel = document.getElementById('total-label');
        totalLabel.textContent = this.currentView === 'company' ? 'Total Companies' : 'Total Dispensaries';
    }

    calculateStats(dispensaries) {
        const stats = { up: 0, down: 0, stable: 0 };
        dispensaries.forEach(d => {
            // Group enhanced trends into basic categories for stats display
            if (d.trend_direction === 'up' || d.trend_direction === 'strong_up') {
                stats.up++;
            } else if (d.trend_direction === 'down' || d.trend_direction === 'strong_down') {
                stats.down++;
            } else {
                // stable, insufficient_data, etc.
                stats.stable++;
            }
        });
        return stats;
    }

    updateTable() {
        const tbody = document.getElementById('dispensary-table');
        const resultsCount = document.getElementById('results-count');

        if (!this.filteredData.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="loading">No dispensaries match your filters</td></tr>';
            resultsCount.textContent = '0 results';
            return;
        }

        // Sort data based on current sort column and direction
        const sortedData = [...this.filteredData].sort((a, b) => {
            let aVal = a[this.sortColumn];
            let bVal = b[this.sortColumn];
            
            // Handle string sorting for text columns
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
                
                if (this.sortDirection === 'asc') {
                    return aVal.localeCompare(bVal);
                } else {
                    return bVal.localeCompare(aVal);
                }
            }
            
            // Handle numeric sorting
            if (this.sortDirection === 'asc') {
                return aVal - bVal;
            } else {
                return bVal - aVal;
            }
        });

        tbody.innerHTML = sortedData.map((item, index) => {
            const trendIcon = this.getTrendIcon(item.trend_direction);
            // Map enhanced trends to CSS classes 
            let trendClass = item.trend_direction;
            if (item.trend_direction === 'strong_up') trendClass = 'up strong';
            else if (item.trend_direction === 'strong_down') trendClass = 'down strong';
            else if (item.trend_direction === 'insufficient_data') trendClass = 'stable insufficient';
            
            const sparklineId = `sparkline-${index}`;
            
            if (this.currentView === 'location') {
                // Location view (original)
                return `
                    <tr data-licensee="${item.licensee}" style="cursor: pointer;">
                        <td>
                            <div style="font-weight: 500;">${this.truncateText(item.licensee, 40)}</div>
                            <div style="font-size: 0.85rem; color: #666;">${this.truncateText(item.address, 35)}</div>
                        </td>
                        <td>
                            <span class="city-link">${item.city}</span>
                        </td>
                        <td>
                            <span class="trend-indicator ${trendClass}">
                                <span class="trend-arrow">${trendIcon}</span>
                                ${item.trend_direction}
                            </span>
                        </td>
                        <td>$${item.latest_sales.toLocaleString()}</td>
                        <td class="${item.growth_rate >= 0 ? 'up' : 'down'}">
                            ${item.growth_rate >= 0 ? '+' : ''}${item.growth_rate.toFixed(1)}%
                        </td>
                        <td>$${item.avg_monthly_sales.toLocaleString()}</td>
                        <td class="sparkline-container">
                            <canvas class="sparkline" id="${sparklineId}" width="80" height="30"></canvas>
                        </td>
                    </tr>
                `;
            } else {
                // Company view
                const citiesDisplay = item.cities.length > 3 
                    ? item.cities.slice(0, 3).join(', ') + ` +${item.cities.length - 3} more`
                    : item.cities.join(', ');
                    
                return `
                    <tr data-licensee="${item.licensee}" style="cursor: pointer;">
                        <td>
                            <div style="font-weight: 500;">${this.truncateText(item.company_name, 40)}</div>
                            <div style="font-size: 0.85rem; color: #666;">${item.location_count} location${item.location_count > 1 ? 's' : ''}</div>
                        </td>
                        <td>
                            <div style="font-size: 0.875rem;">${citiesDisplay}</div>
                        </td>
                        <td>
                            <span class="trend-indicator ${trendClass}">
                                <span class="trend-arrow">${trendIcon}</span>
                                ${item.trend_direction}
                            </span>
                        </td>
                        <td>$${item.latest_sales.toLocaleString()}</td>
                        <td class="${item.growth_rate >= 0 ? 'up' : 'down'}">
                            ${item.growth_rate >= 0 ? '+' : ''}${item.growth_rate.toFixed(1)}%
                        </td>
                        <td>$${item.avg_monthly_sales.toLocaleString()}</td>
                        <td class="sparkline-container">
                            <canvas class="sparkline" id="${sparklineId}" width="80" height="30"></canvas>
                        </td>
                    </tr>
                `;
            }
        }).join('');

        // Generate sparklines after table is rendered
        setTimeout(() => {
            sortedData.forEach((item, index) => {
                const sparklineId = `sparkline-${index}`;
                this.createSparkline(sparklineId, item.monthly_data, item.trend_direction);
            });
        }, 50);

        // Add click listeners to table rows
        tbody.querySelectorAll('tr[data-licensee]').forEach(row => {
            row.addEventListener('click', () => {
                const licensee = row.dataset.licensee;
                this.showDispensaryChart(licensee);
            });
        });

        // Add city filter clicks
        tbody.querySelectorAll('.city-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.stopPropagation();
                const cityName = e.target.textContent;
                const checkbox = document.querySelector(`#city-dropdown-menu input[value="${cityName}"]`);
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    this.updateCityDropdownText();
                    this.applyFilters();
                }
            });
        });

        resultsCount.textContent = `${this.filteredData.length.toLocaleString()} results`;
    }

    getTrendIcon(trend) {
        switch(trend) {
            case 'up': return '↗';
            case 'strong_up': return '⬆';
            case 'down': return '↘';
            case 'strong_down': return '⬇';
            case 'stable': return '→';
            case 'insufficient_data': return '?';
            default: return '→';
        }
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    createSparkline(canvasId, monthlyData, trendDirection) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Clear canvas first  
        ctx.clearRect(0, 0, 80, 30);
        
        const width = 80;
        const height = 30;
        
        // Sort data by month and filter out invalid values
        const sortedData = monthlyData
            .filter(d => d && d.month && d.total_sales !== undefined && d.total_sales !== null)
            .sort((a, b) => a.month.localeCompare(b.month));
        const values = sortedData.map(d => d.total_sales).filter(v => !isNaN(v) && v >= 0);
        
        if (values.length < 2) {
            // Draw a simple dot for single data point
            ctx.fillStyle = '#999';
            ctx.beginPath();
            ctx.arc(width / 2, height / 2, 2, 0, 2 * Math.PI);
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
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, height / 2);
            ctx.lineTo(width, height / 2);
            ctx.stroke();
            return;
        }
        
        // Use the actual trend direction from the algorithm instead of simple comparison
        const colors = {
            up: '#10b981',
            strong_up: '#059669',
            down: '#ef4444', 
            strong_down: '#dc2626',
            stable: '#f59e0b',
            insufficient_data: '#9ca3af'
        };
        
        ctx.strokeStyle = colors[trendDirection] || colors['stable'];
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        
        // Draw line
        values.forEach((value, index) => {
            const x = (index / (values.length - 1)) * width;
            const y = height - ((value - minValue) / range * (height - 4)) - 2;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // Add small dots at endpoints
        ctx.fillStyle = colors[trendDirection] || colors['stable'];
        
        // First point
        const firstValue = values[0];
        const lastValue = values[values.length - 1];
        const firstX = 0;
        const firstY = height - ((firstValue - minValue) / range * (height - 4)) - 2;
        ctx.beginPath();
        ctx.arc(firstX, firstY, 1.5, 0, 2 * Math.PI);
        ctx.fill();
        
        // Last point
        const lastX = width;
        const lastY = height - ((lastValue - minValue) / range * (height - 4)) - 2;
        ctx.beginPath();
        ctx.arc(lastX, lastY, 1.5, 0, 2 * Math.PI);
        ctx.fill();
    }

    showDispensaryChart(licensee) {
        const dispensary = this.currentDataset.find(d => d.licensee === licensee);
        if (!dispensary) return;

        // Update chart title
        const chartTitle = this.currentView === 'company' 
            ? dispensary.company_name + ' (All Locations)'
            : dispensary.licensee;
        document.querySelector('.chart-title').textContent = this.truncateText(chartTitle, 35);
        
        // Hide placeholder and show chart
        const placeholder = document.getElementById('chart-placeholder');
        const chartCanvas = document.getElementById('trend-chart');
        
        placeholder.style.display = 'none';
        chartCanvas.style.display = 'block';

        // Prepare chart data
        const monthlyData = dispensary.monthly_data.sort((a, b) => a.month.localeCompare(b.month));
        const labels = monthlyData.map(d => this.formatMonth(d.month));
        const totalSales = monthlyData.map(d => d.total_sales);
        const medicalSales = monthlyData.map(d => d.medical_sales);
        const adultSales = monthlyData.map(d => d.adult_sales);

        // Destroy existing chart
        if (this.chart) {
            this.chart.destroy();
        }

        // Create new chart with fixed sizing
        const ctx = document.getElementById('trend-chart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Total Sales',
                        data: totalSales,
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.2
                    },
                    {
                        label: 'Medical Sales',
                        data: medicalSales,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.2
                    },
                    {
                        label: 'Adult-Use Sales',
                        data: adultSales,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 300
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 15
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    formatMonth(monthString) {
        const [year, month] = monthString.split('-');
        const monthNames = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];
        return `${monthNames[parseInt(month) - 1]} ${year}`;
    }

    showError(message) {
        const tbody = document.getElementById('dispensary-table');
        tbody.innerHTML = `<tr><td colspan="7" class="loading">Error: ${message}</td></tr>`;
    }

    initMap() {
        // Initialize Leaflet map centered on New Mexico
        this.map = L.map('nm-map').setView([34.5199, -105.8701], 7);
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
    }

    updateMap() {
        if (!this.map || !this.filteredData) return;
        
        // Clear existing markers
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];
        
        // City coordinates (approximate - you'd want precise coordinates for production)
        const cityCoords = this.getCityCoordinates();
        
        // Add markers for filtered dispensaries
        this.filteredData.forEach(dispensary => {
            const coords = cityCoords[dispensary.city];
            if (!coords) return;
            
            // Add some random offset to avoid exact overlap
            const lat = coords[0] + (Math.random() - 0.5) * 0.02;
            const lng = coords[1] + (Math.random() - 0.5) * 0.02;
            
            // Color based on trend
            const colors = {
                'up': '#10b981',
                'down': '#ef4444', 
                'stable': '#f59e0b'
            };
            
            const marker = L.circleMarker([lat, lng], {
                color: colors[dispensary.trend_direction],
                fillColor: colors[dispensary.trend_direction],
                fillOpacity: 0.8,
                radius: Math.min(10, Math.max(4, dispensary.avg_monthly_sales / 100000))
            }).addTo(this.map);
            
            // Add popup
            marker.bindPopup(`
                <strong>${dispensary.licensee}</strong><br>
                ${dispensary.city}<br>
                Trend: ${dispensary.trend_direction}<br>
                Latest Sales: $${dispensary.latest_sales.toLocaleString()}<br>
                Growth: ${dispensary.growth_rate.toFixed(1)}%
            `);
            
            // Click handler to select dispensary
            marker.on('click', () => {
                this.showDispensaryChart(dispensary.licensee);
            });
            
            this.markers.push(marker);
        });
    }

    getCityCoordinates() {
        // Basic coordinates for major NM cities (you'd want a complete dataset for production)
        return {
            'Albuquerque': [35.0844, -106.6504],
            'Albquerque': [35.0844, -106.6504],
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
            'Jal': [32.1126, -103.1921],
            'Eunice': [32.4390, -103.1549],
            'Clayton': [36.4556, -103.1893],
            'Raton': [36.9042, -104.4394]
        };
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DispensaryDashboard();
});