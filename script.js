/* ==========================================================================
   WANNA_CRY PROPAGATION SIMULATOR - LOGIC ENGINE
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    
    // --- 1. CONFIGURACIÓN DE PESTAÑAS (TABS) ---
    const tabs = document.querySelectorAll(".nav-tab");
    const tabContents = document.querySelectorAll(".tab-content");

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tabContents.forEach(c => c.classList.remove("active"));

            tab.classList.add("active");
            const activeTabContent = document.getElementById(tab.dataset.tab);
            activeTabContent.classList.add("active");
            
            // Redibujar gráficos de Chart.js si se cambia de pestaña para evitar fallos de renderizado
            if (tab.dataset.tab === "simulator-tab") {
                if (propagationChart) propagationChart.resize();
            } else if (tab.dataset.tab === "math-tab") {
                if (solverChart) solverChart.resize();
            }
        });
    });

    // --- 2. RELOJ DIGITAL Y ESTADO GLOBAL ---
    const clockElement = document.getElementById("digital-clock");
    
    function updateClock() {
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const secs = String(now.getSeconds()).padStart(2, '0');
        const ms = String(Math.floor(now.getMilliseconds() / 10)).padStart(2, '0');
        clockElement.textContent = `${hrs}:${mins}:${secs}:${ms}`;
    }
    setInterval(updateClock, 10);


    // --- 3. PARAMETROS Y ELEMENTOS DEL SIMULADOR ---
    const paramNodes = document.getElementById("param-nodes");
    const paramK = document.getElementById("param-k");
    const paramP0 = document.getElementById("param-p0");
    const paramSpeed = document.getElementById("param-speed");
    const toggleLogistic = document.getElementById("toggle-logistic");
    
    const valNodes = document.getElementById("val-nodes");
    const valK = document.getElementById("val-k");
    const valP0 = document.getElementById("val-p0");
    const valSpeed = document.getElementById("val-speed");

    const btnStart = document.getElementById("btn-start");
    const btnReset = document.getElementById("btn-reset");
    const btnKillswitch = document.getElementById("btn-killswitch");

    const metricHealthy = document.getElementById("metric-healthy");
    const metricInfected = document.getElementById("metric-infected");
    const metricEncrypted = document.getElementById("metric-encrypted");
    const metricPatched = document.getElementById("metric-patched");

    const terminalOutput = document.getElementById("terminal-output");
    const globalStatus = document.getElementById("global-status");

    // Sincronizar valores de inputs con etiquetas
    paramNodes.addEventListener("input", () => valNodes.textContent = paramNodes.value);
    paramK.addEventListener("input", () => valK.textContent = paramK.value);
    paramP0.addEventListener("input", () => valP0.textContent = paramP0.value);
    paramSpeed.addEventListener("input", () => valSpeed.textContent = paramSpeed.value + "x");

    // --- 4. CONFIGURACIÓN DEL CANVAS (RED DE NODOS) ---
    const canvas = document.getElementById("network-canvas");
    const ctx = canvas.getContext("2d");

    // Ajustar resolución del canvas
    function resizeCanvas() {
        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight - 40; // Restar margen del título
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Clase Nodo para representar cada computadora en la red
    class Node {
        constructor(id, x, y) {
            this.id = id;
            this.anchorX = x; // Posición de anclaje para flotación orgánica
            this.anchorY = y;
            this.x = x;
            this.y = y;
            this.vx = (Math.random() - 0.5) * 0.4;
            this.vy = (Math.random() - 0.5) * 0.4;
            this.radius = 5;
            
            // Estados posibles: 'healthy', 'infected', 'encrypted', 'patched'
            this.status = 'healthy';
            this.infectionTime = 0; // Para el retardo de encriptación
            this.connections = [];
        }

        update(speed) {
            // Movimiento flotante limitado alrededor de su ancla
            this.x += this.vx * speed;
            this.y += this.vy * speed;

            const distFromAnchor = Math.hypot(this.x - this.anchorX, this.y - this.anchorY);
            if (distFromAnchor > 25) {
                // Volver suavemente al ancla
                this.vx += (this.anchorX - this.x) * 0.005;
                this.vy += (this.anchorY - this.y) * 0.005;
            }

            // Pequeña fuerza aleatoria para naturalidad
            this.vx += (Math.random() - 0.5) * 0.05;
            this.vy += (Math.random() - 0.5) * 0.05;

            // Limitar velocidad máxima
            const maxSpeed = 1.0;
            const currentSpeed = Math.hypot(this.vx, this.vy);
            if (currentSpeed > maxSpeed) {
                this.vx = (this.vx / currentSpeed) * maxSpeed;
                this.vy = (this.vy / currentSpeed) * maxSpeed;
            }
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            
            if (this.status === 'healthy') {
                ctx.fillStyle = '#00e5ff'; // Cian
                ctx.shadowColor = '#00e5ff';
                ctx.shadowBlur = 4;
            } else if (this.status === 'infected') {
                ctx.fillStyle = '#ff0055'; // Rojo neón
                ctx.shadowColor = '#ff0055';
                ctx.shadowBlur = 10;
            } else if (this.status === 'encrypted') {
                ctx.fillStyle = '#f43f5e'; // Magenta oscuro cifrado
                ctx.shadowColor = '#f43f5e';
                ctx.shadowBlur = 4;
            } else if (this.status === 'patched') {
                ctx.fillStyle = '#00ff66'; // Verde neón
                ctx.shadowColor = '#00ff66';
                ctx.shadowBlur = 8;
            }
            
            ctx.fill();
            ctx.shadowBlur = 0; // Resetear sombra para mejorar rendimiento
        }
    }

    let nodeList = [];
    
    // Generar red de nodos conectados
    function generateNetwork(totalNodes) {
        nodeList = [];
        const cols = Math.ceil(Math.sqrt(totalNodes * (canvas.width / canvas.height)));
        const rows = Math.ceil(totalNodes / cols);
        
        const cellWidth = canvas.width / cols;
        const cellHeight = canvas.height / rows;

        // Crear los nodos distribuidos
        for (let i = 0; i < totalNodes; i++) {
            const r = Math.floor(i / cols);
            const c = i % cols;
            
            // Añadir aleatoriedad en la posición de inicio dentro de su celda grid
            const x = cellWidth * (c + 0.3 + Math.random() * 0.4);
            const y = cellHeight * (r + 0.3 + Math.random() * 0.4);
            
            nodeList.push(new Node(i, x, y));
        }

        // Crear conexiones (enlaces lógicos de red) basadas en proximidad
        for (let i = 0; i < nodeList.length; i++) {
            const nodeA = nodeList[i];
            
            // Buscar vecinos más cercanos
            let candidates = [];
            for (let j = 0; j < nodeList.length; j++) {
                if (i === j) continue;
                const nodeB = nodeList[j];
                const dist = Math.hypot(nodeA.x - nodeB.x, nodeA.y - nodeB.y);
                candidates.push({ index: j, dist: dist });
            }
            
            // Ordenar por distancia corta
            candidates.sort((a, b) => a.dist - b.dist);
            
            // Conectar con los 2 o 3 más cercanos para formar un grafo conexo
            const connectionsCount = Math.floor(Math.random() * 2) + 2; // 2 a 3 enlaces
            for (let k = 0; k < connectionsCount; k++) {
                if (k < candidates.length) {
                    const targetIndex = candidates[k].index;
                    if (!nodeA.connections.includes(targetIndex)) {
                        nodeA.connections.push(targetIndex);
                        // Asegurar bidireccionalidad
                        if (!nodeList[targetIndex].connections.includes(i)) {
                            nodeList[targetIndex].connections.push(i);
                        }
                    }
                }
            }
        }
    }

    // Dibujar los enlaces de la red
    function drawNetworkConnections() {
        ctx.lineWidth = 0.5;
        for (let i = 0; i < nodeList.length; i++) {
            const nodeA = nodeList[i];
            for (const neighborIndex of nodeA.connections) {
                if (neighborIndex > i) { // Evitar duplicar dibujo
                    const nodeB = nodeList[neighborIndex];
                    ctx.beginPath();
                    ctx.moveTo(nodeA.x, nodeA.y);
                    ctx.lineTo(nodeB.x, nodeB.y);
                    
                    // Estilo de enlace basado en estados de nodos
                    if (nodeA.status === 'patched' || nodeB.status === 'patched') {
                        ctx.strokeStyle = 'rgba(0, 255, 102, 0.15)'; // Enlace protegido (verde)
                    } else if (nodeA.status === 'infected' || nodeB.status === 'infected' || 
                               nodeA.status === 'encrypted' || nodeB.status === 'encrypted') {
                        ctx.strokeStyle = 'rgba(255, 0, 85, 0.25)'; // Enlace peligroso (rojo)
                    } else {
                        ctx.strokeStyle = 'rgba(0, 229, 255, 0.1)'; // Enlace por defecto (cian)
                    }
                    ctx.stroke();
                }
            }
        }
    }

    // --- 5. LOG DE EVENTOS EN TERMINAL ---
    function logEvent(message, type = 'info') {
        const timeStr = clockElement.textContent;
        const line = document.createElement("div");
        line.className = "terminal-line";
        
        if (type === 'error') {
            line.classList.add("text-red");
            line.innerHTML = `[${timeStr}] <i class="fa-solid fa-triangle-exclamation"></i> ERROR: ${message}`;
        } else if (type === 'success') {
            line.classList.add("text-green");
            line.innerHTML = `[${timeStr}] <i class="fa-solid fa-circle-check"></i> SUCCESS: ${message}`;
        } else if (type === 'warning') {
            line.classList.add("text-yellow");
            line.innerHTML = `[${timeStr}] <i class="fa-solid fa-triangle-exclamation"></i> WARN: ${message}`;
        } else {
            line.classList.add("text-cyan");
            line.innerHTML = `[${timeStr}] &gt; ${message}`;
        }
        
        terminalOutput.appendChild(line);
        terminalOutput.scrollTop = terminalOutput.scrollHeight; // Auto-scroll
        
        // Limitar número máximo de líneas para rendimiento
        if (terminalOutput.childNodes.length > 50) {
            terminalOutput.removeChild(terminalOutput.firstChild);
        }
    }

    // --- 6. GRAFICO DE PROPAGACIÓN EN TIEMPO REAL (CHART.JS) ---
    const chartCtx = document.getElementById("propagation-chart").getContext("2d");
    let propagationChart;

    function initChart() {
        if (propagationChart) propagationChart.destroy();
        
        propagationChart = new Chart(chartCtx, {
            type: 'line',
            data: {
                labels: [0],
                datasets: [
                    {
                        label: 'Infectados Simulados (Canvas)',
                        data: [0],
                        borderColor: '#ff0055',
                        backgroundColor: 'rgba(255, 0, 85, 0.05)',
                        borderWidth: 2,
                        tension: 0.3,
                        pointRadius: 0
                    },
                    {
                        label: 'Modelo Matemático (Teórico)',
                        data: [0],
                        borderColor: '#ffaa00',
                        borderDash: [5, 5],
                        backgroundColor: 'transparent',
                        borderWidth: 1.5,
                        tension: 0.3,
                        pointRadius: 0
                    },
                    {
                        label: 'Nodos Inmunizados (Patched)',
                        data: [0],
                        borderColor: '#00ff66',
                        backgroundColor: 'transparent',
                        borderWidth: 1.5,
                        tension: 0.3,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#7d8b9e',
                            font: { family: 'Share Tech Mono', size: 11 }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(0, 229, 255, 0.05)' },
                        ticks: { color: '#7d8b9e', font: { family: 'Share Tech Mono' } },
                        title: { display: true, text: 'Tiempo (Ciclos)', color: '#7d8b9e' }
                    },
                    y: {
                        grid: { color: 'rgba(0, 229, 255, 0.05)' },
                        ticks: { color: '#7d8b9e', font: { family: 'Share Tech Mono' } },
                        title: { display: true, text: 'Nodos', color: '#7d8b9e' },
                        min: 0
                    }
                }
            }
        });
    }

    // --- 7. ESTADO DE SIMULACIÓN Y BUCLE PRINCIPAL ---
    let isRunning = false;
    let simTime = 0;
    let initialInfected = 1;
    let totalNodes = 200;
    let kValue = 0.12;
    let killswitchActive = false;
    let loggedMilestones = {}; // Evitar duplicar mensajes del log

    function resetSimulation() {
        isRunning = false;
        simTime = 0;
        killswitchActive = false;
        loggedMilestones = {};
        
        btnStart.innerHTML = `<i class="fa-solid fa-play"></i> INICIAR`;
        btnStart.className = "btn btn-green";
        btnKillswitch.disabled = true;
        btnKillswitch.classList.remove("pulse-effect");
        
        globalStatus.textContent = "ONLINE";
        globalStatus.className = "status-value text-green";

        totalNodes = parseInt(paramNodes.value);
        kValue = parseFloat(paramK.value);
        initialInfected = parseInt(paramP0.value);
        
        // Regenerar Red y Gráfico
        generateNetwork(totalNodes);
        initChart();
        
        // Limpiar consola
        terminalOutput.innerHTML = "";
        logEvent("WANNA_CRY SIMULATOR REINICIALIZADO. Red lista.");
        logEvent(`Parámetros: Nodos Totales (L)=${totalNodes}, k=${kValue}, Infección Inicial (P0)=${initialInfected}`);
        
        // Actualizar Métricas iniciales
        updateMetrics();
    }

    function updateMetrics() {
        let healthy = 0;
        let infected = 0;
        let encrypted = 0;
        let patched = 0;

        nodeList.forEach(n => {
            if (n.status === 'healthy') healthy++;
            else if (n.status === 'infected') infected++;
            else if (n.status === 'encrypted') encrypted++;
            else if (n.status === 'patched') patched++;
        });

        metricHealthy.textContent = healthy;
        metricInfected.textContent = infected;
        metricEncrypted.textContent = encrypted;
        metricPatched.textContent = patched;

        return { healthy, infected, encrypted, patched };
    }

    function infectNode(node) {
        if (node.status === 'healthy') {
            node.status = 'infected';
            node.infectionTime = simTime;
        }
    }

    function runSimulationStep() {
        if (!isRunning) return;

        const speed = parseFloat(paramSpeed.value);
        simTime += 0.05 * speed; // Aumentar tiempo según la velocidad
        
        const currentIntTime = Math.floor(simTime);
        
        // --- 1. LÓGICA DE ECUACIONES DIFERENCIALES ---
        let mathInfected = 0;
        
        if (killswitchActive) {
            // El Killswitch congela el avance del virus
            mathInfected = Math.min(totalNodes, parseFloat(propagationChart.data.datasets[1].data.slice(-1)[0] || initialInfected));
        } else {
            if (toggleLogistic.checked) {
                // Modelo Logístico: P(t) = L / (1 + ((L - P0) / P0) * e^(-k*t))
                const expTerm = Math.exp(-kValue * simTime);
                const denominator = 1 + ((totalNodes - initialInfected) / initialInfected) * expTerm;
                mathInfected = totalNodes / denominator;
            } else {
                // Modelo Exponencial: P(t) = P0 * e^(k*t)
                mathInfected = initialInfected * Math.exp(kValue * simTime);
            }
        }

        // --- 2. TRANSMISIÓN DE INFECCIÓN Y TRANSICIONES EN CANVAS ---
        // Contar infectados actuales para control
        let currentMetrics = updateMetrics();
        let totalActiveInfected = currentMetrics.infected + currentMetrics.encrypted;
        
        // Infectar más nodos si el modelo matemático va adelante
        const targetInfected = Math.min(totalNodes, Math.floor(mathInfected));
        
        if (totalActiveInfected < targetInfected && !killswitchActive) {
            // Intentar infectar vecinos de los ya infectados primero (simulación de red real)
            let infectedN = nodeList.filter(n => n.status === 'infected' || n.status === 'encrypted');
            
            if (infectedN.length > 0) {
                let neighborsToInfect = [];
                infectedN.forEach(infNode => {
                    infNode.connections.forEach(connIdx => {
                        let neighbor = nodeList[connIdx];
                        if (neighbor.status === 'healthy') {
                            neighborsToInfect.push(neighbor);
                        }
                    });
                });
                
                // Si hay vecinos candidatos, infectar algunos según probabilidad vinculada a k
                if (neighborsToInfect.length > 0) {
                    neighborsToInfect.forEach(neigh => {
                        if (Math.random() < kValue * speed && totalActiveInfected < targetInfected) {
                            infectNode(neigh);
                            totalActiveInfected++;
                        }
                    });
                }
            }

            // Si aún no alcanzamos la cuota teórica (o al inicio sin infectados activos), infectamos aleatorios
            while (totalActiveInfected < targetInfected) {
                let healthyNodes = nodeList.filter(n => n.status === 'healthy');
                if (healthyNodes.length === 0) break;
                let randomNode = healthyNodes[Math.floor(Math.random() * healthyNodes.length)];
                infectNode(randomNode);
                totalActiveInfected++;
            }
        }

        // Retardo para Encriptación (Fase 3 del Storytelling)
        // Tras 3 segundos de infección, el malware cifra los archivos
        nodeList.forEach(node => {
            if (node.status === 'infected' && (simTime - node.infectionTime) > 3.0) {
                node.status = 'encrypted';
                logEvent(`Nodo ID_${node.id} CIFRADO. Archivos bloqueados. Exigiendo rescate.`, 'error');
            }
        });

        // --- 3. LÓGICA DE INMUNIZACIÓN (SI EL KILLSWITCH ESTÁ ACTIVO) ---
        if (killswitchActive) {
            // Los nodos saludables se vuelven inmunes por parches de seguridad (azul -> verde)
            // Se propaga el parche a un ritmo rápido
            let patchedCountThisStep = 0;
            nodeList.forEach(node => {
                if (node.status === 'healthy' && Math.random() < 0.15 * speed) {
                    node.status = 'patched';
                    patchedCountThisStep++;
                }
            });
            if (patchedCountThisStep > 0 && !loggedMilestones['immunize_progress']) {
                logEvent("Parche de seguridad MS17-010 distribuyéndose. Inmunizando nodos saludables.");
                loggedMilestones['immunize_progress'] = true;
            }
        }

        // --- 4. REGISTRO HISTÓRICO DE STORYTELLING BASADO EN PASOS ---
        const infectionPercent = (totalActiveInfected / totalNodes) * 100;
        
        if (currentIntTime >= 1 && !loggedMilestones['scan']) {
            logEvent("Infiltración: Escaneo automático de puertos tcp/445 activo en la subred.", 'info');
            loggedMilestones['scan'] = true;
        }
        if (currentIntTime >= 4 && !loggedMilestones['exploit']) {
            logEvent("Propagación: Explotación exitosa mediante EternalBlue (MS17-010).", 'warning');
            loggedMilestones['exploit'] = true;
        }
        if (currentIntTime >= 8 && !loggedMilestones['backdoor']) {
            logEvent("Payload: Puerta trasera DoublePulsar inyectando WannaCry en memoria.", 'warning');
            loggedMilestones['backdoor'] = true;
            // Permitir activar el Killswitch
            btnKillswitch.disabled = false;
            btnKillswitch.classList.add("pulse-effect");
        }
        if (infectionPercent >= 25 && !loggedMilestones['25pct']) {
            logEvent("CRÍTICO: 25% de la infraestructura de red ha sido comprometida.", 'error');
            loggedMilestones['25pct'] = true;
        }
        if (infectionPercent >= 50 && !loggedMilestones['50pct']) {
            logEvent("PANDEMIA DE RED: 50% de los hosts no responden. Sistemas de salud británicos (NHS) caídos.", 'error');
            loggedMilestones['50pct'] = true;
        }
        if (infectionPercent >= 90 && !loggedMilestones['90pct']) {
            logEvent("COLAPSO: Red saturada al 90%. Apagando servidores principales.", 'error');
            loggedMilestones['90pct'] = true;
        }

        // --- 5. ACTUALIZAR GRÁFICA DE PROPAGACIÓN ---
        currentMetrics = updateMetrics();
        const stepLabel = Math.floor(simTime * 10) / 10;
        
        // Para evitar acumular millones de puntos
        if (propagationChart.data.labels.length < 150) {
            propagationChart.data.labels.push(stepLabel);
            propagationChart.data.datasets[0].data.push(currentMetrics.infected + currentMetrics.encrypted);
            propagationChart.data.datasets[1].data.push(Math.min(totalNodes, Math.floor(mathInfected)));
            propagationChart.data.datasets[2].data.push(currentMetrics.patched);
            propagationChart.update('none'); // Update sin animación para optimizar rendimiento
        }
    }

    // Loop de animación
    function animationLoop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const speed = parseFloat(paramSpeed.value);
        
        // Dibujar y actualizar red
        drawNetworkConnections();
        nodeList.forEach(node => {
            node.update(speed);
            node.draw();
        });

        // Correr paso lógico de simulación
        runSimulationStep();

        requestAnimationFrame(animationLoop);
    }

    // Botones de interacción
    btnStart.addEventListener("click", () => {
        if (!isRunning) {
            isRunning = true;
            btnStart.innerHTML = `<i class="fa-solid fa-pause"></i> PAUSAR`;
            btnStart.className = "btn btn-cyan";
            globalStatus.textContent = "SIMULATION RUNNING";
            globalStatus.className = "status-value text-yellow blink";
            logEvent("Simulación iniciada...");
        } else {
            isRunning = false;
            btnStart.innerHTML = `<i class="fa-solid fa-play"></i> REANUDAR`;
            btnStart.className = "btn btn-green";
            globalStatus.textContent = "PAUSED";
            globalStatus.className = "status-value text-yellow";
            logEvent("Simulación pausada.");
        }
    });

    btnReset.addEventListener("click", resetSimulation);

    btnKillswitch.addEventListener("click", () => {
        killswitchActive = true;
        btnKillswitch.disabled = true;
        btnKillswitch.classList.remove("pulse-effect");
        
        globalStatus.textContent = "MITIGATED";
        globalStatus.className = "status-value text-green";

        logEvent("KILLSWITCH ACTIVADO: Registro exitoso del dominio 'iuqerfsodp9ifjaposdfjhgosurijfaewrwergwea.com'.", 'success');
        logEvent("Gusano WannaCry abortando procesos de infección en nuevos sistemas.", 'success');
        
        // Cambiar la tasa de propagación a 0 para detener la teoría exponencial/logística
        kValue = 0;
    });


    // --- 8. CALCULADORA ANALÍTICA (PESTAÑA 2: MODELO MATEMÁTICO) ---
    const solverP0 = document.getElementById("solver-p0");
    const solverK = document.getElementById("solver-k");
    const solverL = document.getElementById("solver-l");
    const solverT = document.getElementById("solver-t");
    const btnCalculate = document.getElementById("btn-calculate");
    
    const resT = document.getElementById("res-t");
    const resExponential = document.getElementById("res-exponential");
    const resLogistic = document.getElementById("res-logistic");
    const solverResultsBox = document.getElementById("solver-results-box");
    
    const solverChartCtx = document.getElementById("solver-chart").getContext("2d");
    let solverChart;

    btnCalculate.addEventListener("click", () => {
        const p0 = parseFloat(solverP0.value);
        const k = parseFloat(solverK.value);
        const L = parseFloat(solverL.value);
        const t = parseFloat(solverT.value);

        if (isNaN(p0) || isNaN(k) || isNaN(L) || isNaN(t)) {
            alert("Por favor, introduce valores numéricos válidos.");
            return;
        }

        // Evaluar las ecuaciones en el punto t
        const expVal = p0 * Math.exp(k * t);
        
        const logExpTerm = Math.exp(-k * t);
        const logVal = L / (1 + ((L - p0) / p0) * logExpTerm);

        // Actualizar interfaz
        resT.textContent = t;
        resExponential.textContent = expVal > 1e6 ? expVal.toExponential(3) : Math.round(expVal);
        resLogistic.textContent = Math.round(logVal);
        solverResultsBox.classList.add("active");

        // Generar datos para el gráfico comparativo en el rango [0, 2t]
        const labels = [];
        const expData = [];
        const logData = [];
        const steps = 50;
        const stepSize = (2 * t) / steps;

        for (let i = 0; i <= steps; i++) {
            const timePoint = i * stepSize;
            labels.push(Math.round(timePoint * 10) / 10);
            
            // Exponencial
            const ev = p0 * Math.exp(k * timePoint);
            expData.push(ev > L * 3 ? null : ev); // Cortar exponencial si vuela muy alto para no aplastar el gráfico lógico
            
            // Logística
            const lv = L / (1 + ((L - p0) / p0) * Math.exp(-k * timePoint));
            logData.push(lv);
        }

        // Dibujar Gráfico del Solver
        if (solverChart) solverChart.destroy();
        solverChart = new Chart(solverChartCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Exponencial P(t)',
                        data: expData,
                        borderColor: '#ff0055',
                        borderWidth: 1.5,
                        fill: false,
                        pointRadius: 0
                    },
                    {
                        label: 'Logística P(t)',
                        data: logData,
                        borderColor: '#00e5ff',
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#7d8b9e', font: { family: 'Share Tech Mono', size: 9 } }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(0, 229, 255, 0.05)' },
                        ticks: { color: '#7d8b9e', font: { family: 'Share Tech Mono', size: 9 } }
                    },
                    y: {
                        grid: { color: 'rgba(0, 229, 255, 0.05)' },
                        ticks: { color: '#7d8b9e', font: { family: 'Share Tech Mono', size: 9 } },
                        max: L * 1.2
                    }
                }
            }
        });
    });


    // --- 9. INICIALIZACIÓN ---
    resetSimulation();
    animationLoop(); // Iniciar animación del canvas
});
