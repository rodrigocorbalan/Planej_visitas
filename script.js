// --- INÍCIO DO SCRIPT.JS COM MELHORIAS VISUAIS ---

// --- CONFIGURAÇÃO INICIAL E VARIÁVEIS GLOBAIS ---
const map = L.map('map').setView([-23.665, -46.532], 10);
let routeLayer, startMarker;
let markersLayer = L.featureGroup().addTo(map);
let validatedStartPoint = null;
let currentTileLayer = null; // Variável para controlar a camada do mapa
let dailyPlans = []; // Variável global para armazenar os planos diários

// --- ELEMENTOS DA PÁGINA ---
const startInput = document.getElementById('start');
const startFeedback = document.getElementById('start-feedback');
const serviceTimeInput = document.getElementById('service-time');
const workHoursInput = document.getElementById('work-hours');
const lunchHoursInput = document.getElementById('lunch-hours');
const startDateInput = document.getElementById('start-date');
const algorithmSelect = document.getElementById('routing-algorithm');
const calculateBtn = document.getElementById('calculate-btn');
const newWaypointInput = document.getElementById('new-waypoint-input');
const addWaypointBtn = document.getElementById('add-waypoint-btn');
const waypointsList = document.getElementById('waypoints-list');
const loadTestBtn = document.getElementById('load-test-btn');
const fuelConsumptionInput = document.getElementById('fuel-consumption');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const saveRouteBtn = document.getElementById('save-route-btn');
const loadRouteBtn = document.getElementById('load-route-btn');
const exportPdfBtn = document.getElementById('export-pdf-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn'); // Botão de tela cheia
const mapLegend = document.getElementById('map-legend'); // Elemento da legenda do mapa


// --- EVENT LISTENERS ---
startInput.addEventListener('blur', validateStartPoint);
loadTestBtn.addEventListener('click', loadTestData);
addWaypointBtn.addEventListener('click', addWaypointFromInput);
newWaypointInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addWaypointFromInput();
    }
});
calculateBtn.addEventListener('click', calculateRoute);
themeToggleBtn.addEventListener('click', toggleTheme);
saveRouteBtn.addEventListener('click', saveRoute);
loadRouteBtn.addEventListener('click', loadRoute);
exportPdfBtn.addEventListener('click', exportResultsToPdf);
fullscreenBtn.addEventListener('click', toggleFullscreen); // Listener para o botão de tela cheia


// --- INICIALIZAÇÃO ---
window.onload = function() {
    const today = new Date();
    startDateInput.value = today.toISOString().substring(0, 10);
    
    new Sortable(waypointsList, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        handle: '.drag-handle',
    });

    // Aplica o tema correto ao carregar a página
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
    }
    updateMapTheme(); // Aplica o tema do mapa

    if (localStorage.getItem('savedRouteData')) {
        loadRouteBtn.disabled = false;
    }

    // Listener para detectar quando o modo de tela cheia é desativado pelo navegador (ex: tecla ESC)
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            document.body.classList.remove('fullscreen-map');
            map.invalidateSize(); // Redimensiona o mapa para o tamanho normal
            fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>'; // Altera o ícone de volta para expandir
        }
    });
};

// Função para alternar o modo de tela cheia do mapa
function toggleFullscreen() {
    const mapSection = document.getElementById('map-section');
    if (!document.fullscreenElement) {
        // Entra em tela cheia
        if (mapSection.requestFullscreen) {
            mapSection.requestFullscreen();
        } else if (mapSection.mozRequestFullScreen) { /* Firefox */
            mapSection.mozRequestFullScreen();
        } else if (mapSection.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
            mapSection.webkitRequestFullscreen();
        } else if (mapSection.msRequestFullscreen) { /* IE/Edge */
            mapSection.msRequestFullscreen();
        }
        document.body.classList.add('fullscreen-map');
        fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>'; // Altera o ícone para comprimir
    } else {
        // Sai da tela cheia
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.mozCancelFullScreen) { /* Firefox */
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) { /* Chrome, Safari & Opera */
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { /* IE/Edge */
            document.msExitFullscreen();
        }
        document.body.classList.remove('fullscreen-map');
        fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>'; // Altera o ícone de volta para expandir
    }
    // Invalida o tamanho do mapa para que ele se ajuste corretamente
    setTimeout(() => {
        map.invalidateSize();
    }, 100); // Pequeno atraso para garantir que a transição de CSS ocorra
}


