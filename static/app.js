(() => {
  const headerDate = document.querySelector('#header-date');
  const headerWeather = document.querySelector('.header-weather');

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

  const findBocaPosition = (payload, tournament) => {
    for (const group of payload.children || []) {
      const entry = group.standings?.entries?.find(({ team }) => String(team?.id) === '5');
      if (!entry) continue;
      const stats = Object.fromEntries((entry.stats || []).map((stat) => [stat.name, stat.value]));
      return {
        tournament,
        group: (group.name || '').replace(/^Group\s+/i, 'Grupo '),
        rank: Number(stats.rank || 0),
        points: Number(stats.points || 0)
      };
    }
    return null;
  };

  const updateBoca = async () => {
    const strip = document.querySelector('#boca-strip');
    if (!strip) return;

    const urls = [
      'https://www.thesportsdb.com/api/v1/json/3/eventsnext.php?id=135156',
      'https://site.api.espn.com/apis/v2/sports/soccer/arg.1/standings',
      'https://site.api.espn.com/apis/v2/sports/soccer/conmebol.libertadores/standings'
    ];

    try {
      const results = await Promise.allSettled(
        urls.map(async (url) => {
          const response = await fetch(url, { cache: 'no-store' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
      );
      if (results[0].status !== 'fulfilled') throw results[0].reason;

      const event = results[0].value.events?.[0];
      if (!event) throw new Error('Sin próximos partidos');
      const matchDate = new Date(`${event.strTimestamp}Z`);
      if (Number.isNaN(matchDate.getTime())) throw new Error('Fecha inválida');

      const teams = strip.querySelector('#boca-match-teams');
      teams.append(document.createTextNode(`${event.strHomeTeam} `));
      const versus = document.createElement('i');
      versus.textContent = 'VS';
      teams.append(versus, document.createTextNode(` ${event.strAwayTeam}`));

      const date = strip.querySelector('#boca-match-date');
      date.dateTime = matchDate.toISOString();
      date.textContent = new Intl.DateTimeFormat('es-AR', {
        weekday: 'short', day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit'
      }).format(matchDate).replace(',', '').replaceAll('.', '').toUpperCase();
      strip.querySelector('#boca-match-tournament').textContent = event.strLeague;

      const positions = [
        results[1].status === 'fulfilled' && findBocaPosition(results[1].value, 'Liga Profesional'),
        results[2].status === 'fulfilled' && findBocaPosition(results[2].value, 'Libertadores')
      ].filter(Boolean);
      const container = strip.querySelector('#boca-positions');
      positions.forEach((position) => {
        const item = document.createElement('div');
        const tournament = document.createElement('span');
        tournament.textContent = position.tournament;
        const rank = document.createElement('strong');
        rank.textContent = `${position.rank}°`;
        const detail = document.createElement('small');
        detail.textContent = `${position.group} · ${position.points} PTS`;
        item.append(tournament, rank, detail);
        container.append(item);
      });

      strip.hidden = false;
    } catch (error) {
      console.warn('No se pudo obtener la información de Boca:', error);
    }
  };

  updateDate();
  formatScheduleDates();
  updateBoca();

  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        updateLocalWeather({ latitude: coords.latitude, longitude: coords.longitude });
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  }

})();
