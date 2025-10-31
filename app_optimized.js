

class WeatherApp {
  constructor() {
    // API Configuration
    this.config = {
      API_KEY: '7ea3d92da13774f9f2605a735e32cf9c', // Replace with your API key
      BASE_URL: 'https://api.openweathermap.org/data/2.5',
      GEO_URL: 'https://api.openweathermap.org/geo/1.0',
      DEFAULT_CITY: 'Delhi,IN',
      UPDATE_INTERVAL: 600000, // 10 minutes
      DEBOUNCE_DELAY: 300,
      MAX_RETRIES: 3,
      RETRY_DELAY: 1000,
      CACHE_DURATION: 300000, // 5 minutes
      OFFLINE_TIMEOUT: 10000
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
      autoRefresh: localStorage.getItem('autoRefresh') === 'true',
      isOnline: navigator.onLine,
      lastUpdate: null,
      retryCount: 0
    };

    // Cache Management
    this.cache = {
      weather: new Map(),
      forecast: new Map(),
      suggestions: new Map()
    };

    // Error Tracking
    this.errors = {
      apiErrors: [],
      networkErrors: [],
      lastError: null
    };

    // Performance Monitoring
    this.performance = {
      loadTimes: [],
      apiCalls: 0,
      cacheHits: 0,
      errors: 0
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
      weatherCanvas: document.getElementById('weatherCanvas'),
      trendChart: document.getElementById('trendChart')
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
      
      // Initialize dynamic background
      this.initDynamicBackground();
      
      // Start time updates
      this.startTimeUpdates();
      
      // Load initial weather data
      await this.loadInitialData();
      
      // Setup auto refresh
      if (this.state.autoRefresh) {
        this.setupAutoRefresh();
      }
      
      // Setup network monitoring
      this.setupNetworkMonitoring();
      
      // Setup smart notifications
      this.setupSmartNotifications();
      
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
      this.updateTemperatureTrend();

      this.hideLoading();
    } catch (error) {
      console.error('Failed to load weather data:', error);
      this.showToast('Failed to load weather data. Please try again.', 'error');
      this.hideLoading();
    }
  }

  /**
   * Fetch current weather data with intelligent error handling
   */
  async fetchCurrentWeather(city) {
    const cacheKey = `${city}_${this.state.units}`;
    
    // Check cache first
    if (this.isCacheValid(cacheKey, 'weather')) {
      this.performance.cacheHits++;
      this.logPerformance('Cache hit for weather data');
      return this.cache.weather.get(cacheKey).data;
    }

    const url = `${this.config.BASE_URL}/weather?q=${encodeURIComponent(city)}&units=${this.state.units}&appid=${this.config.API_KEY}`;
    
    try {
      this.performance.apiCalls++;
      const startTime = performance.now();
      
      const response = await this.fetchWithRetry(url);
      
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Validate data before caching
      this.validateWeatherData(data);
      
      // Cache the result
      this.cache.weather.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      // Log performance
      const loadTime = performance.now() - startTime;
      this.logPerformance(`Weather API call completed in ${loadTime.toFixed(2)}ms`);
      
      // Reset retry count on success
      this.state.retryCount = 0;
      
      return data;
    } catch (error) {
      this.handleError('Weather API', error);
      
      // Try to return cached data if available
      if (this.cache.weather.has(cacheKey)) {
        this.logPerformance('Using stale cached weather data');
        return this.cache.weather.get(cacheKey).data;
      }
      
      // Fallback to mock data
      this.logPerformance('Using mock weather data');
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
   * Update current weather display with smooth animations
   */
  updateCurrentWeather() {
    const weather = this.state.currentWeather;
    if (!weather) return;

    // Animate temperature change
    this.animateTemperature(Math.round(weather.main.temp));
    
    // Weather info with fade transition
    this.fadeTransition(this.elements.weatherCondition, weather.weather[0].main);
    this.fadeTransition(this.elements.weatherDescription, weather.weather[0].description);
    this.fadeTransition(this.elements.locationName, weather.name);
    
    // Weather icon with animation
    const iconCode = weather.weather[0].icon;
    const weatherIcon = this.weatherIcons[iconCode] || '🌤️';
    this.updateWeatherIcon(weatherIcon, iconCode);
    
    // Animate numeric values
    this.animateCounter(this.elements.feelsLike, Math.round(weather.main.feels_like), '°');
    this.animateCounter(this.elements.humidity, weather.main.humidity, '%');
    this.animateCounter(this.elements.windSpeed, Math.round(weather.wind.speed * 3.6), ' km/h');
    this.elements.uvIndex.textContent = 'Moderate'; // Mock UV data
    
    // Animate humidity bar
    this.animateHumidityBar(weather.main.humidity);
    
    // Air quality (mock data)
    this.updateAirQuality(weather.main.humidity);
  }

  /**
   * Animate temperature counter
   */
  animateTemperature(targetTemp) {
    const currentTemp = parseInt(this.elements.currentTemp.textContent) || 0;
    const duration = 1000;
    const steps = 30;
    const stepDuration = duration / steps;
    const stepValue = (targetTemp - currentTemp) / steps;
    
    this.elements.currentTemp.classList.add('updating');
    
    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      const newTemp = Math.round(currentTemp + (stepValue * currentStep));
      this.elements.currentTemp.textContent = newTemp;
      
      if (currentStep >= steps) {
        this.elements.currentTemp.textContent = targetTemp;
        this.elements.currentTemp.classList.remove('updating');
        clearInterval(timer);
      }
    }, stepDuration);
  }