// --- LÓGICA DE TEMA ---
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    
    let theme = 'light';
    if (document.body.classList.contains('dark-mode')) {
        theme = 'dark';
        themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
    }
    localStorage.setItem('theme', theme);
    updateMapTheme(); // Troca o tema do mapa
}

// Função para atualizar a camada do mapa com base no tema
function updateMapTheme() {
    if (currentTileLayer) {
        map.removeLayer(currentTileLayer);
    }

    let tileUrl, tileAttribution;

    if (document.body.classList.contains('dark-mode')) {
        // Tema escuro da CartoDB
        tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
        tileAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
    } else {
        // Tema claro padrão do OpenStreetMap
        tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        tileAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    }

    currentTileLayer = L.tileLayer(tileUrl, {
        attribution: tileAttribution
    }).addTo(map);
}


// --- LÓGICA PARA GUARDAR E CARREGAR ROTA ---
function saveRoute() {
    if (!validatedStartPoint) {
        alert('Por favor, valide um ponto de partida antes de guardar.');
        return;
    }

    const waypoints = Array.from(waypointsList.querySelectorAll('li')).map(li => ({
        lat: li.dataset.lat,
        lon: li.dataset.lon,
        address: li.dataset.address,
        favorite: li.dataset.favorite === 'true' // Salva o status de favorito
    }));

    const routeData = {
        startPoint: validatedStartPoint,
        waypoints: waypoints,
        parameters: {
            startDate: startDateInput.value,
            serviceTime: serviceTimeInput.value,
            workHours: workHoursInput.value,
            lunchHours: lunchHoursInput.value,
            fuelConsumption: fuelConsumptionInput.value,
            algorithm: algorithmSelect.value
        }
    };

    localStorage.setItem('savedRouteData', JSON.stringify(routeData));
    alert('Rota guardada com sucesso!');
    loadRouteBtn.disabled = false;
}

function loadRoute() {
    const savedData = localStorage.getItem('savedRouteData');
    if (!savedData) {
        alert('Nenhuma rota guardada encontrada.');
        return;
    }

    const routeData = JSON.parse(savedData);

    startInput.value = routeData.startPoint.address;
    validateStartPoint();

    const params = routeData.parameters;
    startDateInput.value = params.startDate;
    serviceTimeInput.value = params.serviceTime;
    workHoursInput.value = params.workHours;
    lunchHoursInput.value = params.lunchHours;
    fuelConsumptionInput.value = params.fuelConsumption;
    algorithmSelect.value = params.algorithm;

    waypointsList.innerHTML = '';
    routeData.waypoints.forEach(wp => createWaypointListItem(wp, wp.favorite)); // Passa o status de favorito
    
    alert('Rota carregada com sucesso!');
}

// --- LÓGICA PARA EXPORTAR PDF ---
function exportResultsToPdf() {
    const { jsPDF } = window.jspdf;
    const resultsElement = document.getElementById('results');
    
    const navButtons = resultsElement.querySelectorAll('.nav-buttons');
    navButtons.forEach(btn => btn.style.display = 'flex');

    html2canvas(resultsElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: document.body.classList.contains('dark-mode') ? '#1e1e1e' : '#ffffff'
    }).then(canvas => {
        navButtons.forEach(btn => btn.style.display = 'flex');

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const ratio = canvasWidth / canvasHeight;
        
        const imgWidth = pdfWidth - 20;
        const imgHeight = imgWidth / ratio;

        let position = 10;
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        
        pdf.save('planeamento_de_rota.pdf');
    });
}


// --- FUNÇÕES DE GERENCIAMENTO DE ENDEREÇOS ---

async function addWaypointFromInput() {
    const address = newWaypointInput.value.trim();
    if (!address) return;

    addWaypointBtn.disabled = true;
    addWaypointBtn.textContent = 'A validar...';

    try {
        const location = await geocode(address);
        createWaypointListItem(location); // Novo waypoint não é favorito por padrão
        newWaypointInput.value = '';
    } catch (error) {
        alert(error.message);
    } finally {
        addWaypointBtn.disabled = false;
        addWaypointBtn.textContent = 'Adicionar';
        newWaypointInput.focus();
    }
}

