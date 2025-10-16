/* Weather UI logic wired to OpenWeatherMap */
(() => {
const DEFAULT_API_KEY = "7ea3d92da13774f9f2605a735e32cf9c"; // Dev only. Prefer server proxy in production.
  const apiKey = () => (localStorage.getItem('owm_api_key') || DEFAULT_API_KEY).trim()
  const API_BASE = "https://api.openweathermap.org/data/2.5";
  const DEFAULT_CITY = "Delhi, IN";
  let units = localStorage.getItem('units') || 'metric'; // 'metric' or 'imperial'
  let themePref = localStorage.getItem('theme') || 'light'; // 'light' | 'dark' | 'system'
  let providerMode = localStorage.getItem('provider_mode') || 'auto'; // 'auto' | 'owm' | 'om'
  const MINI_CITIES = [
    { el: null, name: "Delhi, IN" },
    { el: null, name: "Punjab, IN" },
    { el: null, name: "Jammu, IN" }
  ];
  const LIST_CITY_MAP = [
    { name: "Delhi, IN" },
    { name: "Punjab, IN" },
    { name: "Jammu, IN" },
    { name: "Mumbai, IN" }
  ];

  const appRoot = document.querySelector('.app');

  // Fetch helper with timeout
  async function fetchWithTimeout(resource, options = {}, timeoutMs = 10000) {
    const { signal } = options;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(new Error('timeout')), timeoutMs);
    try {
      const res = await fetch(resource, { ...options, signal: signal || ctrl.signal });
      return res;
    } finally { clearTimeout(t); }
  }

  // DOM refs
  let __lastData = null;

  const els = {
    headlineMain: document.getElementById("headlineMain"),
    headlineSub: document.getElementById("headlineSub"),
    descText: document.getElementById("descText"),
    mainTemp: document.getElementById("mainTemp"),
    qualityChip: document.getElementById("qualityChip"),
    windLine: document.getElementById("windLine"),
    uvLine: document.getElementById("uvLine"),
    cityLine: document.getElementById("cityLine"),
    humidityText: document.getElementById("humidityText"),
    humidityGauge: document.querySelector(".h-gauge"),
    time: document.querySelector(".now .time"),
    cityList: document.getElementById("cityList"),
    shareBtn: document.getElementById('shareBtn'),
    bookmarkBtn: document.getElementById('bookmarkBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettings: document.getElementById('closeSettings'),
    unitSelect: document.getElementById('unitSelect'),
themeSelect: document.getElementById('themeSelect'),
    owmKeyInput: document.getElementById('owmKeyInput'),
    saveKeyBtn: document.getElementById('saveKeyBtn'),
    searchForm: document.getElementById('searchForm'),
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    cloudBtn: document.getElementById('cloudBtn'),
    rainBtn: document.getElementById('rainBtn'),
    windBtn: document.getElementById('windBtn'),
    snowBtn: document.getElementById('snowBtn'),
    toast: document.getElementById('toast'),
    tempSlider: document.getElementById('tempSlider'),
    sliderValue: document.getElementById('sliderValue'),
    freezeText: document.getElementById('freezeText'),
    suggestions: document.getElementById('suggestions'),
    cloudSvg: document.querySelector('.cloud-svg'),
    rainOverlay: document.querySelector('.rain'),
    snowOverlay: document.querySelector('.snow'),
    windOverlay: document.querySelector('.wind'),
    dsText: document.getElementById('dataSourceText'),
    dsInfoBtn: document.getElementById('dsInfoBtn'),
    dsTooltip: document.getElementById('dsTooltip'),
    geoBtn: document.getElementById('geoBtn'),
    favChips: document.getElementById('favChips'),
    subnav: document.querySelector('.subnav'),
    subnavLinks: Array.from(document.querySelectorAll('.subnav .subnav-link')),
    navCityLabel: document.getElementById('navCityLabel'),
    backToTop: document.getElementById('backToTop'),
    favsModal: document.getElementById('favsModal'),
    manageFavsBtn: document.getElementById('manageFavsBtn'),
    closeFavs: document.getElementById('closeFavs'),
    forecastStrip: document.getElementById('forecastStrip'),
    forecastBtn: document.getElementById('forecastBtn'),
    forecastSection: document.getElementById('forecastSection'),
  };

  // Utility
  const title = (s) => s ? s.replace(/\b\w/g, c => c.toUpperCase()) : s;
  const degToCompass = (deg) => {
    const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"]; 
    return dirs[Math.round(deg / 22.5) % 16];
  };
  const toMPH = (mps) => Math.round(mps * 2.23694);
  const toKPH = (mps) => Math.round(mps * 3.6);
  const formatTemp = (tC) => `${Math.round(tC)}°`;

  function setTimeWithOffset(offsetSec) {
    const localMs = Date.now();
    const localOffsetMs = new Date().getTimezoneOffset() * 60 * 1000;
    const cityTime = new Date(localMs + offsetSec * 1000 + localOffsetMs);
    const hh = cityTime.getHours();
    const h12 = ((hh + 11) % 12) + 1;
    const mm = cityTime.getMinutes().toString().padStart(2, "0");
    const ampm = hh >= 12 ? "PM" : "AM";
    els.time.innerHTML = `${h12}:${mm} <span>${ampm}</span>`;
  }

  async function geocode(q) {
    // Try bias to India if user doesn't specify country
    let query = q;
    if (!/,/.test(q)) query = `${q},IN`;
const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=1&appid=${apiKey()}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const list = await res.json();
    return list && list[0] ? list[0] : null;
  }

  async function fetchOpenMeteoByCoords(lat, lon) {
    try {
      const params = `latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&timezone=auto`;
      const wRes = await fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!wRes.ok) return null;
      const w = await wRes.json();
      const tempC = w.current?.temperature_2m;
      return {
        name: `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
        timezone: Math.round((w.utc_offset_seconds || 0)),
        sys: { sunrise: 0, sunset: 86400 },
        weather: [{ main: "Weather", description: "from open-meteo" }],
        main: {
          temp: units === 'imperial' ? (tempC * 9/5 + 32) : tempC,
          feels_like: tempC,
          pressure: 1015,
          humidity: 50,
        },
        wind: { speed: units === 'imperial' ? (10 / 2.237) : (10/3.6), deg: 0 },
        __om_daily: w.daily || null,
      };
    } catch { return null; }
  }

  async function fetchOpenMeteo(city) {
    try {
      // geocode via Open-Meteo (no key)
      const gRes = await fetchWithTimeout(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
      if (!gRes.ok) return null;
      const gData = await gRes.json();
      const loc = gData?.results?.[0];
      if (!loc) return null;
      const lat = loc.latitude, lon = loc.longitude;
      const params = `latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&timezone=auto`;
      const wRes = await fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!wRes.ok) return null;
      const w = await wRes.json();
      // adapt to OWM-like structure
      const tempC = w.current?.temperature_2m;
      const humidity = w.current?.relative_humidity_2m;
      const wind = w.current?.wind_speed_10m; // km/h
      return {
        name: loc.name,
        timezone: Math.round((w.utc_offset_seconds || 0)),
        sys: { sunrise: 0, sunset: 86400 },
        weather: [{ main: "Weather", description: "from open-meteo" }],
        main: {
          temp: units === 'imperial' ? (tempC * 9/5 + 32) : tempC,
          feels_like: tempC,
          pressure: 1015,
          humidity: humidity,
        },
        wind: { speed: units === 'imperial' ? (wind / 2.237) : (wind / 3.6), deg: 0 },
        __om_daily: w.daily || null,
        coord: { lat, lon },
      };
    } catch { return null; }
  }

  async function fetchByCoords(lat, lon) {
    const dbg = { ts: new Date().toISOString(), mode: providerMode, coords: {lat,lon}, tries: [] };
    async function tryOWM() {
      const url = `${API_BASE}/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${apiKey()}`;
      try { const res = await fetchWithTimeout(url); dbg.tries.push({provider:'OWM',url,status:res.status}); if (res.ok){ const obj=await res.json(); obj.__source='OpenWeatherMap'; setDebug(dbg); return obj;} } catch(e){ dbg.tries.push({provider:'OWM',url,error:String(e)}); }
      return null;
    }
    async function tryOM() {
      const om = await fetchOpenMeteoByCoords(lat,lon); if (om){ om.__source='Open-Meteo'; dbg.tries.push({provider:'Open-Meteo',status:'ok'}); setDebug(dbg); return om;} dbg.tries.push({provider:'Open-Meteo',status:'fail'}); return null;
    }
    let data=null;
    if (providerMode==='owm') data = await tryOWM(); else if (providerMode==='om') data=await tryOM(); else data = await tryOWM() || await tryOM();
    if (!data){ setDebug(dbg); throw new Error('Failed to fetch by coords'); }
    return data;
  }

  async function fetchByCity(city) {
    const dbg = { ts: new Date().toISOString(), mode: providerMode, city, tries: [] };

    async function tryOWMByName() {
      const url = `${API_BASE}/weather?q=${encodeURIComponent(city)}&units=${units}&appid=${apiKey()}`;
      try {
        const res = await fetchWithTimeout(url);
        dbg.tries.push({ provider: 'OWM', url, status: res.status });
        if (res.ok) { const obj = await res.json(); obj.__source = 'OpenWeatherMap'; setDebug(dbg); return obj; }
      } catch (e) { dbg.tries.push({ provider: 'OWM', url, error: String(e) }); }
      return null;
    }
    async function tryOWMByCoords() {
      const geo = await geocode(city);
      if (!geo) { dbg.tries.push({ provider: 'OWM', step: 'geocode', status: 'none' }); return null; }
      const url = `${API_BASE}/weather?lat=${geo.lat}&lon=${geo.lon}&units=${units}&appid=${apiKey()}`;
      try {
        const res = await fetchWithTimeout(url);
        dbg.tries.push({ provider: 'OWM', url, status: res.status });
        if (res.ok) { const obj = await res.json(); obj.__source = 'OpenWeatherMap'; setDebug(dbg); return obj; }
      } catch (e) { dbg.tries.push({ provider: 'OWM', url, error: String(e) }); }
      return null;
    }
    async function tryOpenMeteo() {
      const om = await fetchOpenMeteo(city);
      if (om) { om.__source = 'Open-Meteo'; dbg.tries.push({ provider: 'Open-Meteo', status: 'ok' }); setDebug(dbg); return om; }
      dbg.tries.push({ provider: 'Open-Meteo', status: 'fail' });
      return null;
    }

    let data = null;
    if (providerMode === 'owm') {
      data = await tryOWMByName() || await tryOWMByCoords();
    } else if (providerMode === 'om') {
      data = await tryOpenMeteo();
    } else { // auto
      data = await tryOWMByName() || await tryOWMByCoords() || await tryOpenMeteo();
    }

    if (!data) { setDebug(dbg); throw new Error(`Failed to fetch weather for ${city}`); }
    return data;
  }

  function startLoading(){ appRoot.classList.add('loading'); }
  function stopLoading(){ appRoot.classList.remove('loading'); }

  async function refreshMain(city) {
    try {
      startLoading();
      const data = await fetchByCity(city);
      __lastData = data;
      const t = Math.round(data.main.temp);
      const hum = data.main.humidity; // %
      const windSpeedText = units === 'imperial' ? `${Math.round(data.wind.speed)} MPH` : `${toKPH(data.wind.speed)} KPH`;
      const windDir = typeof data.wind.deg === "number" ? degToCompass(data.wind.deg) : "";
      const cityName = data.name || city;
      const wxMain = data.weather?.[0]?.main || "Weather";
      const wxDesc = data.weather?.[0]?.description || "";

      // Headlines
      const mainWord = wxMain.toLowerCase() === "rain" ? "Stormy" : title(wxMain);
      els.headlineMain.textContent = mainWord;
      els.headlineSub.textContent = wxDesc ? `with ${title(wxDesc)}` : "";
      const feels = Math.round(data.main.feels_like);
      els.descText.textContent = `Feels like ${feels}°, humidity ${hum}%. Pressure ${data.main.pressure} hPa.`;

      // Numbers
      els.mainTemp.textContent = `${t}°`;
      els.cityLine.textContent = title(cityName);
      if (els.navCityLabel) els.navCityLabel.textContent = title(cityName);
      // Now bar
      const codeMain = (data.weather?.[0]?.main || '').toLowerCase();
      const desc = data.weather?.[0]?.description || '';
      const kind = codeMain.includes('rain') ? 'rain' : codeMain.includes('snow') ? 'snow' : codeMain.includes('thunder') ? 'thunder' : codeMain.includes('cloud') ? 'cloud' : 'sun';
      if (document.getElementById('nowBarCity')) document.getElementById('nowBarCity').textContent = title(cityName);
      if (document.getElementById('nowBarDesc')) document.getElementById('nowBarDesc').textContent = desc ? title(desc) : title(wxMain);
      if (document.getElementById('nowBarTemp')) document.getElementById('nowBarTemp').textContent = `${t}°`;
      if (document.getElementById('nowBarFeels')) document.getElementById('nowBarFeels').textContent = `Feels ${feels}°`;
      const ico = kind === 'sun' ? '☀️' : kind === 'cloud' ? '⛅' : kind === 'rain' ? '🌧️' : kind === 'snow' ? '❄️' : '⛈️';
      if (document.getElementById('nowBarIcon')) document.getElementById('nowBarIcon').textContent = ico;

      els.windLine.textContent = `WIND: ${windDir} ${windSpeedText}`;
      els.humidityText.textContent = `${hum}%`;
      els.humidityGauge?.style.setProperty("--hum", `${hum}%`);
      // Data source label
      const source = data.__source || 'OpenWeatherMap';
      if (els.dsText) els.dsText.textContent = `Data source: ${source}`;

      // Forecast strip (if available)
      if (els.forecastStrip && data.__om_daily) {
        const ico = (code) => {
          if (code===0) return '☀️';
          if ([1,2,3].includes(code)) return '⛅';
          if ([45,48].includes(code)) return '🌫️';
          if ([51,53,55,56,57].includes(code)) return '🌦️';
          if ([61,63,65,80,81,82].includes(code)) return '🌧️';
          if ([71,73,75,77,85,86].includes(code)) return '❄️';
          if ([95,96,99].includes(code)) return '⛈️';
          return '🌡️';
        };
        let days = [];
        if (data.__om_daily?.time) {
          const t = data.__om_daily;
          days = t.time.slice(0,7).map((d, i) => ({
            day: new Date(d).toLocaleDateString(undefined,{weekday:'short'}),
            max: Math.round(t.temperature_2m_max[i]),
            min: Math.round(t.temperature_2m_min[i]),
            pop: t.precipitation_probability_max ? Math.round(t.precipitation_probability_max[i]||0) : null,
            icon: t.weathercode ? ico(t.weathercode[i]) : '🌡️'
          }));
        } else if (false) {
          // fetch 7-day daily using OM if we only have OWM current data
          try {
            const extra = await fetchOpenMeteoByCoords(data.coord.lat, data.coord.lon);
            const t = extra?.__om_daily;
            if (t?.time) {
              days = t.time.slice(0,7).map((d, i) => ({
                day: new Date(d).toLocaleDateString(undefined,{weekday:'short'}),
                max: Math.round(t.temperature_2m_max[i]),
                min: Math.round(t.temperature_2m_min[i]),
                pop: t.precipitation_probability_max ? Math.round(t.precipitation_probability_max[i]||0) : null,
                icon: t.weathercode ? ico(t.weathercode[i]) : '🌡️'
              }));
            }
          } catch {}
        }
        els.forecastStrip.innerHTML = days.length
          ? days.map(d => `<div class=\"forecast-card\"><div class=\"day\">${d.day}</div><div class=\"ico\">${d.icon||'🌡️'}</div><div class=\"t\">${d.max}° / ${d.min}°</div><div class=\"pop\">${d.pop!=null? d.pop+'%':''}</div></div>`).join('')
          : `<div class=\"forecast-card\"><div class=\"day\">N/A</div><div class=\"t\">Forecast unavailable</div></div>`;
      }

      // Quality chip heuristic
      const qual = hum < 60 && wxMain !== "Thunderstorm" ? "excellent" : (hum < 75 ? "good" : "moderate");
      els.qualityChip.textContent = qual;
      els.qualityChip.classList.remove('quality--excellent','quality--good','quality--moderate');
      els.qualityChip.classList.add(`quality--${qual}`);

      // Time using city timezone offset + day/night detection
      if (typeof data.timezone === "number") {
        setTimeWithOffset(data.timezone);
        if (window.__timeTimer) clearInterval(window.__timeTimer);
        window.__timeTimer = setInterval(() => setTimeWithOffset(data.timezone), 60 * 1000);

        const nowUtc = Math.floor(Date.now() / 1000);
        const localNow = nowUtc + data.timezone; // seconds
        const sunrise = (data.sys?.sunrise || 0) + data.timezone;
        const sunset = (data.sys?.sunset || 0) + data.timezone;
        const isDay = localNow >= sunrise && localNow < sunset;
        appRoot.classList.toggle('day', isDay);
        appRoot.classList.toggle('night', !isDay);
        // Adjust accents slightly at night
        if (isDay) {
          appRoot.style.setProperty('--accent-warm', '#ffbf5e');
          appRoot.style.setProperty('--accent-cool', '#6cc7ff');
        } else {
          appRoot.style.setProperty('--accent-warm', '#ffc56b');
          appRoot.style.setProperty('--accent-cool', '#7ad1ff');
        }
      }

      // UV index requires OneCall (paid on OWM 3.0). Leaving as N/A to avoid errors.
      els.uvLine.textContent = `UV INDEX: N/A`;

      // Scene classes inferred from weather
      appRoot.classList.remove('show-rain','show-snow','show-wind','cloudy','clouds-clear','clouds-low','clouds-mid','clouds-high','clouds-storm');
      els.rainBtn?.classList.remove('active');
      els.snowBtn?.classList.remove('active');
      els.windBtn?.classList.remove('active');
      els.cloudBtn?.classList.remove('active');
      const w = wxMain.toLowerCase();
      if (w.includes('rain') || w.includes('drizzle')) { appRoot.classList.add('show-rain'); els.rainBtn?.classList.add('active'); }
      if (w.includes('snow')) { appRoot.classList.add('show-snow'); els.snowBtn?.classList.add('active'); }
      if (w.includes('cloud')) { appRoot.classList.add('cloudy'); els.cloudBtn?.classList.add('active'); }
      if (data.wind.speed > 7) { appRoot.classList.add('show-wind'); els.windBtn?.classList.add('active'); }
      // Cloud density & speed
      let cloudPct = typeof data.clouds?.all === 'number' ? data.clouds.all : null;
      if (cloudPct == null && data.weather?.[0]?.id) {
        const id = data.weather[0].id;
        cloudPct = (id===800) ? 5 : (id>=801 && id<=803) ? 50 : (id===804) ? 90 : 40;
      }
      const level = cloudPct==null ? 'clouds-mid' : cloudPct<15 ? 'clouds-clear' : cloudPct<35 ? 'clouds-low' : cloudPct<65 ? 'clouds-mid' : cloudPct<85 ? 'clouds-high' : 'clouds-storm';
      appRoot.classList.add(level);
      // wind-based speed tweak + streak intensity
      const cloudsEl = document.querySelector('.clouds');
      if (cloudsEl) {
        const mps = Number(data.wind.speed||0);
        const base = 110; // seconds
        const dur = Math.max(40, base - mps * 8);
        cloudsEl.style.setProperty('--speed', `${dur}s`);
        const alpha = Math.min(.7, Math.max(.12, mps * 0.05));
        appRoot.style.setProperty('--wind-opacity', String(alpha));
      }
      // lightning enable for thunderstorm
      const isStorm = (data.weather?.[0]?.id||0) >= 200 && (data.weather?.[0]?.id||0) < 300;
      appRoot.classList.toggle('storm-lightning', !!isStorm);
      if (isStorm) {
        appRoot.style.setProperty('--flash', '4s');
        const le = document.querySelector('.lightning');
        if (le) {
          const rn = (min,max)=> (Math.random()*(max-min)+min).toFixed(1)+"%";
          le.style.setProperty('--ln1', rn(6,18));
          le.style.setProperty('--lt1', rn(12,32));
          le.style.setProperty('--lh1', rn(28,48));
          le.style.setProperty('--ln2', rn(12,22));
          le.style.setProperty('--lt2', rn(22,42));
          le.style.setProperty('--lh2', rn(20,40));
        }
      } else {
        appRoot.style.removeProperty('--flash');
      }
    } catch (err) {
      console.error(err);
      showToast(`Failed to load weather${err?.message ? ': ' + err.message : ''}`);
    } finally { stopLoading(); }
  }

  async function refreshMiniCards() {
    document.querySelectorAll('.mini-temps .mini').forEach((card, i) => {
      MINI_CITIES[i].el = card;
    });
    startLoading();
    await Promise.all(MINI_CITIES.map(async (entry) => {
      try {
        const data = await fetchByCity(entry.name);
        const temp = Math.round(data.main.temp);
        const tempEl = entry.el.querySelector('.mini-temp');
        if (tempEl) tempEl.textContent = `${temp}°`;
      } catch (e) {
        console.warn('Mini card fetch failed', entry.name, e);
      }
    }));
    stopLoading();
  }

  async function refreshCityListTemps() {
    const items = Array.from(els.cityList.querySelectorAll('li'));
    startLoading();
    await Promise.all(items.map(async (li, idx) => {
      const city = li.dataset.city || LIST_CITY_MAP[idx]?.name;
      try {
        const data = await fetchByCity(city);
        const b = li.querySelector('b');
        if (b) b.textContent = `${Math.round(data.main.temp)}°`;
      } catch (e) {
        console.warn('City list fetch failed', city, e);
      }
    }));
  }

  function renderFavorites() {
    if (!els.favChips) return;
    const arr = JSON.parse(localStorage.getItem('favoriteCities') || '[]');
    els.favChips.innerHTML = arr.map(c => `<span class="chip-fav" data-city="${c}">${c}</span>`).join('');
  }

  function renderFavoritesList() {
    const list = document.querySelector('.favs-list');
    if (!list) return;
    const arr = JSON.parse(localStorage.getItem('favoriteCities') || '[]');
    list.innerHTML = arr.map(c => `<div class="row"><span>${c}</span><button class="icon small" data-remove="${c}">✕</button></div>`).join('');
    // add remove listeners
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-remove]');
      if (!btn) return;
      const city = btn.dataset.remove;
      toggleFavorite(city);
      renderFavoritesList();
    });
  }

  function toggleFavorite(city){
    const arr = JSON.parse(localStorage.getItem('favoriteCities') || '[]');
    const i = arr.findIndex(x => x.toLowerCase() === city.toLowerCase());
    if (i>=0) arr.splice(i,1); else arr.unshift(city);
    localStorage.setItem('favoriteCities', JSON.stringify(arr.slice(0,8)));
    renderFavorites();
  }

  function wireSubnav() {
    if (!els.subnav) return;
    // click handlers
    els.subnavLinks.forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        const target = btn.getAttribute('data-target');
        if (action === 'open-favs') { if (els.favsModal) els.favsModal.hidden = false; return; }
        if (action === 'open-settings') { els.settingsModal.hidden = false; return; }
        if (target) {
          const el = document.querySelector(target);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
    // scroll spy
    const sections = [
      { id: '#todaySection', el: document.querySelector('#todaySection') },
      { id: '#forecastSection', el: document.querySelector('#forecastSection') },
      { id: '#hourlySection', el: document.querySelector('#hourlySection') },
    ];
    const onScroll = () => {
      const y = appRoot.scrollTop + 120; // account for header/subnav height
      let activeId = '#todaySection';
      sections.forEach(s => { if (s.el && s.el.offsetTop <= y) activeId = s.id; });
      els.subnavLinks.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-target') === activeId));
    };
    appRoot.addEventListener('scroll', () => {
      onScroll();
      if (els.backToTop) els.backToTop.classList.toggle('show', appRoot.scrollTop > 400);
    });
    onScroll();

    // back to top action
    els.backToTop?.addEventListener('click', () => appRoot.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  function wireCityClicks() {
    els.cityList.addEventListener('click', (e) => {
      const li = e.target.closest('li[data-city]');
      if (!li) return;
      els.cityList.querySelectorAll('li').forEach(x => x.classList.remove('active'));
      li.classList.add('active');
      const city = (li.dataset.city || '').trim();
      setCity(city);
    });

    // mini cards
    document.querySelectorAll('.mini-temps .mini').forEach(card => {
      card.addEventListener('click', () => setCity(card.dataset.city));
      card.style.cursor = 'pointer';
    });

    // favorites chips
    els.favChips?.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip-fav'); if (!chip) return; setCity(chip.dataset.city);
    });

    // geolocate
    els.geoBtn?.addEventListener('click', () => {
      if (!navigator.geolocation) { showToast('Geolocation not supported'); return; }
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const data = await fetchByCoords(latitude, longitude);
          const name = data?.name || `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
          setCity(name, data);
        } catch (e) { showToast('Failed to geolocate'); }
      }, () => showToast('Permission denied'));
    });
  }

  function setDebug(obj){ const pre = document.getElementById('debugText'); if (pre) pre.textContent = JSON.stringify(obj, null, 2); }

  function setCity(city, preloaded) {
    localStorage.setItem('lastCity', city);
    if (preloaded) {
      (async () => { await refreshMain(city); await renderSevenDay(undefined, true); })();
    } else {
      refreshMain(city).then(() => renderSevenDay(undefined, true));
    }
    if (localStorage.getItem('forecast_pinned') === '1') {
      renderSevenDay(city, true);
    }
  }

  function showToast(msg) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2000);
  }

  function setTheme(theme) {
    // theme: 'light' | 'dark' | 'system'
    themePref = theme;
    localStorage.setItem('theme', themePref);
    const isDark = themePref === 'dark' || (themePref === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    appRoot.setAttribute('data-theme', isDark ? 'dark' : 'light');
    els.themeSelect.value = themePref;
  }

  function wireTopButtons() {
    // Search
    const search = async (q) => {
      if (!q) return;
      try {
        const data = await fetchByCity(q);
        const name = data?.name || q;
        els.cityList.querySelectorAll('li').forEach(x => x.classList.remove('active'));
        refreshMain(name);
        localStorage.setItem('lastCity', name);
        showToast(`Loaded ${name}`);
      } catch (e) {
        showToast('City not found');
      }
    };
    els.searchForm?.addEventListener('submit', (e) => { e.preventDefault(); search(els.searchInput.value.trim()); });
    els.searchBtn?.addEventListener('click', (e) => { e.preventDefault(); search(els.searchInput.value.trim()); });

    // Share
    els.shareBtn?.addEventListener('click', async () => {
      const city = els.cityLine.textContent || 'Weather';
      const text = `Weather for ${city}`;
      try {
        if (navigator.share) {
          await navigator.share({ title: 'Weather', text });
          showToast('Shared');
        } else {
          await navigator.clipboard.writeText(text);
          showToast('Copied to clipboard');
        }
      } catch {}
    });

    // Bookmark current city
    const updateBookmarkUI = () => {
      const favs = JSON.parse(localStorage.getItem('favoriteCities') || '[]');
      const isFav = !!favs.find(x => x.toLowerCase() === (els.cityLine.textContent||'').toLowerCase());
      els.bookmarkBtn?.classList.toggle('active', !!isFav);
    };
    els.bookmarkBtn?.addEventListener('click', () => {
      const city = els.cityLine.textContent || '';
      if (!city) return;
      toggleFavorite(city);
      updateBookmarkUI();
      showToast('Favorites updated');
    });

    // Settings open/close
    els.settingsBtn?.addEventListener('click', () => {
      els.settingsModal.hidden = false;
      els.unitSelect.value = units;
      els.themeSelect.value = themePref;
      if (els.owmKeyInput) { const has = !!localStorage.getItem('owm_api_key'); els.owmKeyInput.value = has ? '••••••••••' : ''; }
      const pm = (localStorage.getItem('provider_mode') || providerMode);
      const dbgShow = localStorage.getItem('debug_show') === '1';
      const pSel = document.getElementById('providerSelect'); if (pSel) pSel.value = pm;
      const dT = document.getElementById('debugToggle'); if (dT) dT.checked = dbgShow;
    });
    els.closeSettings?.addEventListener('click', () => els.settingsModal.hidden = true);
    els.settingsModal?.addEventListener('click', (e) => { if (e.target === els.settingsModal) els.settingsModal.hidden = true; });

    // Favorites open/close
    els.manageFavsBtn?.addEventListener('click', () => {
      els.favsModal.hidden = false;
      renderFavoritesList();
    });
    els.closeFavs?.addEventListener('click', () => els.favsModal.hidden = true);
    els.favsModal?.addEventListener('click', (e) => { if (e.target === els.favsModal) els.favsModal.hidden = true; });

    // Settings changes
    els.unitSelect?.addEventListener('change', () => {
      units = els.unitSelect.value;
      localStorage.setItem('units', units);
      const city = els.cityLine.textContent || DEFAULT_CITY;
      refreshMain(city);
      refreshMiniCards();
      refreshCityListTemps();
    });
    els.themeSelect?.addEventListener('change', () => setTheme(els.themeSelect.value));

    // Provider change
    const providerSelect = document.getElementById('providerSelect');
    providerSelect?.addEventListener('change', () => {
      providerMode = providerSelect.value;
      localStorage.setItem('provider_mode', providerMode);
      const city = els.cityLine.textContent || DEFAULT_CITY;
      refreshMain(city);
      refreshMiniCards();
      refreshCityListTemps();
    });

    // Auto refresh
    const arToggle = document.getElementById('autoRefreshToggle');
    const arMinutes = document.getElementById('autoRefreshMinutes');
    const applyAuto = () => {
      const on = !!arToggle?.checked; const mins = Math.max(1, Math.min(60, Number(arMinutes?.value||5)));
      localStorage.setItem('auto_refresh', on? '1':'0');
      localStorage.setItem('auto_refresh_minutes', String(mins));
      if (window.__autoRefresh) clearInterval(window.__autoRefresh);
      if (on) {
        window.__autoRefresh = setInterval(() => {
          const city = els.cityLine.textContent || DEFAULT_CITY;
          refreshMain(city);
          refreshMiniCards();
          refreshCityListTemps();
          renderSevenDay(undefined, true);
        }, mins*60*1000);
      }
    };
    if (arToggle && arMinutes) {
      arToggle.addEventListener('change', applyAuto);
      arMinutes.addEventListener('change', applyAuto);
      arToggle.checked = localStorage.getItem('auto_refresh')==='1';
      arMinutes.value = localStorage.getItem('auto_refresh_minutes') || '5';
      applyAuto();
    }

    // Debug toggle
    const dbgToggle = document.getElementById('debugToggle');
    const dbgPanel = document.getElementById('debugPanel');
    const dbgClose = document.getElementById('debugClose');
    const applyDbg = (show) => { if (dbgPanel) dbgPanel.hidden = !show; localStorage.setItem('debug_show', show ? '1' : '0'); };
    dbgToggle?.addEventListener('change', () => applyDbg(dbgToggle.checked));
    dbgClose?.addEventListener('click', () => applyDbg(false));

    // Save/remove OWM key
    els.saveKeyBtn?.addEventListener('click', () => {
      const raw = (els.owmKeyInput?.value || '').trim();
      if (raw && !/^•+$/.test(raw)) {
        localStorage.setItem('owm_api_key', raw);
        if (els.owmKeyInput) els.owmKeyInput.value = '••••••••••';
        showToast('Saved API key');
      } else if (!raw) {
        localStorage.removeItem('owm_api_key');
        showToast('Removed API key');
      }
      const city = els.cityLine.textContent || DEFAULT_CITY;
      refreshMain(city);
      refreshMiniCards();
      refreshCityListTemps();
    });

    // Weather overlay buttons
    const toggle = (btn, cls) => {
      btn.classList.toggle('active');
      appRoot.classList.toggle(cls);
    };
    els.cloudBtn?.addEventListener('click', () => toggle(els.cloudBtn, 'cloudy'));
    els.rainBtn?.addEventListener('click', () => toggle(els.rainBtn, 'show-rain'));
    els.windBtn?.addEventListener('click', () => toggle(els.windBtn, 'show-wind'));
    els.snowBtn?.addEventListener('click', () => toggle(els.snowBtn, 'show-snow'));

    // Update bookmark highlight after main city loads
    const obs = new MutationObserver(updateBookmarkUI);
    obs.observe(els.cityLine, { childList: true });
    updateBookmarkUI();
  }

  function wireSlider() {
    const update = () => {
      const v = Number(els.tempSlider.value);
      els.sliderValue.textContent = `${v > 0 ? '+' : ''}${v}°`;
      // naive freeze estimate: below -1 -> 2h, else 4-8h
      const freeze = v <= -5 ? 'Freezes in 1h' : v <= -1 ? 'Freezes in 2h' : v <= 1 ? 'Freezes in 4h' : 'No freeze expected';
      els.freezeText.textContent = `+${freeze}`;
    };
    els.tempSlider?.addEventListener('input', update);
    update();
  }

  // subtle parallax
  function wireParallax(){
    if (!(window.matchMedia && window.matchMedia('(pointer: fine)').matches)) return; // disable on touch
    const move = (e) => {
      const rect = appRoot.getBoundingClientRect();
      const cx = rect.left + rect.width/2;
      const cy = rect.top + rect.height/2;
      const dx = (e.clientX - cx) / rect.width; // -0.5..0.5
      const dy = (e.clientY - cy) / rect.height;
      const t = `translate(${dx*6}px, ${dy*4}px)`;
      els.cloudSvg && (els.cloudSvg.style.transform = t);
      els.rainOverlay && (els.rainOverlay.style.transform = `translateX(-50%) translate(${dx*8}px, ${dy*6}px)`);
      els.snowOverlay && (els.snowOverlay.style.transform = `translateX(-50%) translate(${dx*8}px, ${dy*6}px)`);
      els.windOverlay && (els.windOverlay.style.transform = `translate(${dx*4}px, ${dy*3}px)`);
    };
    appRoot.addEventListener('mousemove', move);
  }

  function icoSvg(kind){
    const svg = {
      sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"/><g opacity=".85"><path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="#fff" stroke-width="2" fill="none"/></g></svg>',
      cloud: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 19H7a5 5 0 1 1 1.7-9.7 6.5 6.5 0 0 1 12.2 3.2A4.5 4.5 0 0 1 17 19z"/></svg>',
      fog: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10h14M3 14h18M6 18h12" stroke="#fff" stroke-width="2" fill="none"/><path d="M17 9H7a5 5 0 1 1 1.7-9.7 6.5 6.5 0 0 1 12.2 3.2A4.5 4.5 0 0 1 17 9z" opacity=".4"/></svg>',
      drizzle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 13H7a4.5 4.5 0 1 1 1.7-8.7 6 6 0 0 1 11.3 2.9A4 4 0 0 1 17 13z"/><g fill="#7ad1ff"><circle cx="9" cy="18" r="1"/><circle cx="13" cy="20" r="1"/><circle cx="17" cy="18" r="1"/></g></svg>',
      rain: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 13H7a4.5 4.5 0 1 1 1.7-8.7 6 6 0 0 1 11.3 2.9A4 4 0 0 1 17 13z"/><g fill="#7ad1ff"><path d="M8 16l-1 3M12 16l-1 3M16 16l-1 3" stroke="#7ad1ff" stroke-width="2"/></g></svg>',
      snow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 13H7a4.5 4.5 0 1 1 1.7-8.7 6 6 0 0 1 11.3 2.9A4 4 0 0 1 17 13z"/><g stroke="#fff" stroke-width="1.6"><path d="M12 15v6"/><path d="M9 18h6"/><path d="M10 16l4 4"/><path d="M14 16l-4 4"/></g></svg>',
      thunder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 13H7a4.5 4.5 0 1 1 1.7-8.7 6 6 0 0 1 11.3 2.9A4 4 0 0 1 17 13z"/><path d="M12 14l-2 5 4-3-1 5 3-7z" fill="#ffd45f"/></svg>'
    };
    return svg[kind] || svg.sun;
  }

  function currentCityQuery() {
    // Prefer the displayed city, strip country in parentheses, fall back to lastCity or default
    let q = (els.cityLine?.textContent || '').trim();
    if (!q) q = (localStorage.getItem('lastCity') || DEFAULT_CITY).trim();
    q = q.replace(/\s*\([^\)]*\)\s*$/,''); // remove trailing (IN) etc.
    if (!/,/.test(q)) q = `${q}, IN`; // bias to India for defaults
    return q;
  }

  async function renderSevenDay(city, quiet=false) {
    const ico = (code) => {
      if (code===0) return icoSvg('sun');
      if ([1,2,3].includes(code)) return icoSvg('cloud');
      if ([45,48].includes(code)) return icoSvg('fog');
      if ([51,53,55,56,57].includes(code)) return icoSvg('drizzle');
      if ([61,63,65,80,81,82].includes(code)) return icoSvg('rain');
      if ([71,73,75,77,85,86].includes(code)) return icoSvg('snow');
      if ([95,96,99].includes(code)) return icoSvg('thunder');
      return icoSvg('cloud');
    };
    const container = els.forecastStrip;
    if (!container) return;
    startLoading();
    if (!quiet) showToast('Loading 7-day forecast...');
    try {
      const q = (city && city.trim()) || currentCityQuery();
      let om = await fetchOpenMeteo(q);
      // Fallback: geocode via OWM then Open-Meteo by coords
      if (!om) {
        const g = await geocode(q);
        if (g) om = await fetchOpenMeteoByCoords(g.lat, g.lon);
      }
      let days = [];
      if (om?.__om_daily?.time) {
        const t = om.__om_daily;
        days = t.time.slice(0,7).map((d, i) => ({
          day: new Date(d).toLocaleDateString(undefined,{weekday:'short'}),
          max: Math.round(t.temperature_2m_max[i]),
          min: Math.round(t.temperature_2m_min[i]),
          pop: t.precipitation_probability_max ? Math.round(t.precipitation_probability_max[i]||0) : null,
          icon: t.weathercode ? ico(t.weathercode[i]) : icoSvg('cloud')
        }));
      }
      container.innerHTML = days.length
        ? days.map(d => `<div class=\"forecast-card\"><div class=\"day\">${d.day}</div><div class=\"ico\">${d.icon}</div><div class=\"t\">${d.max}° / ${d.min}°</div><div class=\"pop\">${d.pop!=null? d.pop+'%':''}</div></div>`).join('')
        : `<div class=\"forecast-card\"><div class=\"day\">N/A</div><div class=\"t\">Forecast unavailable</div></div>`;
      els.forecastSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (!quiet) { if (days.length) showToast('7-day forecast loaded'); else showToast('7-day forecast unavailable'); }
    } catch (e) {
      container.innerHTML = `<div class=\"forecast-card\"><div class=\"day\">N/A</div><div class=\"t\">Error loading forecast</div></div>`;
      if (!quiet) showToast('Error loading 7-day forecast');
    } finally { stopLoading(); }
  }

  async function init() {
    // Theme boot
    setTheme(themePref);
    if (themePref === 'system' && window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => setTheme('system'));
    }

    wireCityClicks();
    wireTopButtons();
    wireSlider();
    wireParallax();
    wireSubnav();
    els.forecastBtn?.addEventListener('click', () => renderSevenDay(undefined, false));

    // Data source tooltip
    const toggleTip = (show) => { if (!els.dsTooltip) return; els.dsTooltip.hidden = !show; };
    els.dsInfoBtn?.addEventListener('click', (e) => { e.stopPropagation(); toggleTip(els.dsTooltip.hidden); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.data-source')) toggleTip(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleTip(false); });

    // Restore debug panel on boot
    const showDbg = localStorage.getItem('debug_show') === '1';
    const dbgPanelBoot = document.getElementById('debugPanel'); if (dbgPanelBoot) dbgPanelBoot.hidden = !showDbg;

    renderFavorites();

    let cityFromStorage = localStorage.getItem('lastCity');
    if (!cityFromStorage || /new\s*york/i.test(cityFromStorage)) {
      cityFromStorage = DEFAULT_CITY;
      localStorage.setItem('lastCity', cityFromStorage);
    }
    refreshMain(cityFromStorage);
    refreshMiniCards();
    refreshCityListTemps();
    // Render 7-day for default city silently
    renderSevenDay(undefined, true);

    // Typeahead suggestions on input (debounced)
    let tHandle;
    const renderSuggestions = (items) => {
      const box = els.suggestions;
      if (!box) return;
      if (!items || !items.length) { box.hidden = true; box.innerHTML = ''; return; }
      box.innerHTML = items.map((x,i) => `<div class=\"item\" data-city=\"${x.name}${x.state? ', '+x.state:''}${x.country? ', '+x.country:''}\">`+
        `<span>${x.name}${x.state? ', '+x.state:''}</span><small>${x.country || ''}</small></div>`).join('');
      box.hidden = false;
    };
    const fetchSuggestions = async (q) => {
      if (!q) { renderSuggestions([]); return; }
      try {
        const bias = /,/.test(q) ? q : `${q},IN`;
const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(bias)}&limit=5&appid=${apiKey()}`;
        const res = await fetch(url);
        if (!res.ok) { renderSuggestions([]); return; }
        const data = await res.json();
        renderSuggestions(data);
      } catch { renderSuggestions([]); }
    };
    els.searchInput?.addEventListener('input', () => { clearTimeout(tHandle); tHandle = setTimeout(() => fetchSuggestions(els.searchInput.value.trim()), 250); });
    els.suggestions?.addEventListener('click', (e) => {
      const item = e.target.closest('.item');
      if (!item) return;
      const city = item.getAttribute('data-city');
      els.searchInput.value = city;
      els.suggestions.hidden = true;
      els.searchForm.dispatchEvent(new Event('submit')); // trigger search
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.search')) { if (els.suggestions) els.suggestions.hidden = true; }});

    // keyboard navigation
    els.searchInput?.addEventListener('keydown', (e) => {
      if (!['ArrowDown','ArrowUp','Enter','Escape'].includes(e.key)) return;
      const items = Array.from(els.suggestions?.querySelectorAll('.item') || []);
      if (e.key === 'Escape') { els.suggestions.hidden = true; return; }
      if (!items.length) return;
      const current = els.suggestions.querySelector('.item.active');
      let idx = items.indexOf(current);
      if (e.key === 'ArrowDown') idx = Math.min(idx + 1, items.length - 1);
      if (e.key === 'ArrowUp') idx = Math.max(idx - 1, 0);
      if (e.key === 'Enter') { if (current) current.click(); return; }
      items.forEach(it => it.classList.remove('active'));
      items[idx]?.classList.add('active');
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