  /**
   * Animate counter values
   */
  animateCounter(element, targetValue, suffix = '') {
    const currentValue = parseInt(element.textContent.replace(/[^\d]/g, '')) || 0;
    const duration = 800;
    const steps = 20;
    const stepDuration = duration / steps;
    const stepValue = (targetValue - currentValue) / steps;
    
    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      const newValue = Math.round(currentValue + (stepValue * currentStep));
      element.textContent = newValue + suffix;
      
      if (currentStep >= steps) {
        element.textContent = targetValue + suffix;
        clearInterval(timer);
      }
    }, stepDuration);
  }

  /**
   * Fade transition for text content
   */
  fadeTransition(element, newContent) {
    element.style.opacity = '0';
    element.style.transform = 'translateY(10px)';
    
    setTimeout(() => {
      element.textContent = newContent;
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
    }, 200);
  }

  /**
   * Update weather icon with animation
   */
  updateWeatherIcon(icon, iconCode) {
    const iconElement = this.elements.weatherIcon;
    iconElement.style.transform = 'scale(0.8) rotate(180deg)';
    iconElement.style.opacity = '0.5';
    
    setTimeout(() => {
      iconElement.innerHTML = `<span style="font-size: 4rem;">${icon}</span>`;
      
      // Add weather-specific class for CSS animations
      iconElement.className = 'weather-icon-large';
      if (iconCode.includes('01')) iconElement.classList.add('sunny');
      else if (iconCode.includes('02') || iconCode.includes('03') || iconCode.includes('04')) iconElement.classList.add('cloudy');
      else if (iconCode.includes('09') || iconCode.includes('10')) iconElement.classList.add('rainy');
      else if (iconCode.includes('11')) iconElement.classList.add('stormy');
      else if (iconCode.includes('13')) iconElement.classList.add('snowy');
      
      iconElement.style.transform = 'scale(1) rotate(0deg)';
      iconElement.style.opacity = '1';
    }, 300);
  }

  /**
   * Animate humidity bar
   */
  animateHumidityBar(humidity) {
    const humidityFill = this.elements.humidityFill;
    const humidityPercent = this.elements.humidityPercent;
    
    // Animate the percentage text
    this.animateCounter(humidityPercent, humidity, '%');
    
    // Animate the bar width
    humidityFill.style.transition = 'width 1s cubic-bezier(0.4, 0, 0.2, 1)';
    humidityFill.style.setProperty('--humidity', `${humidity}%`);
  }

  /**
   * Update 7-day forecast with animations
   */
  updateForecast() {
    const forecast = this.state.forecast;
    if (!forecast || !forecast.list) return;

    // Group forecast by day
    const dailyForecasts = this.groupForecastByDay(forecast.list);
    
    // Clear existing forecast with fade out
    this.elements.forecastList.style.opacity = '0';
    this.elements.forecastList.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
      let forecastHTML = '';
      dailyForecasts.slice(0, 7).forEach((day, index) => {
        const date = new Date(day.date);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        const weatherIcon = this.weatherIcons[day.weather.icon] || '🌤️';
        
        forecastHTML += `
          <div class="forecast-item" style="animation-delay: ${index * 0.1}s;">
            <div class="forecast-day">${dayName}</div>
            <div class="forecast-icon">${weatherIcon}</div>
            <div class="forecast-desc">${day.weather.description}</div>
            <div class="forecast-high">${Math.round(day.maxTemp)}°</div>
            <div class="forecast-low">${Math.round(day.minTemp)}°</div>
          </div>
        `;
      });
      
      this.elements.forecastList.innerHTML = forecastHTML;
      
      // Fade in the new forecast
      this.elements.forecastList.style.opacity = '1';
      this.elements.forecastList.style.transform = 'translateY(0)';
    }, 300);
  }

  /**
   * Update hourly forecast with animations
   */
  updateHourlyForecast() {
    const forecast = this.state.forecast;
    if (!forecast || !forecast.list) return;

    // Clear existing hourly forecast with fade out
    this.elements.hourlyList.style.opacity = '0';
    this.elements.hourlyList.style.transform = 'translateX(20px)';
    
    setTimeout(() => {
      let hourlyHTML = '';
      forecast.list.slice(0, 24).forEach((item, index) => {
        const date = new Date(item.dt * 1000);
        const hour = date.getHours();
        const time = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
        const weatherIcon = this.weatherIcons[item.weather[0].icon] || '🌤️';
        const temp = Math.round(item.main.temp);
        
        hourlyHTML += `
          <div class="hourly-item" style="animation-delay: ${index * 0.05}s;">
            <div class="hourly-time">${time}</div>
            <div class="hourly-icon">${weatherIcon}</div>
            <div class="hourly-temp">${temp}°</div>
          </div>
        `;
      });
      
      this.elements.hourlyList.innerHTML = hourlyHTML;
      
      // Fade in the new hourly forecast
      this.elements.hourlyList.style.opacity = '1';
      this.elements.hourlyList.style.transform = 'translateX(0)';
      
      // Smooth scroll to current hour
      this.scrollToCurrentHour();
    }, 200);
  }

  /**
   * Scroll to current hour in hourly forecast
   */
  scrollToCurrentHour() {
    const currentHour = new Date().getHours();
    const hourlyItems = this.elements.hourlyList.querySelectorAll('.hourly-item');
    
    if (hourlyItems.length > 0) {
      const targetIndex = Math.min(currentHour, hourlyItems.length - 1);
      const targetItem = hourlyItems[targetIndex];
      
      if (targetItem) {
        setTimeout(() => {
          targetItem.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
          });
        }, 500);
      }
    }
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

  /**
   * Initialize dynamic background system
   */
  initDynamicBackground() {
    // Add time-based background variations
    this.updateBackgroundByTime();
    
    // Add mouse movement parallax effect
    this.setupParallaxEffect();
    
    // Add scroll-based background changes
    this.setupScrollEffect();
  }

  /**
   * Update background based on time of day
   */
  updateBackgroundByTime() {
    const hour = new Date().getHours();
    const app = this.elements.app;
    
    // Remove existing time classes
    app.classList.remove('morning', 'afternoon', 'evening', 'night');
    
    if (hour >= 5 && hour < 12) {
      app.classList.add('morning');
    } else if (hour >= 12 && hour < 17) {
      app.classList.add('afternoon');
    } else if (hour >= 17 && hour < 21) {
      app.classList.add('evening');
    } else {
      app.classList.add('night');
    }
    
    // Update every hour
    setTimeout(() => this.updateBackgroundByTime(), (60 - new Date().getMinutes()) * 60 * 1000);
  }

  /**
   * Setup parallax effect on mouse movement
   */
  setupParallaxEffect() {
    let mouseX = 0, mouseY = 0;
    
    document.addEventListener('mousemove', (e) => {
      mouseX = (e.clientX / window.innerWidth) * 100;
      mouseY = (e.clientY / window.innerHeight) * 100;
      
      // Update CSS custom properties for parallax
      document.documentElement.style.setProperty('--mouse-x', `${mouseX}%`);
      document.documentElement.style.setProperty('--mouse-y', `${mouseY}%`);
    });
  }

  /**
   * Setup scroll-based background effects
   */
  setupScrollEffect() {
    let ticking = false;
    
    const updateBackgroundOnScroll = () => {
      const scrollY = window.pageYOffset;
      const scrollPercent = Math.min(scrollY / (document.body.scrollHeight - window.innerHeight), 1);
      
      // Update background opacity and position based on scroll
      document.documentElement.style.setProperty('--scroll-percent', scrollPercent);
      
      ticking = false;
    };
    
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateBackgroundOnScroll);
        ticking = true;
      }
    });
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
    
    // Enhanced weather effects based on conditions
    if (condition.includes('rain') || condition.includes('drizzle')) {
      this.startRainEffect();
    } else if (condition.includes('snow')) {
      this.startSnowEffect();
    } else if (condition.includes('cloud')) {
      this.startCloudEffect();
    } else if (condition.includes('clear') || condition.includes('sun')) {
      this.startSunEffect();
    } else if (condition.includes('thunder') || condition.includes('storm')) {
      this.startStormEffect();
    }
  }

  /**
   * Start cloud particle effect
   */
  startCloudEffect() {
    this.particles = [];
    for (let i = 0; i < 30; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height * 0.6,
        speed: 0.5 + Math.random() * 1,
        size: 20 + Math.random() * 40,
        opacity: 0.1 + Math.random() * 0.2,
        drift: Math.random() * 0.5
      });
    }
    this.animateClouds();
  }

  /**
   * Start sun particle effect
   */
  startSunEffect() {
    this.particles = [];
    for (let i = 0; i < 20; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height * 0.4,
        speed: 0.2 + Math.random() * 0.3,
        size: 2 + Math.random() * 4,
        opacity: 0.3 + Math.random() * 0.4,
        angle: Math.random() * Math.PI * 2
      });
    }
    this.animateSun();
  }

  /**
   * Start storm particle effect
   */
  startStormEffect() {
    this.particles = [];
    for (let i = 0; i < 80; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        speed: 8 + Math.random() * 8,
        size: 1 + Math.random() * 3,
        opacity: 0.4 + Math.random() * 0.6,
        flash: Math.random() > 0.95
      });
    }
    this.animateStorm();
  }

  /**
   * Animate cloud particles
   */
  animateClouds() {
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
      
      particle.x += particle.speed;
      particle.y += particle.drift;
      
      if (particle.x > this.canvas.width + particle.size) {
        particle.x = -particle.size;
        particle.y = Math.random() * this.canvas.height * 0.6;
      }
    });
    
    this.cloudAnimationId = requestAnimationFrame(() => this.animateClouds());
  }

  /**
   * Animate sun particles
   */
  animateSun() {
    if (!this.ctx || this.particles.length === 0) return;
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.particles.forEach(particle => {
      this.ctx.save();
      this.ctx.globalAlpha = particle.opacity;
      this.ctx.fillStyle = '#ffeb3b';
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
      
      particle.angle += 0.02;
      particle.x += Math.cos(particle.angle) * particle.speed;
      particle.y += Math.sin(particle.angle) * particle.speed;
      
      if (particle.x < 0 || particle.x > this.canvas.width || 
          particle.y < 0 || particle.y > this.canvas.height) {
        particle.x = Math.random() * this.canvas.width;
        particle.y = Math.random() * this.canvas.height * 0.4;
      }
    });
    
    this.sunAnimationId = requestAnimationFrame(() => this.animateSun());
  }

  /**
   * Animate storm particles
   */
  animateStorm() {
    if (!this.ctx || this.particles.length === 0) return;
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Flash effect
    if (Math.random() > 0.98) {
      this.ctx.save();
      this.ctx.globalAlpha = 0.3;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
    }
    
    this.particles.forEach(particle => {
      this.ctx.save();
      this.ctx.globalAlpha = particle.opacity;
      this.ctx.strokeStyle = '#74b9ff';
      this.ctx.lineWidth = particle.size;
      this.ctx.beginPath();
      this.ctx.moveTo(particle.x, particle.y);
      this.ctx.lineTo(particle.x - 8, particle.y + 15);
      this.ctx.stroke();
      this.ctx.restore();
      
      particle.y += particle.speed;
      particle.x -= 2;
      
      if (particle.y > this.canvas.height) {
        particle.y = -15;
        particle.x = Math.random() * this.canvas.width;
      }
    });
    
    this.stormAnimationId = requestAnimationFrame(() => this.animateStorm());
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
    if (this.cloudAnimationId) {
      cancelAnimationFrame(this.cloudAnimationId);
      this.cloudAnimationId = null;
    }
    if (this.sunAnimationId) {
      cancelAnimationFrame(this.sunAnimationId);
      this.sunAnimationId = null;
    }
    if (this.stormAnimationId) {
      cancelAnimationFrame(this.stormAnimationId);
      this.stormAnimationId = null;
    }
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.particles = [];
  }

  /**
   * Update temperature trend chart
   */
  updateTemperatureTrend() {
    const forecast = this.state.forecast;
    if (!forecast || !forecast.list) return;

    const trendChart = document.getElementById('trendChart');
    if (!trendChart) return;

    // Get hourly temperatures for the next 24 hours
    const hourlyTemps = forecast.list.slice(0, 24).map(item => item.main.temp);
    const minTemp = Math.min(...hourlyTemps);
    const maxTemp = Math.max(...hourlyTemps);
    const tempRange = maxTemp - minTemp;

    // Clear existing trend points
    const existingPoints = trendChart.querySelectorAll('.trend-point');
    existingPoints.forEach(point => point.remove());

    // Create trend points
    hourlyTemps.forEach((temp, index) => {
      const point = document.createElement('div');
      point.className = 'trend-point';
      
      // Calculate position (0-100% horizontally, temperature-based vertically)
      const xPercent = (index / (hourlyTemps.length - 1)) * 100;
      const yPercent = tempRange > 0 ? ((maxTemp - temp) / tempRange) * 80 + 10 : 50;
      
      point.style.left = `${xPercent}%`;
      point.style.top = `${yPercent}%`;
      
      // Add tooltip with temperature
      point.title = `${Math.round(temp)}°C`;
      
      trendChart.appendChild(point);
    });

    // Create animated trend line
    this.createTrendLine(hourlyTemps, minTemp, maxTemp);
  }

  /**
   * Create animated trend line
   */
  createTrendLine(temps, minTemp, maxTemp) {
    const trendChart = document.getElementById('trendChart');
    const trendLine = trendChart.querySelector('.trend-line');
    
    if (!trendLine) return;

    // Create SVG path for smooth curve
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('stroke', 'url(#trendGradient)');
    path.setAttribute('stroke-width', '3');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');

    // Create gradient definition
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'trendGradient');
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y2', '0%');

    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', '#667eea');
    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', '#764ba2');

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);
    svg.appendChild(defs);

    // Create path data
    const tempRange = maxTemp - minTemp;
    let pathData = '';
    
    temps.forEach((temp, index) => {
      const x = (index / (temps.length - 1)) * 100;
      const y = tempRange > 0 ? ((maxTemp - temp) / tempRange) * 80 + 10 : 50;
      
      if (index === 0) {
        pathData += `M ${x} ${y}`;
      } else {
        pathData += ` L ${x} ${y}`;
      }
    });

    path.setAttribute('d', pathData);
    path.style.strokeDasharray = '1000';
    path.style.strokeDashoffset = '1000';
    path.style.animation = 'drawTrendLine 2s ease-in-out forwards';

    svg.appendChild(path);
    trendChart.appendChild(svg);

    // Add CSS animation for drawing the line
    if (!document.getElementById('trendLineAnimation')) {
      const style = document.createElement('style');
      style.id = 'trendLineAnimation';
      style.textContent = `
        @keyframes drawTrendLine {
          to {
            stroke-dashoffset: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
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
   * Intelligent caching system
   */
  isCacheValid(key, type) {
    const cache = this.cache[type];
    if (!cache.has(key)) return false;
    
    const cached = cache.get(key);
    const age = Date.now() - cached.timestamp;
    return age < this.config.CACHE_DURATION;
  }

  /**
   * Fetch with retry mechanism
   */
  async fetchWithRetry(url, retries = this.config.MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.OFFLINE_TIMEOUT);
        
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        this.state.retryCount++;
        
        if (i === retries - 1) {
          throw error;
        }
        
        // Exponential backoff
        const delay = this.config.RETRY_DELAY * Math.pow(2, i);
        this.logPerformance(`Retry ${i + 1}/${retries} in ${delay}ms`);
        await this.sleep(delay);
      }
    }
  }

  /**
   * Intelligent error handling
   */
  handleError(context, error) {
    this.performance.errors++;
    this.errors.lastError = {
      context,
      error: error.message,
      timestamp: Date.now(),
      retryCount: this.state.retryCount
    };

    // Categorize errors
    if (error.name === 'AbortError') {
      this.errors.networkErrors.push(this.errors.lastError);
      this.showToast('Request timeout. Please check your connection.', 'warning');
    } else if (error.message.includes('Failed to fetch')) {
      this.errors.networkErrors.push(this.errors.lastError);
      this.showToast('Network error. Using cached data if available.', 'warning');
    } else {
      this.errors.apiErrors.push(this.errors.lastError);
      this.showToast(`API error: ${error.message}`, 'error');
    }

    // Log error for debugging
    console.error(`[${context}] Error:`, error);
    
    // Auto-recovery suggestions
    this.suggestRecovery(context, error);
  }

  /**
   * Suggest recovery actions
   */
  suggestRecovery(context, error) {
    if (!this.state.isOnline) {
      this.showToast('You appear to be offline. Some features may be limited.', 'warning');
      return;
    }

    if (this.state.retryCount >= this.config.MAX_RETRIES) {
      this.showToast('Multiple failures detected. Please refresh the page.', 'error');
      return;
    }

    if (error.message.includes('401') || error.message.includes('403')) {
      this.showToast('API key issue. Please contact support.', 'error');
    }
  }

  /**
   * Performance monitoring
   */
  logPerformance(message) {
    const timestamp = new Date().toISOString();
    console.log(`[Performance ${timestamp}] ${message}`);
    
    // Store performance metrics
    this.performance.loadTimes.push({
      message,
      timestamp: Date.now()
    });
    
    // Keep only last 100 entries
    if (this.performance.loadTimes.length > 100) {
      this.performance.loadTimes.shift();
    }
  }

  /**
   * Sleep utility for delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Network status monitoring
   */
  setupNetworkMonitoring() {
    window.addEventListener('online', () => {
      this.state.isOnline = true;
      this.showToast('Connection restored! Refreshing data...', 'success');
      this.loadWeatherData(this.state.currentCity);
    });

    window.addEventListener('offline', () => {
      this.state.isOnline = false;
      this.showToast('Connection lost. Using cached data.', 'warning');
    });
  }

  /**
   * Smart notifications system
   */
  setupSmartNotifications() {
    // Weather alerts
    this.setupWeatherAlerts();
    
    // Performance notifications
    this.setupPerformanceAlerts();
    
    // Maintenance notifications
    this.setupMaintenanceAlerts();
  }

  /**
   * Weather alerts based on conditions
   */
  setupWeatherAlerts() {
    if (!this.state.currentWeather) return;

    const weather = this.state.currentWeather;
    const alerts = [];

    // Temperature alerts
    if (weather.main.temp > 35) {
      alerts.push('High temperature warning! Stay hydrated.');
    } else if (weather.main.temp < 5) {
      alerts.push('Low temperature warning! Dress warmly.');
    }

    // Wind alerts
    if (weather.wind.speed > 20) {
      alerts.push('Strong winds detected. Be cautious outdoors.');
    }

    // Precipitation alerts
    if (weather.weather[0].main.toLowerCase().includes('rain')) {
      alerts.push('Rain expected. Consider carrying an umbrella.');
    }

    // Show alerts
    alerts.forEach((alert, index) => {
      setTimeout(() => {
        this.showToast(alert, 'warning');
      }, index * 2000);
    });
  }

  /**
   * Performance monitoring alerts
   */
  setupPerformanceAlerts() {
    // Monitor API response times
    const avgResponseTime = this.calculateAverageResponseTime();
    if (avgResponseTime > 3000) {
      this.showToast('Slow network detected. Some features may be limited.', 'warning');
    }

    // Monitor error rates
    const errorRate = this.calculateErrorRate();
    if (errorRate > 0.1) {
      this.showToast('High error rate detected. Please refresh if issues persist.', 'warning');
    }
  }

  /**
   * Maintenance alerts
   */
  setupMaintenanceAlerts() {
    // Check if app needs update
    const lastUpdate = localStorage.getItem('lastAppUpdate');
    const daysSinceUpdate = lastUpdate ? (Date.now() - parseInt(lastUpdate)) / (1000 * 60 * 60 * 24) : 0;
    
    if (daysSinceUpdate > 7) {
      this.showToast('App update available. Please refresh for latest features.', 'info');
    }
  }

  /**
   * Data validation
   */
  validateWeatherData(data) {
    const required = ['name', 'main', 'weather', 'wind'];
    const missing = required.filter(field => !data[field]);
    
    if (missing.length > 0) {
      throw new Error(`Invalid weather data: missing fields ${missing.join(', ')}`);
    }

    // Validate temperature range
    if (data.main.temp < -50 || data.main.temp > 60) {
      throw new Error('Temperature out of reasonable range');
    }

    // Validate humidity
    if (data.main.humidity < 0 || data.main.humidity > 100) {
      throw new Error('Humidity out of valid range');
    }

    return true;
  }

  /**
   * Calculate average response time
   */
  calculateAverageResponseTime() {
    if (this.performance.loadTimes.length === 0) return 0;
    
    const times = this.performance.loadTimes
      .filter(entry => entry.message.includes('API call completed'))
      .map(entry => {
        const match = entry.message.match(/(\d+\.\d+)ms/);
        return match ? parseFloat(match[1]) : 0;
      });
    
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  }

  /**
   * Calculate error rate
   */
  calculateErrorRate() {
    const totalCalls = this.performance.apiCalls;
    const errors = this.performance.errors;
    return totalCalls > 0 ? errors / totalCalls : 0;
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