// ATUALIZADO: Adiciona parâmetro isFavorite para criar o item
function createWaypointListItem(location, isFavorite = false) {
    const li = document.createElement('li');
    li.dataset.lat = location.lat;
    li.dataset.lon = location.lon;
    li.dataset.address = location.address;
    li.dataset.favorite = isFavorite; // Define o status de favorito

    li.innerHTML = `
        <span class="drag-handle" title="Arrastar para reordenar"><i class="fas fa-grip-vertical"></i></span>
        <span class="address-text">${location.address}</span>
        <span class="favorite-toggle" title="Marcar como favorito"><i class="fas fa-star"></i></span>
        <span class="remove-btn" title="Remover">×</span>
    `;

    // Adiciona a classe 'active' se for favorito
    const favoriteToggle = li.querySelector('.favorite-toggle');
    if (isFavorite) {
        favoriteToggle.classList.add('active');
    }

    // Listener para alternar o status de favorito
    favoriteToggle.addEventListener('click', () => {
        const currentFavoriteStatus = li.dataset.favorite === 'true';
        li.dataset.favorite = !currentFavoriteStatus;
        favoriteToggle.classList.toggle('active', !currentFavoriteStatus);
    });

    li.querySelector('.remove-btn').addEventListener('click', () => {
        li.remove();
    });

    waypointsList.appendChild(li);
}

async function loadTestData() {
    waypointsList.innerHTML = '';
    const testAddresses = [
        "Avenida Paulista, 1578, São Paulo, SP",
        "Rua Oscar Freire, 827, São Paulo, SP",
        "Avenida Engenheiro Luís Carlos Berrini, 1748, São Paulo, SP",
        "Rua Augusta, 2690, São Paulo, SP",
        "Avenida Brigadeiro Faria Lima, 2232, São Paulo, SP",
        "Rua da Mooca, 3500, São Paulo, SP",
        "Avenida Braz Leme, 1000, São Paulo, SP",
        "Rua Marechal Deodoro, 1800, São Bernardo do Campo, SP",
        "Avenida Goiás, 300, São Caetano do Sul, SP",
        "Avenida Barão de Mauá, 100, Mauá, SP",
        "Avenida Doutor Moraes Salles, 711, Campinas, SP",
        "Avenida Dom Aguirre, 2121, Sorocaba, SP",
        "Avenida Alberto Andaló, 3030, São José do Rio Preto, SP",
        "Avenida Bartolomeu de Gusmão, 100, Santos, SP",
        "Avenida Iperoig, 500, Ubatuba, SP"
    ];
    
    loadTestBtn.disabled = true;
    loadTestBtn.textContent = 'A carregar...';
    
    let successCount = 0;
    let errorCount = 0;

    const delay = ms => new Promise(res => setTimeout(res, ms));

    for (const address of testAddresses) {
        try {
            // Marca alguns endereços de teste como favoritos para demonstração
            const isFavoriteTest = Math.random() < 0.3; // 30% de chance de ser favorito
            const location = await geocode(address);
            createWaypointListItem(location, isFavoriteTest);
            successCount++;
        } catch (e) {
            console.error(`Não foi possível carregar o endereço de teste: ${address}`);
            errorCount++;
        }
        await delay(250);
    }
    
    loadTestBtn.disabled = false;
    loadTestBtn.textContent = 'Teste';

    let alertMessage = `${successCount} de ${testAddresses.length} endereços de teste foram carregados com sucesso.`;
    if (errorCount > 0) {
        alertMessage += `\n${errorCount} endereços falharam ao carregar. Verifique o console para mais detalhes.`;
    }
    alert(alertMessage);
}

async function validateStartPoint() {
    const address = startInput.value.trim();
    startFeedback.textContent = '';
    startFeedback.className = 'feedback-text';
    validatedStartPoint = null;
    if (startMarker) map.removeLayer(startMarker);
    if (!address) return;
    startFeedback.textContent = 'Buscando...';
    try {
        const location = await geocode(address);
        validatedStartPoint = location;
        startFeedback.textContent = `Endereço encontrado!`;
        startFeedback.classList.add('text-success');
        if (startMarker) map.removeLayer(startMarker);
        startMarker = L.marker([location.lat, location.lon]).addTo(map)
            .bindPopup(`<b>Ponto de Partida:</b><br>${location.address}`).openPopup();
        map.setView([location.lat, location.lon], 15);
    } catch (error) {
        startFeedback.textContent = error.message;
        startFeedback.classList.add('text-error');
    }
}

