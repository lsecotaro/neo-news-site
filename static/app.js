(() => {
  const headerDate = document.querySelector('#header-date');
  const button = document.querySelector('#refresh-dashboard');
  const content = document.querySelector('#dashboard-content');
  const status = document.querySelector('#refresh-status');
  const updatedAt = document.querySelector('#updated-at');
  const nextUpdateAt = document.querySelector('#next-update-at');
  const headerWeather = document.querySelector('.header-weather');
  let browserCoordinates = null;

  const weatherIcon = (code) => {
    if (code === 0) return '☀';
    if ([1, 2].includes(code)) return '◒';
    if (code === 3) return '☁';
    if ([45, 48].includes(code)) return '≋';
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return '☂';
    if ([71, 73, 75, 85, 86].includes(code)) return '❄';
    if ([95, 96, 99].includes(code)) return 'ϟ';
    return '·';
  };

  const weatherCondition = (code) => {
    if (code === 0) return 'DESPEJADO';
    if (code === 1) return 'MAYORMENTE DESPEJADO';
    if (code === 2) return 'PARCIALMENTE NUBLADO';
    if (code === 3) return 'NUBLADO';
    if ([45, 48].includes(code)) return 'NIEBLA';
    if ([51, 53, 55].includes(code)) return 'LLOVIZNA';
    if ([61, 63, 65, 80, 81, 82].includes(code)) return 'LLUVIA';
    if ([71, 73, 75, 85, 86].includes(code)) return 'NIEVE';
    if ([95, 96, 99].includes(code)) return 'TORMENTA';
    return 'VARIABLE';
  };

  const updateDate = () => {
    if (!headerDate) return;
    const now = new Date();
    headerDate.dateTime = now.toISOString().slice(0, 10);
    headerDate.textContent = new Intl.DateTimeFormat('es-AR', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
    }).format(now).replaceAll('.', '').toUpperCase();
  };

  const formatScheduleDates = () => {
    document.querySelectorAll('[data-local-datetime]').forEach((element) => {
      const value = new Date(element.dataset.localDatetime);
      if (Number.isNaN(value.getTime())) return;
      element.textContent = new Intl.DateTimeFormat('es-AR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      }).format(value).replace(',', ' ·');
    });
  };

  const resolveLocation = async ({ latitude, longitude }) => {
    try {
      const url = new URL('https://apis.datos.gob.ar/georef/api/v2.0/ubicacion');
      url.search = new URLSearchParams({ lat: latitude, lon: longitude });
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { ubicacion = {} } = await response.json();
      const area = ubicacion.municipio?.nombre || ubicacion.departamento?.nombre;
      return [area, ubicacion.provincia?.nombre].filter(Boolean).join(', ') || 'Ubicación actual';
    } catch {
      return 'Ubicación actual';
    }
  };

  const updateLocalWeather = async ({ latitude, longitude }) => {
    if (!headerWeather) return;
    try {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.search = new URLSearchParams({
        latitude,
        longitude,
        timezone: 'auto',
        current: 'temperature_2m,weather_code'
      });
      const [weatherResponse, location] = await Promise.all([
        fetch(url, { cache: 'no-store' }),
        resolveLocation({ latitude, longitude })
      ]);
      if (!weatherResponse.ok) throw new Error(`HTTP ${weatherResponse.status}`);

      const { current } = await weatherResponse.json();
      headerWeather.setAttribute('aria-label', `Clima en ${location}`);
      headerWeather.querySelector('.header-weather-icon').textContent = weatherIcon(current.weather_code);
      headerWeather.querySelector('strong').textContent = `${Math.round(current.temperature_2m)}°`;
      headerWeather.querySelector('.header-weather-condition').textContent = weatherCondition(current.weather_code);
      headerWeather.querySelector('.header-weather-location').textContent = location.toUpperCase();
    } catch (error) {
      console.warn('No se pudo obtener el clima local:', error);
    }
  };

  updateDate();
  formatScheduleDates();

  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        browserCoordinates = { latitude: coords.latitude, longitude: coords.longitude };
        updateLocalWeather(browserCoordinates);
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  }

  if (!button || !content || !status || !updatedAt) return;

  button.addEventListener('click', async () => {
    if (button.disabled) return;

    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = '[ CONECTANDO... ]';
    status.textContent = 'ACTUALIZANDO';
    content.classList.add('is-refreshing');

    try {
      const pageUrl = new URL('index.html', document.baseURI);
      pageUrl.searchParams.set('refresh', Date.now());
      const response = await fetch(pageUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      const nextDocument = new DOMParser().parseFromString(html, 'text/html');
      const nextContent = nextDocument.querySelector('#dashboard-content');
      const nextUpdatedAt = nextDocument.querySelector('#updated-at');
      const nextScheduledAt = nextDocument.querySelector('#next-update-at');
      const nextHeaderWeather = nextDocument.querySelector('.header-weather');
      if (!nextContent || !nextUpdatedAt || !nextScheduledAt) throw new Error('Respuesta incompleta');

      content.innerHTML = nextContent.innerHTML;
      if (headerWeather && nextHeaderWeather) headerWeather.innerHTML = nextHeaderWeather.innerHTML;
      if (browserCoordinates) updateLocalWeather(browserCoordinates);
      updatedAt.textContent = nextUpdatedAt.textContent;
      updatedAt.dataset.localDatetime = nextUpdatedAt.dataset.localDatetime;
      updatedAt.dateTime = nextUpdatedAt.dateTime;
      nextUpdateAt.textContent = nextScheduledAt.textContent;
      nextUpdateAt.dataset.localDatetime = nextScheduledAt.dataset.localDatetime;
      nextUpdateAt.dateTime = nextScheduledAt.dateTime;
      formatScheduleDates();
      status.textContent = 'ACTIVO';
      button.textContent = '[ SEÑAL ACTUALIZADA ]';
      window.setTimeout(() => { button.textContent = originalLabel; }, 1600);
    } catch (error) {
      console.error('No se pudo actualizar Neo News:', error);
      status.textContent = 'ERROR';
      button.textContent = '[ REINTENTAR ]';
    } finally {
      content.classList.remove('is-refreshing');
      button.disabled = false;
    }
  });
})();
