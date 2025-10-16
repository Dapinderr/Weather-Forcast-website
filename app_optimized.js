/**
 * Weather Pro - Optimized JavaScript Application
 * Modern, clean, and feature-rich weather application
 * 
 * Features:
 * - Dynamic weather backgrounds
 * - 7-day forecast with OpenWeatherMap API
 * - Dark/Light theme toggle
 * - Geolocation support
 * - Real-time weather updates
 * - Smooth animations and transitions
 * - Enhanced accessibility
 * - Error handling and toast notifications
 * - Loading skeletons
 * - Weather particle effects
 */

class WeatherApp {
  constructor() {
    // API Configuration
    this.config = {
      API_KEY: '7ea3d92da13774f9f2605a735e32cf9c', // Replace with your API key
      BASE_URL: 'https://api.openweathermap.org/data/2.5',
      GEO_URL: 'https://api.openweathermap.org/geo/1.0',
      DEFAULT_CITY: 'Delhi,IN',
      UPDATE_INTERVAL: 600000, // 10 minutes
      DEBOUNCE_DELAY: 300
    };

    // State Management
    this.state = {
      currentCity: null,
      currentWeather: null,
      forecast: null,
      units: localStorage.getItem('units') || 'metric',
      theme: localStorage.getItem('theme') || 'light',
      favorites: JSON.parse(localStorage.getItem('favorites') || '[]'),
      activeTab: 'today',
      isLoading: false,
      autoRefresh: localStorage.getItem('autoRefresh') === 'true'
    };

    // DOM Elements Cache
    this.elements = {
      // Core elements
      app: document.querySelector('.app'),
      loadingSkeleton: document.getElementById('loadingSkeleton'),
      progressBar: document.querySelector('.progress-bar'),
      
      // Header elements
      currentTime: document.getElementById('currentTime'),
      currentDate: document.getElementById('currentDate'),
      searchForm: document.getElementById('searchForm'),
      searchInput: document.getElementById('searchInput'),
      suggestions: document.getElementById('suggestions'),
      geoBtn: document.getElementById('geoBtn'),
      themeToggle: document.getElementById('themeToggle'),
      
      // Navigation
      navTabs: document.querySelectorAll('.nav-tab'),
      tabContents: document.querySelectorAll('.tab-content'),
      locationName: document.getElementById('locationName'),
      
      // Weather display
      currentTemp: document.getElementById('currentTemp'),
      weatherCondition: document.getElementById('weatherCondition'),
      weatherDescription: document.getElementById('weatherDescription'),
      weatherIcon: document.getElementById('weatherIcon'),
      feelsLike: document.getElementById('feelsLike'),
      humidity: document.getElementById('humidity'),
      windSpeed: document.getElementById('windSpeed'),
      uvIndex: document.getElementById('uvIndex'),
      humidityPercent: document.getElementById('humidityPercent'),
      humidityFill: document.querySelector('.humidity-fill'),
      airQuality: document.getElementById('airQuality'),
      
      // Quick cities
      quickCities: document.getElementById('quickCities'),
      
      // Forecast
      forecastList: document.getElementById('forecastList'),
      hourlyList: document.getElementById('hourlyList'),
      
      // Modals
      settingsModal: document.getElementById('settingsModal'),
      favoritesModal: document.getElementById('favoritesModal'),
      closeSettings: document.getElementById('closeSettings'),
      closeFavorites: document.getElementById('closeFavorites'),
      
      // Settings
      unitSelect: document.getElementById('unitSelect'),
      autoRefresh: document.getElementById('autoRefresh'),
      
      // UI elements
      toast: document.getElementById('toast'),
      fabRefresh: document.getElementById('fabRefresh'),
      backToTop: document.getElementById('backToTop'),
      weatherCanvas: document.getElementById('weatherCanvas')
    };

    // Weather icons mapping
    this.weatherIcons = {
      '01d': '☀️', '01n': '🌙', '02d': '⛅', '02n': '☁️',
      '03d': '☁️', '03n': '☁️', '04d': '☁️', '04n': '☁️',
      '09d': '🌦️', '09n': '🌦️', '10d': '🌧️', '10n': '🌧️',
      '11d': '⛈️', '11n': '⛈️', '13d': '❄️', '13n': '❄️',
      '50d': '🌫️', '50n': '🌫️'
    };

    // Initialize app
    this.init();
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      this.showLoading();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Initialize theme
      this.applyTheme(this.state.theme);
      
      // Initialize weather canvas
      this.initWeatherCanvas();
      
      // Start time updates
      this.startTimeUpdates();
      
      // Load initial weather data
      await this.loadInitialData();
      
      // Setup auto refresh
      if (this.state.autoRefresh) {
        this.setupAutoRefresh();
      }
      
      this.hideLoading();
      this.showToast('Weather Pro loaded successfully!');
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showToast('Failed to load weather data. Please try again.', 'error');
      this.hideLoading();
    }
  }

  /**
   * Set up all event listeners
   */
  setupEventListeners() {
    // Theme toggle
    this.elements.themeToggle?.addEventListener('click', () => {
      const newTheme = this.state.theme === 'light' ? 'dark' : 'light';
      this.setTheme(newTheme);
    });

    // Search functionality
    this.elements.searchForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = this.elements.searchInput.value.trim();
      if (query) {
        this.searchCity(query);
      }
    });

    // Search input with debounced suggestions
    this.elements.searchInput?.addEventListener('input', 
      this.debounce((e) => this.showSuggestions(e.target.value), this.config.DEBOUNCE_DELAY)
    );

    // Geolocation
    this.elements.geoBtn?.addEventListener('click', () => this.getCurrentLocation());

    // Navigation tabs
    this.elements.navTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.currentTarget.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Quick cities
    this.elements.quickCities?.addEventListener('click', (e) => {
      const cityCard = e.target.closest('.city-card');
      if (cityCard) {
        const city = cityCard.dataset.city;
        this.loadWeatherData(city);
      }
    });

    // Modals
    this.elements.closeSettings?.addEventListener('click', () => this.hideModal('settings'));
    this.elements.closeFavorites?.addEventListener('click', () => this.hideModal('favorites'));
    
    document.getElementById('settingsBtn')?.addEventListener('click', () => this.showModal('settings'));
    document.getElementById('favoritesBtn')?.addEventListener('click', () => this.showModal('favorites'));

    // Settings
    this.elements.unitSelect?.addEventListener('change', (e) => {
      this.state.units = e.target.value;
      localStorage.setItem('units', this.state.units);
      this.loadWeatherData(this.state.currentCity);
    });

    this.elements.autoRefresh?.addEventListener('change', (e) => {
      this.state.autoRefresh = e.target.checked;
      localStorage.setItem('autoRefresh', this.state.autoRefresh);
      if (this.state.autoRefresh) {
        this.setupAutoRefresh();
      } else {
        this.clearAutoRefresh();
      }
    });

    // Refresh button
    this.elements.fabRefresh?.addEventListener('click', () => {
      this.loadWeatherData(this.state.currentCity);
    });

    // Back to top
    this.elements.backToTop?.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Scroll events
    window.addEventListener('scroll', this.throttle(() => {
      const scrollTop = window.pageYOffset;
      this.elements.backToTop?.classList.toggle('show', scrollTop > 400);
    }, 100));

    // Close modals on outside click
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        this.hideModal();
      }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideModal();
        this.hideSuggestions();
      }
    });

    // Window events
    window.addEventListener('resize', this.throttle(() => this.handleResize(), 200));
    window.addEventListener('online', () => this.showToast('Connection restored'));
    window.addEventListener('offline', () => this.showToast('Connection lost', 'warning'));
  }

  /**
   * Load initial weather data
   */
  async loadInitialData() {
    const savedCity = localStorage.getItem('lastCity') || this.config.DEFAULT_CITY;
    await this.loadWeatherData(savedCity);
    this.updateQuickCities();
  }

  /**
   * Load weather data for a city
   */
  async loadWeatherData(city) {
    if (!city) return;
    
    try {
      this.showLoading();
      this.state.currentCity = city;
      localStorage.setItem('lastCity', city);

      // Fetch current weather and forecast in parallel
      const [currentWeather, forecast] = await Promise.all([
        this.fetchCurrentWeather(city),
        this.fetchForecast(city)
      ]);

      this.state.currentWeather = currentWeather;
      this.state.forecast = forecast;

      // Update UI
      this.updateCurrentWeather();
      this.updateForecast();
      this.updateHourlyForecast();
      this.updateWeatherBackground();
      this.updateWeatherEffects();

      this.hideLoading();
    } catch (error) {
      console.error('Failed to load weather data:', error);
      this.showToast('Failed to load weather data. Please try again.', 'error');
      this.hideLoading();
    }
  }

  /**
   * Fetch current weather data
   */
  async fetchCurrentWeather(city) {
    const url = `${this.config.BASE_URL}/weather?q=${encodeURIComponent(city)}&units=${this.state.units}&appid=${this.config.API_KEY}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      // Fallback to mock data for demo
      console.warn('Using mock weather data due to API error:', error);
      return this.getMockWeatherData(city);
    }
  }

  /**
   * Fetch forecast data
   */
  async fetchForecast(city) {
    const url = `${this.config.BASE_URL}/forecast?q=${encodeURIComponent(city)}&units=${this.state.units}&appid=${this.config.API_KEY}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Forecast API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.warn('Using mock forecast data due to API error:', error);
      return this.getMockForecastData();
    }
  }

  /**
   * Update current weather display
   */
  updateCurrentWeather() {
    const weather = this.state.currentWeather;
    if (!weather) return;

    // Temperature
    const temp = Math.round(weather.main.temp);
    this.elements.currentTemp.textContent = temp;
    
    // Weather info
    this.elements.weatherCondition.textContent = weather.weather[0].main;
    this.elements.weatherDescription.textContent = weather.weather[0].description;
    this.elements.locationName.textContent = weather.name;
    
    // Weather icon
    const iconCode = weather.weather[0].icon;
    const weatherIcon = this.weatherIcons[iconCode] || '🌤️';
    this.elements.weatherIcon.innerHTML = `<span style="font-size: 4rem;">${weatherIcon}</span>`;
    
    // Details
    this.elements.feelsLike.textContent = `${Math.round(weather.main.feels_like)}°`;
    this.elements.humidity.textContent = `${weather.main.humidity}%`;
    this.elements.windSpeed.textContent = `${Math.round(weather.wind.speed * 3.6)} km/h`;
    this.elements.uvIndex.textContent = 'Moderate'; // Mock UV data
    
    // Humidity bar
    this.elements.humidityPercent.textContent = `${weather.main.humidity}%`;
    this.elements.humidityFill.style.setProperty('--humidity', `${weather.main.humidity}%`);
    
    // Air quality (mock data)
    this.updateAirQuality(weather.main.humidity);
  }

  /**
   * Update 7-day forecast
   */
  updateForecast() {
    const forecast = this.state.forecast;
    if (!forecast || !forecast.list) return;

    // Group forecast by day
    const dailyForecasts = this.groupForecastByDay(forecast.list);
    
    let forecastHTML = '';
    dailyForecasts.slice(0, 7).forEach(day => {
      const date = new Date(day.date);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      const weatherIcon = this.weatherIcons[day.weather.icon] || '🌤️';
      
      forecastHTML += `
        <div class="forecast-item">
          <div class="forecast-day">${dayName}</div>
          <div class="forecast-icon">${weatherIcon}</div>
          <div class="forecast-desc">${day.weather.description}</div>
          <div class="forecast-high">${Math.round(day.maxTemp)}°</div>
          <div class="forecast-low">${Math.round(day.minTemp)}°</div>
        </div>
      `;
    });
    
    this.elements.forecastList.innerHTML = forecastHTML;
  }

  /**
   * Update hourly forecast
   */
  updateHourlyForecast() {
    const forecast = this.state.forecast;
    if (!forecast || !forecast.list) return;

    let hourlyHTML = '';
    forecast.list.slice(0, 24).forEach(item => {
      const date = new Date(item.dt * 1000);
      const hour = date.getHours();
      const time = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
      const weatherIcon = this.weatherIcons[item.weather[0].icon] || '🌤️';
      const temp = Math.round(item.main.temp);
      
      hourlyHTML += `
        <div class="hourly-item">
          <div class="hourly-time">${time}</div>
          <div class="hourly-icon">${weatherIcon}</div>
          <div class="hourly-temp">${temp}°</div>
        </div>
      `;
    });
    
    this.elements.hourlyList.innerHTML = hourlyHTML;
  }

  /**
   * Update weather background based on conditions
   */
  updateWeatherBackground() {
    const weather = this.state.currentWeather;
    if (!weather) return;

    const condition = weather.weather[0].main.toLowerCase();
    const weatherClasses = ['weather-sunny', 'weather-cloudy', 'weather-rainy', 'weather-stormy', 'weather-snowy'];
    
    // Remove existing weather classes
    weatherClasses.forEach(cls => this.elements.app.classList.remove(cls));
    
    // Add appropriate weather class
    let weatherClass = 'weather-sunny';
    if (condition.includes('cloud')) weatherClass = 'weather-cloudy';
    else if (condition.includes('rain') || condition.includes('drizzle')) weatherClass = 'weather-rainy';
    else if (condition.includes('thunder')) weatherClass = 'weather-stormy';
    else if (condition.includes('snow')) weatherClass = 'weather-snowy';
    
    this.elements.app.classList.add(weatherClass);
  }

  /**
   * Update air quality display
   */
  updateAirQuality(humidity) {
    let quality, className, dot;
    
    if (humidity < 30) {
      quality = 'Excellent';
      className = 'air-quality-good';
      dot = '#10b981';
    } else if (humidity < 60) {
      quality = 'Good';
      className = 'air-quality-good';
      dot = '#10b981';
    } else if (humidity < 80) {
      quality = 'Moderate';
      className = 'air-quality-moderate';
      dot = '#f59e0b';
    } else {
      quality = 'Poor';
      className = 'air-quality-poor';
      dot = '#ef4444';
    }
    
    this.elements.airQuality.textContent = quality;
    this.elements.airQuality.className = `stat-value ${className}`;
    
    const aqiDot = document.querySelector('.aqi-dot');
    if (aqiDot) {
      aqiDot.style.background = dot;
    }
  }

  /**
   * Search for cities
   */
  async searchCity(query) {
    try {
      this.showLoading();
      await this.loadWeatherData(query);
      this.elements.searchInput.value = '';
      this.hideSuggestions();
    } catch (error) {
      this.showToast('City not found. Please try again.', 'error');
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Show city suggestions
   */
  async showSuggestions(query) {
    if (!query || query.length < 2) {
      this.hideSuggestions();
      return;
    }

    try {
      const suggestions = await this.fetchCitySuggestions(query);
      this.displaySuggestions(suggestions);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    }
  }

  /**
   * Fetch city suggestions
   */
  async fetchCitySuggestions(query) {
    const url = `${this.config.GEO_URL}/direct?q=${encodeURIComponent(query)}&limit=5&appid=${this.config.API_KEY}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Suggestions API error');
      return await response.json();
    } catch (error) {
      // Return mock suggestions for demo
      return [
        { name: 'London', country: 'GB' },
        { name: 'New York', country: 'US' },
        { name: 'Tokyo', country: 'JP' }
      ];
    }
  }

  /**
   * Display search suggestions
   */
  displaySuggestions(suggestions) {
    if (!suggestions || suggestions.length === 0) {
      this.hideSuggestions();
      return;
    }

    let suggestionsHTML = '';
    suggestions.forEach(city => {
      const displayName = `${city.name}, ${city.country}`;
      suggestionsHTML += `
        <div class="suggestion-item" data-city="${displayName}">
          ${displayName}
        </div>
      `;
    });

    this.elements.suggestions.innerHTML = suggestionsHTML;
    this.elements.suggestions.setAttribute('aria-hidden', 'false');

    // Add click handlers to suggestions
    this.elements.suggestions.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const city = item.dataset.city;
        this.searchCity(city);
      });
    });
  }

  /**
   * Hide suggestions
   */
  hideSuggestions() {
    this.elements.suggestions.setAttribute('aria-hidden', 'true');
    this.elements.suggestions.innerHTML = '';
  }

  /**
   * Get current location
   */
  getCurrentLocation() {
    if (!navigator.geolocation) {
      this.showToast('Geolocation is not supported by this browser.', 'error');
      return;
    }

    this.showLoading();
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const cityName = await this.getCityFromCoordinates(latitude, longitude);
          await this.loadWeatherData(cityName);
          this.showToast('Location updated successfully!');
        } catch (error) {
          this.showToast('Failed to get location weather.', 'error');
        } finally {
          this.hideLoading();
        }
      },
      () => {
        this.hideLoading();
        this.showToast('Location access denied.', 'error');
      }
    );
  }

  /**
   * Get city name from coordinates
   */
  async getCityFromCoordinates(lat, lon) {
    const url = `${this.config.GEO_URL}/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${this.config.API_KEY}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Reverse geocoding failed');
      const data = await response.json();
      return data[0]?.name || 'Current Location';
    } catch (error) {
      return 'Current Location';
    }
  }

  /**
   * Switch navigation tabs
   */
  switchTab(tabName) {
    // Update active tab
    this.elements.navTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
      tab.setAttribute('aria-selected', tab.dataset.tab === tabName);
    });

    // Update tab content
    this.elements.tabContents.forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}Tab`);
    });

    this.state.activeTab = tabName;
  }

  /**
   * Show modal
   */
  showModal(modalType) {
    const modal = modalType === 'settings' ? this.elements.settingsModal : this.elements.favoritesModal;
    if (modal) {
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      
      if (modalType === 'settings') {
        this.populateSettings();
      } else if (modalType === 'favorites') {
        this.populateFavorites();
      }
    }
  }

  /**
   * Hide modal
   */
  hideModal(modalType) {
    const modals = [this.elements.settingsModal, this.elements.favoritesModal];
    modals.forEach(modal => {
      if (modal) {
        modal.setAttribute('aria-hidden', 'true');
      }
    });
    document.body.style.overflow = '';
  }

  /**
   * Populate settings modal
   */
  populateSettings() {
    this.elements.unitSelect.value = this.state.units;
    this.elements.autoRefresh.checked = this.state.autoRefresh;
  }

  /**
   * Populate favorites modal
   */
  populateFavorites() {
    const favoritesList = document.getElementById('favoritesList');
    if (!favoritesList) return;

    let favoritesHTML = '';
    this.state.favorites.forEach(city => {
      favoritesHTML += `
        <div class="favorite-item">
          <span>${city}</span>
          <button class="remove-favorite" data-city="${city}">Remove</button>
        </div>
      `;
    });

    favoritesList.innerHTML = favoritesHTML || '<p>No favorite cities yet.</p>';

    // Add event listeners for remove buttons
    favoritesList.querySelectorAll('.remove-favorite').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const city = e.target.dataset.city;
        this.removeFavorite(city);
      });
    });
  }

  /**
   * Theme management
   */
  setTheme(theme) {
    this.state.theme = theme;
    localStorage.setItem('theme', theme);
    this.applyTheme(theme);
  }

  applyTheme(theme) {
    this.elements.app.setAttribute('data-theme', theme);
    
    // Update meta theme color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.content = theme === 'dark' ? '#1a202c' : '#74b9ff';
    }
  }

  /**
   * Update quick cities with current weather
   */
  async updateQuickCities() {
    const quickCities = ['Mumbai,IN', 'Chennai,IN', 'Kolkata,IN'];
    const cityCards = this.elements.quickCities.querySelectorAll('.city-card');
    
    cityCards.forEach(async (card, index) => {
      if (quickCities[index]) {
        try {
          const weather = await this.fetchCurrentWeather(quickCities[index]);
          const temp = Math.round(weather.main.temp);
          const icon = this.weatherIcons[weather.weather[0].icon] || '🌤️';
          
          card.querySelector('.city-temp').textContent = `${temp}°`;
          card.querySelector('.city-icon').textContent = icon;
        } catch (error) {
          console.warn(`Failed to update quick city ${quickCities[index]}:`, error);
        }
      }
    });
  }

  /**
   * Weather effects and animations
   */
  initWeatherCanvas() {
    if (!this.elements.weatherCanvas) return;
    
    this.canvas = this.elements.weatherCanvas;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  updateWeatherEffects() {
    if (!this.state.currentWeather) return;
    
    const condition = this.state.currentWeather.weather[0].main.toLowerCase();
    this.clearWeatherEffects();
    
    if (condition.includes('rain') || condition.includes('drizzle')) {
      this.startRainEffect();
    } else if (condition.includes('snow')) {
      this.startSnowEffect();
    }
  }

  startRainEffect() {
    this.particles = [];
    for (let i = 0; i < 100; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        speed: 5 + Math.random() * 5,
        size: 1 + Math.random() * 2,
        opacity: 0.5 + Math.random() * 0.5
      });
    }
    this.animateRain();
  }

  startSnowEffect() {
    this.particles = [];
    for (let i = 0; i < 50; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        speed: 1 + Math.random() * 2,
        size: 2 + Math.random() * 3,
        opacity: 0.7 + Math.random() * 0.3
      });
    }
    this.animateSnow();
  }

  animateRain() {
    if (!this.ctx || this.particles.length === 0) return;
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.particles.forEach(particle => {
      this.ctx.save();
      this.ctx.globalAlpha = particle.opacity;
      this.ctx.strokeStyle = '#74b9ff';
      this.ctx.lineWidth = particle.size;
      this.ctx.beginPath();
      this.ctx.moveTo(particle.x, particle.y);
      this.ctx.lineTo(particle.x - 5, particle.y + 10);
      this.ctx.stroke();
      this.ctx.restore();
      
      particle.y += particle.speed;
      particle.x -= 1;
      
      if (particle.y > this.canvas.height) {
        particle.y = -10;
        particle.x = Math.random() * this.canvas.width;
      }
    });
    
    this.rainAnimationId = requestAnimationFrame(() => this.animateRain());
  }

  animateSnow() {
    if (!this.ctx || this.particles.length === 0) return;
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.particles.forEach(particle => {
      this.ctx.save();
      this.ctx.globalAlpha = particle.opacity;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
      
      particle.y += particle.speed;
      particle.x += Math.sin(particle.y / 100) * 0.5;
      
      if (particle.y > this.canvas.height) {
        particle.y = -particle.size;
        particle.x = Math.random() * this.canvas.width;
      }
    });
    
    this.snowAnimationId = requestAnimationFrame(() => this.animateSnow());
  }

  clearWeatherEffects() {
    if (this.rainAnimationId) {
      cancelAnimationFrame(this.rainAnimationId);
      this.rainAnimationId = null;
    }
    if (this.snowAnimationId) {
      cancelAnimationFrame(this.snowAnimationId);
      this.snowAnimationId = null;
    }
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.particles = [];
  }

  /**
   * Auto refresh functionality
   */
  setupAutoRefresh() {
    this.clearAutoRefresh();
    this.autoRefreshInterval = setInterval(() => {
      if (this.state.currentCity && !this.state.isLoading) {
        this.loadWeatherData(this.state.currentCity);
      }
    }, this.config.UPDATE_INTERVAL);
  }

  clearAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  /**
   * Time updates
   */
  startTimeUpdates() {
    this.updateTime();
    setInterval(() => this.updateTime(), 1000);
  }

  updateTime() {
    const now = new Date();
    
    // Update time
    const timeString = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    this.elements.currentTime.textContent = timeString;
    
    // Update date
    const dateString = now.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    this.elements.currentDate.textContent = dateString;
  }

  /**
   * Loading states
   */
  showLoading() {
    this.state.isLoading = true;
    this.elements.app.classList.add('loading');
  }

  hideLoading() {
    this.state.isLoading = false;
    this.elements.app.classList.remove('loading');
    
    // Hide loading skeleton after a short delay
    setTimeout(() => {
      this.elements.loadingSkeleton.classList.add('hidden');
    }, 500);
  }

  /**
   * Toast notifications
   */
  showToast(message, type = 'info') {
    if (!this.elements.toast) return;
    
    this.elements.toast.textContent = message;
    this.elements.toast.className = `toast show ${type}`;
    
    // Clear existing timeout
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    
    // Auto hide after 3 seconds
    this.toastTimeout = setTimeout(() => {
      this.elements.toast.classList.remove('show');
    }, 3000);
  }

  /**
   * Utility functions
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  handleResize() {
    this.resizeCanvas();
  }

  /**
   * Data processing utilities
   */
  groupForecastByDay(forecastList) {
    const days = {};
    
    forecastList.forEach(item => {
      const date = new Date(item.dt * 1000);
      const dateKey = date.toDateString();
      
      if (!days[dateKey]) {
        days[dateKey] = {
          date: dateKey,
          temps: [],
          weather: item.weather[0],
          maxTemp: item.main.temp,
          minTemp: item.main.temp
        };
      }
      
      days[dateKey].temps.push(item.main.temp);
      days[dateKey].maxTemp = Math.max(days[dateKey].maxTemp, item.main.temp);
      days[dateKey].minTemp = Math.min(days[dateKey].minTemp, item.main.temp);
    });
    
    return Object.values(days);
  }

  /**
   * Mock data for development/fallback
   */
  getMockWeatherData(city) {
    return {
      name: city,
      main: {
        temp: 25,
        feels_like: 28,
        humidity: 65,
        pressure: 1013
      },
      weather: [{
        main: 'Clear',
        description: 'clear sky',
        icon: '01d'
      }],
      wind: {
        speed: 3.5
      }
    };
  }

  getMockForecastData() {
    const mockList = [];
    for (let i = 0; i < 40; i++) {
      const date = new Date();
      date.setHours(date.getHours() + (i * 3));
      
      mockList.push({
        dt: Math.floor(date.getTime() / 1000),
        main: {
          temp: 20 + Math.random() * 10
        },
        weather: [{
          main: 'Clear',
          description: 'clear sky',
          icon: '01d'
        }]
      });
    }
    
    return { list: mockList };
  }

  /**
   * Favorites management
   */
  addFavorite(city) {
    if (!this.state.favorites.includes(city)) {
      this.state.favorites.push(city);
      localStorage.setItem('favorites', JSON.stringify(this.state.favorites));
      this.showToast('Added to favorites!');
    }
  }

  removeFavorite(city) {
    this.state.favorites = this.state.favorites.filter(fav => fav !== city);
    localStorage.setItem('favorites', JSON.stringify(this.state.favorites));
    this.populateFavorites();
    this.showToast('Removed from favorites');
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Create global app instance
  window.weatherApp = new WeatherApp();
});

// Service Worker registration for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}