// --- FUNÇÕES AUXILIARES ---
const formatTime = (seconds) => {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}min`;
};

const formatDate = (date) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('pt-BR', options);
};

function getHolidays(year) {
    const holidays = [`${year}-01-01`, `${year}-04-21`, `${year}-05-01`, `${year}-09-07`, `${year}-10-12`, `${year}-11-02`, `${year}-11-15`, `${year}-12-25`];
    return holidays;
}

function generateGoogleMapsUrl(waypoints) {
    if (!waypoints || waypoints.length < 2) return '#';
    const origin = `${waypoints[0].lat},${waypoints[0].lon}`;
    const destination = origin;
    const intermediateWaypoints = waypoints.slice(1).map(wp => `${wp.lat},${wp.lon}`).join('|');
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${intermediateWaypoints}&travelmode=driving`;
}

function generateWazeUrl(waypoint) {
    if (!waypoint) return '#';
    return `https://waze.com/ul?ll=${waypoint.lat},${waypoint.lon}&navigate=yes`;
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`Erro de rede: ${response.status} ${response.statusText}`);
    }
    const clonedResponse = response.clone();
    try {
        return await response.json();
    } catch (e) {
        const text = await clonedResponse.text();
        console.error("Resposta inválida do servidor:", text);
        throw new Error("O serviço de roteirização retornou uma resposta inválida. Tente novamente.");
    }
}

async function getRouteSegment(from, to) {
    const coords = `${from.lon},${from.lat};${to.lon},${to.lat}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    const data = await fetchJson(url);
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error(`Não foi possível calcular o trecho entre ${from.address} e ${to.address}`);
    }
    return data.routes[0];
}

// --- FUNÇÃO PRINCIPAL DE CÁLCULO DE ROTA ---
async function calculateRoute() {
    const resultsPanel = document.getElementById('results');
    const progressContainer = document.getElementById('progress-feedback');

    const updateProgress = (message) => {
        progressContainer.innerHTML = `<div class="spinner"></div><p class="progress-text">${message}</p>`;
        progressContainer.classList.add('active');
    };
    const clearProgress = () => {
        progressContainer.classList.remove('active');
        progressContainer.innerHTML = '';
    };

    // Coleta todos os waypoints e separa favoritos
    let allWaypoints = Array.from(waypointsList.querySelectorAll('li')).map(li => ({
        lat: li.dataset.lat,
        lon: li.dataset.lon,
        address: li.dataset.address,
        favorite: li.dataset.favorite === 'true' // Converte a string para booleano
    }));

    let favoriteWaypoints = allWaypoints.filter(wp => wp.favorite);
    let nonFavoriteWaypoints = allWaypoints.filter(wp => !wp.favorite);

    // Combina os waypoints, priorizando os favoritos
    let prioritizedWaypoints = [...favoriteWaypoints, ...nonFavoriteWaypoints];


    if (!validatedStartPoint || prioritizedWaypoints.length === 0) {
        alert('Por favor, valide o ponto de partida e adicione endereços para visitar.');
        return;
    }
    if (!startDateInput.value) {
        alert('Por favor, selecione uma data de início.');
        return;
    }

    calculateBtn.disabled = true;
    exportPdfBtn.style.display = 'none';
    if (routeLayer) routeLayer.clearLayers();
    if (startMarker) map.removeLayer(startMarker);
    markersLayer.clearLayers();
    mapLegend.innerHTML = ''; // Limpa a legenda antes de cada cálculo
    resultsPanel.innerHTML = '';
    updateProgress('Iniciando o cálculo...');

    const workHoursInSeconds = (parseFloat(workHoursInput.value) || 8) * 3600;
    const lunchHoursInSeconds = (parseFloat(lunchHoursInput.value) || 1) * 3600;
    const serviceTimeInSeconds = (parseFloat(serviceTimeInput.value) || 0) * 3600;
    const algorithm = algorithmSelect.value;
    const fuelConsumption = parseFloat(fuelConsumptionInput.value) || 13.5;

    try {
        let orderedWaypoints = [];

        updateProgress('Passo 1/3: Otimizando a ordem das visitas...');
        switch (algorithm) {
            case 'optimized':
                // Usa a lista priorizada para o OSRM trip service
                const locations = [validatedStartPoint, ...prioritizedWaypoints];
                const coordsString = locations.map(loc => `${loc.lon},${loc.lat}`).join(';');
                const tripUrl = `https://router.project-osrm.org/trip/v1/driving/${coordsString}?source=first&roundtrip=false`;
                const options = {
                    method: 'POST',
                    body: null
                };
                const tripData = await fetchJson(tripUrl, options);
                
                if (tripData.code !== 'Ok') throw new Error('O serviço de roteirização (trip) não conseguiu otimizar a rota.');
                orderedWaypoints = tripData.waypoints.slice(1).map(wp => locations[wp.waypoint_index]);
                break;

            case 'in_order':
                // Usa a lista priorizada diretamente
                orderedWaypoints = [...prioritizedWaypoints];
                break;

            case 'nearest_neighbor':
                // Inicia o algoritmo do vizinho mais próximo com a lista priorizada
                let unvisited = [...prioritizedWaypoints]; 
                let currentPoint = validatedStartPoint;
                const delay = ms => new Promise(res => setTimeout(res, ms));

                orderedWaypoints = []; 
                while (unvisited.length > 0) {
                    let nearest = null;
                    let minDuration = Infinity;
                    
                    for (const point of unvisited) {
                        const route = await getRouteSegment(currentPoint, point);
                        if (route.duration < minDuration) {
                            minDuration = route.duration;
                            nearest = point;
                        }
                        await delay(50);
                    }
                    
                    if (nearest) {
                        orderedWaypoints.push(nearest);
                        currentPoint = nearest;
                        unvisited = unvisited.filter(p => p !== nearest);
                    } else {
                        throw new Error("Não foi possível encontrar o vizinho mais próximo.");
                    }
                }
                break;
        }

        updateProgress('Passo 2/3: Dividindo a rota em dias de trabalho...');
        let currentDate = new Date(startDateInput.value + 'T00:00:00');
        dailyPlans = []; 
        let currentDayPlan = null;
        let holidays = getHolidays(currentDate.getFullYear());

        const startNewDay = (date) => {
            while (true) {
                const dayOfWeek = date.getDay();
                const dateString = date.toISOString().substring(0, 10);
                if (dayOfWeek !== 6 && dayOfWeek !== 0 && !holidays.includes(dateString)) break;
                date.setDate(date.getDate() + 1);
                if (date.getFullYear() !== currentDate.getFullYear()) {
                    holidays.push(...getHolidays(date.getFullYear()));
                }
            }
            return {
                day: (dailyPlans.length + 1),
                date: new Date(date),
                waypoints: [], time: 0, distance: 0, segments: [], lunchTaken: false
            };
        };
        
        currentDayPlan = startNewDay(currentDate);

        for (let i = 0; i < orderedWaypoints.length; i++) {
            const to = orderedWaypoints[i];
            const from = (currentDayPlan.waypoints.length === 0) ? validatedStartPoint : currentDayPlan.waypoints[currentDayPlan.waypoints.length - 1];
            
            const leg = await getRouteSegment(from, to);
            const timeForNextStop = leg.duration + serviceTimeInSeconds;
            const lunchTimeToAdd = (currentDayPlan.time >= workHoursInSeconds / 2 && !currentDayPlan.lunchTaken && lunchHoursInSeconds > 0) ? lunchHoursInSeconds : 0;

            if (currentDayPlan.time + timeForNextStop + lunchTimeToAdd > workHoursInSeconds && currentDayPlan.waypoints.length > 0) {
                const returnToStartLeg = await getRouteSegment(from, validatedStartPoint);
                currentDayPlan.time += returnToStartLeg.duration;
                currentDayPlan.distance += returnToStartLeg.distance;
                currentDayPlan.segments.push({ ...returnToStartLeg, isReturn: true });
                dailyPlans.push(currentDayPlan);

                currentDate.setDate(currentDate.getDate() + 1);
                currentDayPlan = startNewDay(currentDate);

                const newDayStartLeg = await getRouteSegment(validatedStartPoint, to);
                currentDayPlan.waypoints.push(validatedStartPoint);
                currentDayPlan.waypoints.push(to);
                currentDayPlan.segments.push(newDayStartLeg);
                currentDayPlan.time += newDayStartLeg.duration + serviceTimeInSeconds;
                currentDayPlan.distance += newDayStartLeg.distance;
            } else {
                if (currentDayPlan.waypoints.length === 0) {
                    currentDayPlan.waypoints.push(from);
                }
                currentDayPlan.waypoints.push(to);
                currentDayPlan.segments.push(leg);
                currentDayPlan.time += timeForNextStop;
                currentDayPlan.distance += leg.distance;
                
                if (lunchTimeToAdd > 0) {
                    currentDayPlan.time += lunchTimeToAdd;
                    currentDayPlan.lunchTaken = true;
                }
            }
        }

        const lastStop = orderedWaypoints[orderedWaypoints.length - 1];
        const finalReturnLeg = await getRouteSegment(lastStop, validatedStartPoint);
        currentDayPlan.time += finalReturnLeg.duration;
        currentDayPlan.distance += finalReturnLeg.distance;
        currentDayPlan.segments.push({ ...finalReturnLeg, isReturn: true });
        if (currentDayPlan.waypoints.length > 0) dailyPlans.push(currentDayPlan);

        updateProgress('Passo 3/3: Desenhando o mapa e o planeamento...');
        resultsPanel.innerHTML = '';
        if (!routeLayer) routeLayer = L.layerGroup().addTo(map);

        const routeColors = ['#e6194B', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4'];
        let globalStopIndex = 0;
        let grandTotalTime = 0;
        let grandTotalDistance = 0;
        let totalStops = 0; // Contador para o total de paradas

        // Preenche a legenda do mapa
        mapLegend.innerHTML = ''; // Limpa a legenda antes de preencher
        dailyPlans.forEach(plan => {
            const color = routeColors[(plan.day - 1) % routeColors.length];
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            legendItem.innerHTML = `<span class="legend-color-box" style="background-color: ${color}"></span>Dia ${plan.day}`;
            mapLegend.appendChild(legendItem);
        });


        dailyPlans.forEach(plan => {
            let daySummaryHTML = `<div class="day-summary"><h3>Dia ${plan.day} <span>- ${formatDate(plan.date)}</span></h3><ol>`;
            const color = routeColors[(plan.day - 1) % routeColors.length];
            
            plan.segments.forEach((segment, segIndex) => {
                L.geoJSON(segment.geometry, { style: { color, weight: 6, opacity: 0.8 } }).addTo(routeLayer);
                const fromPoint = plan.waypoints[segIndex];
                if (segIndex === 0) {
                    const startIcon = L.divIcon({ html: `<div class="route-marker start-marker"><span>P</span></div>`, className: 'marker-container', iconSize: [30, 40], iconAnchor: [15, 40] });
                    L.marker([fromPoint.lat, fromPoint.lon], { icon: startIcon }).bindPopup(`<b>Partida Dia ${plan.day}</b><br>${fromPoint.address}`).addTo(markersLayer);
                    daySummaryHTML += `<li><span class="color-dot" style="background-color: ${color}"></span>Partida de: ${fromPoint.address}</li>`;
                }
                
                if (!segment.isReturn) {
                    globalStopIndex++;
                    totalStops++; // Incrementa o contador de paradas
                    const stop = plan.waypoints[segIndex + 1];
                    const waypointIcon = L.divIcon({ html: `<div class="route-marker" style="background-color: ${color}"><span>${globalStopIndex}</span></div>`, className: 'marker-container', iconSize: [30, 40], iconAnchor: [15, 40] });
                    L.marker([stop.lat, stop.lon], { icon: waypointIcon }).bindPopup(`<b>Parada ${globalStopIndex}:</b><br>${stop.address}`).addTo(markersLayer);
                    // Adiciona o botão Waze para cada parada
                    daySummaryHTML += `<li><span class="color-dot" style="background-color: ${color}"></span><b>Parada ${globalStopIndex}:</b> ${stop.address} <a href="${generateWazeUrl(stop)}" target="_blank" class="nav-btn waze-btn-inline"><i class="fab fa-waze"></i> Waze</a></li>`;
                }
            });

            daySummaryHTML += `<li><span class="color-dot" style="background-color: ${color}"></span>Retorno para: ${validatedStartPoint.address}</li></ol>`;
            
            const googleMapsUrl = generateGoogleMapsUrl(plan.waypoints);
            const fuelForDay = (plan.distance / 1000) / fuelConsumption;
            
            daySummaryHTML += `<div class="nav-buttons"><a href="${googleMapsUrl}" target="_blank" class="nav-btn google-btn">Abrir no Google Maps</a></div>`;
            daySummaryHTML += `<hr><p><strong>Distância do Dia:</strong> ${(plan.distance / 1000).toFixed(2)} km</p>`;
            daySummaryHTML += `<p><strong>Tempo Total do Dia:</strong> ${formatTime(plan.time)}</p>`;
            daySummaryHTML += `<p><strong>Consumo Estimado:</strong> ${fuelForDay.toFixed(2)} litros</p></div>`;
            resultsPanel.innerHTML += daySummaryHTML;

            grandTotalTime += plan.time;
            grandTotalDistance += plan.distance;
        });
        
        const totalFuel = (grandTotalDistance / 1000) / fuelConsumption;
        const totalDays = dailyPlans.length; // Número total de dias
        const avgStopsPerDay = totalDays > 0 ? (totalStops / totalDays).toFixed(1) : 0; // Média de paradas por dia
        const avgDistancePerDay = totalDays > 0 ? (grandTotalDistance / 1000 / totalDays).toFixed(2) : 0; // Média de distância por dia
        const avgTimePerDay = totalDays > 0 ? formatTime(grandTotalTime / totalDays) : formatTime(0); // Média de tempo por dia

        // NOVO: Layout aprimorado para o resumo final
        resultsPanel.innerHTML += `<div class="grand-total">
            <div class="grand-total-item"><i class="fas fa-route"></i> <p>Distância Total do Projeto: <span>${(grandTotalDistance / 1000).toFixed(2)} km</span></p></div>
            <div class="grand-total-item"><i class="fas fa-clock"></i> <p>Tempo Total de Trabalho: <span>${formatTime(grandTotalTime)}</span></p></div>
            <div class="grand-total-item"><i class="fas fa-gas-pump"></i> <p>Consumo Total Estimado: <span>${totalFuel.toFixed(2)} litros</span></p></div>
            <div class="grand-total-item"><i class="fas fa-calendar-alt"></i> <p>Total de Dias de Rota: <span>${totalDays}</span></p></div>
            <div class="grand-total-item"><i class="fas fa-map-pin"></i> <p>Média de Paradas por Dia: <span>${avgStopsPerDay}</span></p></div>
            <div class="grand-total-item"><i class="fas fa-road"></i> <p>Média de Distância por Dia: <span>${avgDistancePerDay} km</span></p></div>
            <div class="grand-total-item"><i class="fas fa-hourglass-half"></i> <p>Média de Tempo de Trabalho por Dia: <span>${avgTimePerDay}</span></p></div>
        </div>`;
        map.fitBounds(markersLayer.getBounds(), { padding: [50, 50] });
        clearProgress();
        exportPdfBtn.style.display = 'block';

    } catch (error) {
        clearProgress();
        resultsPanel.innerHTML = `<p style="color:red;"><b>Ocorreu um erro na rota:</b> ${error.message}</p>`;
        console.error(error);
    } finally {
        calculateBtn.disabled = false;
    }
}


function isCoordinates(text) {
    const regex = /^-?\d{1,2}(\.\d+)?,\s*-?\d{1,3}(\.\d+)?$/;
    return regex.test(text.trim());
}
const geocode = async (address) => {
    if (isCoordinates(address)) {
        const [lat, lon] = address.split(',').map(Number);
        return { lat, lon, address: `Coordenada (${address})` };
    }
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
    const data = await response.json();
    if (data && data[0]) {
        // Extrai partes relevantes do endereço para um formato mais conciso
        const addressParts = data[0].display_name.split(', ');
        let conciseAddress = '';
        if (addressParts.length > 2) {
            // Tenta pegar rua, número (se houver) e cidade/estado
            conciseAddress = `${addressParts[0]}, ${addressParts[1]}, ${addressParts[addressParts.length - 4]}, ${addressParts[addressParts.length - 2]}`;
        } else {
            // Caso contrário, usa o display_name completo ou as primeiras partes
            conciseAddress = data[0].display_name;
        }
        return { lat: data[0].lat, lon: data[0].lon, address: conciseAddress };
    }
    throw new Error(`Endereço não encontrado: ${address}`);
};
