/* ═══════════════════════════════════════════════════════════════════
   PARCHÍS ONLINE — app.js
   Juego multijugador en tiempo real con Firebase Realtime Database
   Tecnologías: HTML5 + CSS3 + JavaScript Vanilla + Firebase v9 compat
   Hosting: GitHub Pages (estático, sin servidor propio)
   ═══════════════════════════════════════════════════════════════════

   SECCIONES:
    1.  Constantes y definición del tablero
    2.  Estado local
    3.  Inicialización de Firebase
    4.  Creación y unión a salas
    5.  Listener de Firebase en tiempo real
    6.  Inicio de partida                      ← app.js parte 2
    7.  Lanzamiento de dados                   ← app.js parte 2
    8.  Validación de movimientos              ← app.js parte 2
    9.  Ejecución de movimientos               ← app.js parte 2
    10. Movimientos de bonus                   ← app.js parte 3
    11. Capturas                               ← app.js parte 3
    12. Gestión de turnos                      ← app.js parte 3
    13. Timer y auto-movimiento                ← app.js parte 3
    14. Detección de ganador                   ← app.js parte 3
    15. Renderizado del tablero                ← app.js parte 4
    16. Renderizado de la interfaz (UI)        ← app.js parte 4
    17. UI de lobby y sala de espera           ← app.js parte 4
    18. Log de eventos                         ← app.js parte 4
    19. Funciones de utilidad                  ← app.js parte 4
    20. Manejadores de eventos (clics de UI)   ← app.js parte 4
    21. Reconexión                             ← app.js parte 4
    22. Inicialización (DOMContentLoaded)      ← app.js parte 4
═══════════════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 1 — CONSTANTES Y DEFINICIÓN DEL TABLERO
   Aquí están TODOS los datos geométricos del tablero.
   Si quieres ajustar casillas, solo modifica estos arreglos.
═══════════════════════════════════════════════════════════════════ */

// ── Configuración del juego ──────────────────────────────────────
const TIMER_SECONDS          = 25;   // Segundos por turno
const CAPTURE_BONUS          = 20;   // Casillas de bonus por comer ficha rival
const GOAL_BONUS             = 10;   // Casillas de bonus por llegar a meta
const MAX_PLAYERS            = 4;
const MIN_PLAYERS            = 2;
const MAX_CONSECUTIVE_DOUBLES = 3;   // Dobles seguidos antes del castigo
const GOAL_PROGRESS          = 57;   // Valor de progress al llegar a meta
const HOME_STRETCH_START     = 52;   // Primer valor de progress del pasillo final
const PATH_LENGTH            = 52;   // Total de casillas en el camino principal
const PIECES_PER_PLAYER      = 4;
const HOME_PROGRESS          = -1;   // Ficha en casa

// Orden de colores (también determina el orden de turno por joinedAt)
const COLOR_ORDER = ['red', 'blue', 'yellow', 'green'];

// Emojis de dado para la UI
const DICE_EMOJI = { 1:'⚀', 2:'⚁', 3:'⚂', 4:'⚃', 5:'⚄', 6:'⚅' };

// ── Las 52 casillas del camino principal (grid 15×15) ────────────
// Formato: {col, row} donde col=0 es izquierda, row=0 es arriba.
// Las fichas recorren estas casillas en orden ascendente de índice.
// El índice en el camino es: (EXIT_CELLS[color] + progress) % 52

const PATH_CELLS = [
  // Brazo OESTE — fila 8, cols 1→5 (desde salida de ROJO hacia el SUR)
  {col:1, row:8},   // 0  ← SALIDA ROJO (casilla segura)
  {col:2, row:8},   // 1
  {col:3, row:8},   // 2
  {col:4, row:8},   // 3
  {col:5, row:8},   // 4
  // Brazo SUR — col 6, filas 9→14
  {col:6, row:9},   // 5
  {col:6, row:10},  // 6
  {col:6, row:11},  // 7
  {col:6, row:12},  // 8
  {col:6, row:13},  // 9
  {col:6, row:14},  // 10
  // Base del brazo SUR — fila 14, cols 7→8
  {col:7, row:14},  // 11  (casilla segura)
  {col:8, row:14},  // 12
  // Brazo SUR lado ESTE — col 8, filas 13→9
  {col:8, row:13},  // 13  ← SALIDA AZUL (casilla segura)
  {col:8, row:12},  // 14
  {col:8, row:11},  // 15
  {col:8, row:10},  // 16
  {col:8, row:9},   // 17
  // Brazo ESTE — fila 8, cols 9→14
  {col:9, row:8},   // 18
  {col:10, row:8},  // 19
  {col:11, row:8},  // 20
  {col:12, row:8},  // 21
  {col:13, row:8},  // 22
  {col:14, row:8},  // 23
  // Esquina ESTE — col 14, filas 7→6
  {col:14, row:7},  // 24  (casilla segura)
  {col:14, row:6},  // 25
  // Brazo NORTE lado ESTE — fila 6, cols 13→9
  {col:13, row:6},  // 26  ← SALIDA AMARILLO (casilla segura)
  {col:12, row:6},  // 27
  {col:11, row:6},  // 28
  {col:10, row:6},  // 29
  {col:9,  row:6},  // 30
  // Brazo NORTE — col 8, filas 5→0
  {col:8, row:5},   // 31
  {col:8, row:4},   // 32
  {col:8, row:3},   // 33
  {col:8, row:2},   // 34
  {col:8, row:1},   // 35
  {col:8, row:0},   // 36
  // Cima del brazo NORTE — fila 0, cols 7→6
  {col:7, row:0},   // 37  (casilla segura)
  {col:6, row:0},   // 38
  // Brazo NORTE lado OESTE — col 6, filas 1→5
  {col:6, row:1},   // 39  ← SALIDA VERDE (casilla segura)
  {col:6, row:2},   // 40
  {col:6, row:3},   // 41
  {col:6, row:4},   // 42
  {col:6, row:5},   // 43
  // Brazo OESTE — fila 6, cols 5→0
  {col:5, row:6},   // 44
  {col:4, row:6},   // 45
  {col:3, row:6},   // 46
  {col:2, row:6},   // 47
  {col:1, row:6},   // 48
  {col:0, row:6},   // 49
  // Esquina OESTE — col 0, filas 7→8
  {col:0, row:7},   // 50  (casilla segura)
  {col:0, row:8},   // 51
  // → vuelve a índice 0 ({col:1, row:8}) completando el ciclo de 52
];

// ── Casillas seguras (nadie puede ser comido aquí) ───────────────
// Índices en PATH_CELLS: las 4 salidas + 4 esquinas del anillo
const SAFE_CELLS = new Set([0, 11, 13, 24, 26, 37, 39, 50]);

// ── Casillas de salida por color (índice en PATH_CELLS) ──────────
// Al salir de casa, la ficha va al progress=0 que mapea a EXIT_CELLS[color]
const EXIT_CELLS = {
  red:    0,   // PATH_CELLS[0]  = {col:1, row:8}
  blue:   13,  // PATH_CELLS[13] = {col:8, row:13}
  yellow: 26,  // PATH_CELLS[26] = {col:13, row:6}
  green:  39,  // PATH_CELLS[39] = {col:6, row:1}
};

// ── Pasillos finales por color (progress 52-56) ──────────────────
// progress 52 = HOME_STRETCH[color][0] (primera casilla del pasillo)
// progress 56 = HOME_STRETCH[color][4] (última antes de meta)
const HOME_STRETCH = {
  red:    [
    {col:1, row:7}, {col:2, row:7}, {col:3, row:7},
    {col:4, row:7}, {col:5, row:7}
  ],
  blue:   [
    {col:7, row:13}, {col:7, row:12}, {col:7, row:11},
    {col:7, row:10}, {col:7, row:9}
  ],
  yellow: [
    {col:13, row:7}, {col:12, row:7}, {col:11, row:7},
    {col:10, row:7}, {col:9, row:7}
  ],
  green:  [
    {col:7, row:1}, {col:7, row:2}, {col:7, row:3},
    {col:7, row:4}, {col:7, row:5}
  ],
};

// ── Meta (centro absoluto del tablero) ───────────────────────────
const GOAL_POSITION = { col:7, row:7 };  // progress = 57

// ── Posiciones de fichas en casa (la casita de cada color) ───────
// Las 4 fichas en casa se muestran en estas posiciones del grid
const HOME_POSITIONS = {
  red:    [
    {col:2, row:10}, {col:3, row:10},
    {col:2, row:11}, {col:3, row:11}
  ],
  blue:   [
    {col:11, row:10}, {col:12, row:10},
    {col:11, row:11}, {col:12, row:11}
  ],
  yellow: [
    {col:11, row:2}, {col:12, row:2},
    {col:11, row:3}, {col:12, row:3}
  ],
  green:  [
    {col:2, row:2}, {col:3, row:2},
    {col:2, row:3}, {col:3, row:3}
  ],
};

// ── Hexadecimales de color para la UI ────────────────────────────
const COLOR_HEX = {
  red:    '#e74c3c',
  blue:   '#2980b9',
  yellow: '#d4ac0d',
  green:  '#27ae60',
};

// ── Nombres bonitos de colores para mostrar en UI ─────────────────
const COLOR_NAME = {
  red: 'Rojo', blue: 'Azul', yellow: 'Amarillo', green: 'Verde'
};


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 2 — ESTADO LOCAL
   Solo vive en el cliente, nunca se sube a Firebase.
   Se actualiza cuando llegan cambios del listener de Firebase.
═══════════════════════════════════════════════════════════════════ */
const localState = {
  // Identidad del jugador local
  playerId:    null,   // UID de Firebase Auth anónimo (o fallback localStorage)
  roomCode:    null,   // Código de sala actual
  playerName:  null,   // Nombre escrito por el jugador
  playerColor: null,   // Color asignado ('red','blue','yellow','green')
  isHost:      false,  // ¿Es el creador de la sala?

  // Snapshot más reciente de la sala (desde el listener de Firebase)
  room: null,

  // Estado de selección de UI (solo cliente, nunca en Firebase)
  selectedDie:   null,  // 'die1' o 'die2' — dado que el jugador eligió usar
  selectedPiece: null,  // índice 0-3 de la ficha seleccionada en el tablero

  // Fase especial de bonus (captura o llegada a meta)
  bonusActive:   false, // ¿Hay un bonus pendiente de aplicar?
  bonusAmount:   0,     // 20 (captura) o 10 (meta)
  bonusType:     null,  // 'capture' | 'goal'

  // Control del timer local
  timerInterval:    null,  // referencia al setInterval del countdown
  timerValue:       TIMER_SECONDS,
  handlingTimeout:  false, // true mientras se procesa auto-movimiento por timeout

  // Anti-duplicación: solo procesa un cambio de turno una vez
  lastTurnStartedAt: null,

  // Referencias de Firebase (se asignan en initFirebase)
  db:   null,
  auth: null,
};


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 3 — INICIALIZACIÓN DE FIREBASE
   Usa el SDK compat v9 cargado desde CDN en index.html.
   La configuración viene de firebase-config.js (no subir a git).
═══════════════════════════════════════════════════════════════════ */

/**
 * Inicializa Firebase App, Auth y Database.
 * Llama a signInAnonymously() para obtener un UID persistente.
 * Si el auth anónimo no está habilitado, usa un ID aleatorio de localStorage.
 * @returns {Promise<void>}
 */
async function initFirebase() {
  // Verificar que el archivo firebase-config.js fue cargado
  if (window.FIREBASE_CONFIG_MISSING || typeof FIREBASE_CONFIG === 'undefined') {
    document.getElementById('firebase-error').style.display = 'block';
    console.error('[Firebase] firebase-config.js no encontrado. Copia firebase-config.example.js → firebase-config.js');
    return;
  }

  try {
    // Inicializar la app de Firebase (solo una vez)
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }

    localState.auth = firebase.auth();
    localState.db   = firebase.database();

    // Autenticación anónima silenciosa
    // El usuario NUNCA ve un login — solo escribe su nombre de jugador.
    // Firebase Auth anónimo nos da un UID persistente por navegador.
    await localState.auth.signInAnonymously();

    localState.auth.onAuthStateChanged((user) => {
      if (user) {
        const storedId = localStorage.getItem('parchis_playerId');
        // Mantener el mismo playerId si ya existía (para reconexión)
        if (!storedId) {
          localState.playerId = user.uid;
          localStorage.setItem('parchis_playerId', user.uid);
        } else {
          localState.playerId = storedId;
        }
        console.log('[Firebase] Auth anónimo OK. PlayerId:', localState.playerId);
      }
    });

  } catch (err) {
    console.warn('[Firebase] Auth anónimo falló, usando ID de localStorage:', err.message);
    // Fallback: generar ID aleatorio y guardarlo en localStorage
    let fallbackId = localStorage.getItem('parchis_playerId');
    if (!fallbackId) {
      fallbackId = 'p_' + Math.random().toString(36).substr(2, 12);
      localStorage.setItem('parchis_playerId', fallbackId);
    }
    localState.playerId = fallbackId;

    // Intentar inicializar la DB sin auth (requiere reglas abiertas en Firebase)
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    localState.db = firebase.database();
  }
}

/**
 * Retorna una referencia a la sala actual en Firebase.
 * @param {string} [code] - Código de sala (usa localState.roomCode si no se pasa)
 * @returns {firebase.database.Reference}
 */
function roomRef(code) {
  return localState.db.ref('rooms/' + (code || localState.roomCode));
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 4 — CREACIÓN Y UNIÓN A SALAS
═══════════════════════════════════════════════════════════════════ */

/**
 * Genera un código de sala de 6 caracteres.
 * Usa solo letras A-Z y números 2-9 (sin 0,1,O,I para evitar confusiones).
 * @returns {string}
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Crea una sala nueva en Firebase.
 * Asigna color rojo al creador y lo lleva a la sala de espera.
 * @param {string} playerName
 */
async function createRoom(playerName) {
  if (!localState.playerId) {
    showLobbyError('Error de conexión. Recarga la página.');
    return;
  }

  playerName = playerName.trim();
  if (!playerName) {
    showLobbyError('Escribe tu nombre para crear una sala.');
    return;
  }

  showLoadingModal('Creando sala...');

  // Generar código único (reintentar si ya existe)
  let code = generateRoomCode();
  let attempts = 0;
  while (attempts < 5) {
    const snap = await localState.db.ref('rooms/' + code).once('value');
    if (!snap.exists()) break;
    code = generateRoomCode();
    attempts++;
  }

  localState.roomCode  = code;
  localState.playerName = playerName;
  localState.playerColor = 'red'; // El creador siempre es rojo
  localState.isHost    = true;

  const now = firebase.database.ServerValue.TIMESTAMP;

  // Estructura inicial de la sala en Firebase
  const roomData = {
    status:       'waiting',
    hostId:       localState.playerId,
    createdAt:    now,
    winner:       null,
    players: {
      [localState.playerId]: {
        name:      playerName,
        color:     'red',
        connected: true,
        joinedAt:  now,
        lastSeen:  now,
      }
    },
    // Las piezas y el turno se inicializan cuando el host inicia la partida
  };

  try {
    await localState.db.ref('rooms/' + code).set(roomData);

    // Guardar en localStorage para reconexión
    saveSession(code, playerName, localState.playerId, true);

    // Configurar presencia (desconexión automática)
    setupPresence(code, localState.playerId);

    hideLoadingModal();
    showWaitingRoom(code);
    subscribeToRoom(code);

  } catch (err) {
    hideLoadingModal();
    showLobbyError('Error al crear la sala: ' + err.message);
    console.error('[createRoom]', err);
  }
}

/**
 * Une al jugador local a una sala existente.
 * Valida: que la sala exista, que no esté llena, que no haya iniciado.
 * @param {string} roomCode
 * @param {string} playerName
 */
async function joinRoom(roomCode, playerName) {
  if (!localState.playerId) {
    showLobbyError('Error de conexión. Recarga la página.');
    return;
  }

  roomCode   = roomCode.trim().toUpperCase();
  playerName = playerName.trim();

  if (!roomCode)   { showLobbyError('Escribe el código de sala.');     return; }
  if (!playerName) { showLobbyError('Escribe tu nombre para unirte.'); return; }
  if (roomCode.length !== 6) { showLobbyError('El código debe tener 6 caracteres.'); return; }

  showLoadingModal('Uniéndote a la sala...');

  try {
    const snap = await localState.db.ref('rooms/' + roomCode).once('value');

    if (!snap.exists()) {
      hideLoadingModal();
      showLobbyError('Sala no encontrada. Verifica el código.');
      return;
    }

    const room = snap.val();

    // Verificar si ya estaba en esta sala (reconexión)
    if (room.players && room.players[localState.playerId]) {
      hideLoadingModal();
      await reconnectToRoom(roomCode, playerName, room);
      return;
    }

    // Validaciones para nuevo jugador
    if (room.status === 'playing' || room.status === 'finished') {
      hideLoadingModal();
      showLobbyError('La partida ya inició. No puedes unirte.');
      return;
    }

    const players    = room.players || {};
    const playerCount = Object.keys(players).length;

    if (playerCount >= MAX_PLAYERS) {
      hideLoadingModal();
      showLobbyError('La sala está llena (máximo 4 jugadores).');
      return;
    }

    // Asignar el siguiente color disponible
    const usedColors  = Object.values(players).map(p => p.color);
    const color = COLOR_ORDER.find(c => !usedColors.includes(c));

    if (!color) {
      hideLoadingModal();
      showLobbyError('No hay colores disponibles en esta sala.');
      return;
    }

    // Registrar al jugador en Firebase
    const now = firebase.database.ServerValue.TIMESTAMP;
    await localState.db.ref(`rooms/${roomCode}/players/${localState.playerId}`).set({
      name:      playerName,
      color:     color,
      connected: true,
      joinedAt:  now,
      lastSeen:  now,
    });

    localState.roomCode    = roomCode;
    localState.playerName  = playerName;
    localState.playerColor = color;
    localState.isHost      = false;

    saveSession(roomCode, playerName, localState.playerId, false);
    setupPresence(roomCode, localState.playerId);

    hideLoadingModal();
    showWaitingRoom(roomCode);
    subscribeToRoom(roomCode);

  } catch (err) {
    hideLoadingModal();
    showLobbyError('Error al unirse: ' + err.message);
    console.error('[joinRoom]', err);
  }
}

/**
 * Reconecta a un jugador que ya estaba en la sala (recargó la página).
 * Actualiza su estado de conexión y lo lleva a la pantalla correcta.
 * @param {string} roomCode
 * @param {string} playerName
 * @param {object} room - Snapshot de la sala
 */
async function reconnectToRoom(roomCode, playerName, room) {
  const player = room.players[localState.playerId];

  localState.roomCode    = roomCode;
  localState.playerName  = player.name || playerName;
  localState.playerColor = player.color;
  localState.isHost      = (room.hostId === localState.playerId);

  // Marcar como conectado de nuevo
  await localState.db.ref(`rooms/${roomCode}/players/${localState.playerId}`).update({
    connected: true,
    lastSeen:  firebase.database.ServerValue.TIMESTAMP,
  });

  saveSession(roomCode, localState.playerName, localState.playerId, localState.isHost);
  setupPresence(roomCode, localState.playerId);

  console.log('[reconnectToRoom] Reconectado a sala', roomCode, 'como', localState.playerColor);

  // Ir a la pantalla correspondiente según el estado de la partida
  if (room.status === 'playing') {
    showScreen('screen-game');
  } else if (room.status === 'waiting') {
    showWaitingRoom(roomCode);
  } else if (room.status === 'finished') {
    showScreen('screen-game');
  }

  subscribeToRoom(roomCode);
}

/**
 * Configura la presencia del jugador en Firebase.
 * Cuando el cliente se desconecta, Firebase marca al jugador como disconnected.
 * @param {string} roomCode
 * @param {string} playerId
 */
function setupPresence(roomCode, playerId) {
  const playerConnRef = localState.db.ref(`rooms/${roomCode}/players/${playerId}/connected`);
  const playerLastRef = localState.db.ref(`rooms/${roomCode}/players/${playerId}/lastSeen`);

  // onDisconnect: Firebase ejecuta esto cuando el cliente se desconecta
  playerConnRef.onDisconnect().set(false);
  playerLastRef.onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);

  // Marcar como conectado ahora mismo
  playerConnRef.set(true);
  playerLastRef.set(firebase.database.ServerValue.TIMESTAMP);

  // Actualizar lastSeen cada 30 segundos para indicar presencia activa
  setInterval(() => {
    if (localState.roomCode === roomCode) {
      playerLastRef.set(firebase.database.ServerValue.TIMESTAMP).catch(() => {});
    }
  }, 30000);
}

/**
 * Guarda la sesión del jugador en localStorage para reconexión.
 * @param {string} roomCode
 * @param {string} playerName
 * @param {string} playerId
 * @param {boolean} isHost
 */
function saveSession(roomCode, playerName, playerId, isHost) {
  localStorage.setItem('parchis_roomCode',  roomCode);
  localStorage.setItem('parchis_playerName', playerName);
  localStorage.setItem('parchis_playerId',   playerId);
  localStorage.setItem('parchis_isHost',     isHost ? 'true' : 'false');
}

/**
 * Borra la sesión guardada en localStorage.
 */
function clearSession() {
  localStorage.removeItem('parchis_roomCode');
  localStorage.removeItem('parchis_playerName');
  // No borramos parchis_playerId para mantener el UID de Firebase Auth
}

/**
 * Lee el código de sala del parámetro ?room= en la URL.
 * @returns {string|null}
 */
function getUrlRoomCode() {
  const params = new URLSearchParams(window.location.search);
  return params.get('room') ? params.get('room').toUpperCase() : null;
}

/**
 * Genera la URL compartible de una sala.
 * @param {string} roomCode
 * @returns {string}
 */
function getRoomUrl(roomCode) {
  const base = window.location.origin + window.location.pathname;
  return `${base}?room=${roomCode}`;
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 5 — LISTENER DE FIREBASE EN TIEMPO REAL
   Suscribe al nodo rooms/{roomCode} y despacha los cambios
   a las funciones de renderizado y lógica de juego.
═══════════════════════════════════════════════════════════════════ */

// Referencia al listener activo (para poder desuscribirse si es necesario)
let activeRoomListener = null;

/**
 * Suscribe al snapshot de la sala en Firebase.
 * Cada vez que cualquier dato cambia en rooms/{roomCode},
 * esta función recibe el nuevo estado completo y lo procesa.
 * @param {string} roomCode
 */
function subscribeToRoom(roomCode) {
  // Cancelar listener anterior si existía
  if (activeRoomListener) {
    localState.db.ref('rooms/' + (localState.roomCode || roomCode)).off('value', activeRoomListener);
  }

  const ref = localState.db.ref('rooms/' + roomCode);

  activeRoomListener = ref.on('value', (snap) => {
    if (!snap.exists()) {
      console.warn('[Firebase] La sala ya no existe en la base de datos.');
      showLobbyError('La sala fue eliminada o ya no existe.');
      showScreen('screen-lobby');
      clearSession();
      return;
    }

    const room = snap.val();
    localState.room = room; // Guardar snapshot local

    // Despachar a la función correcta según el estado actual de la UI
    onRoomUpdate(room);
  }, (err) => {
    console.error('[Firebase listener] Error:', err);
  });
}

/**
 * Punto central de despacho cuando llega un update de Firebase.
 * Determina en qué pantalla estamos y qué necesita actualizarse.
 * @param {object} room - Snapshot completo de la sala
 */
function onRoomUpdate(room) {
  const currentScreen = document.querySelector('.screen.active')?.id;

  // ── Sala de espera ─────────────────────────────────────────────
  if (currentScreen === 'screen-waiting') {
    updateWaitingRoomUI(room);

    // Si la partida inició → pasar a la pantalla de juego
    if (room.status === 'playing') {
      showScreen('screen-game');
      initBoard();       // Crear el grid del tablero
      renderBoard(room); // Colocar fichas
      renderUI(room);    // Actualizar panel
      startTurnLogic(room); // Iniciar lógica de turno local
    }
    return;
  }

  // ── Pantalla de juego ──────────────────────────────────────────
  if (currentScreen === 'screen-game') {
    // Si alguien ganó → mostrar modal
    if (room.status === 'finished' && room.winner) {
      clearTimer();
      renderBoard(room);
      renderUI(room);
      showWinner(room.winner, room);
      return;
    }

    renderBoard(room);
    renderUI(room);

    // Detectar cambio de turno (para reiniciar timer local)
    if (room.turn) {
      const newStartedAt = room.turn.startedAt;
      if (newStartedAt && newStartedAt !== localState.lastTurnStartedAt) {
        localState.lastTurnStartedAt = newStartedAt;
        localState.handlingTimeout   = false;
        localState.selectedDie       = null;
        localState.selectedPiece     = null;
        localState.bonusActive       = false;
        startLocalTimer(room);
      }
    }
    return;
  }

  // ── Lobby (no debería ocurrir, pero por seguridad) ─────────────
  if (room.status === 'playing' || room.status === 'finished') {
    // Si el jugador está en el lobby pero la sala ya está en juego
    // (caso de reconexión tardía), ir directamente al juego
    showScreen('screen-game');
    initBoard();
    renderBoard(room);
    renderUI(room);
    startTurnLogic(room);
  }
}

/**
 * Evalúa si es el turno del jugador local y activa/desactiva controles.
 * Se llama cuando hay un nuevo turno detectado.
 * @param {object} room
 */
function startTurnLogic(room) {
  if (!room.turn) return;
  const isMyTurn = (room.turn.playerId === localState.playerId);

  // Solo el jugador activo controla el timer local y los botones
  renderUI(room);

  if (isMyTurn) {
    console.log('[Turno] Es MI turno.');
  } else {
    console.log('[Turno] Turno de:', getPlayerName(room.turn.playerId, room));
  }
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 6 — INICIO DE PARTIDA
   Solo el host puede iniciar. Inicializa piezas, orden de turnos
   y escribe el estado inicial en Firebase.
═══════════════════════════════════════════════════════════════════ */

/**
 * El host inicia la partida.
 * - Valida mínimo de jugadores.
 * - Inicializa todas las piezas en casa (progress = -1).
 * - Determina el orden de turnos por joinedAt.
 * - Escribe el estado inicial en Firebase → status: 'playing'.
 */
async function startGame() {
  const room = localState.room;
  if (!room) return;

  // Solo el host puede iniciar
  if (room.hostId !== localState.playerId) return;

  const players = room.players || {};
  const playerIds = Object.keys(players);

  if (playerIds.length < MIN_PLAYERS) {
    showLobbyError(`Necesitas al menos ${MIN_PLAYERS} jugadores para iniciar.`);
    return;
  }

  showLoadingModal('Iniciando partida...');

  // Ordenar jugadores por joinedAt para determinar orden de turno
  const ordered = playerIds.sort((a, b) => {
    return (players[a].joinedAt || 0) - (players[b].joinedAt || 0);
  });

  // Inicializar piezas de todos los jugadores en casa (-1)
  const pieces = {};
  for (const pid of playerIds) {
    pieces[pid] = { p0: -1, p1: -1, p2: -1, p3: -1 };
  }

  // El primer jugador (host, joinedAt más antiguo) empieza
  const firstPlayerId = ordered[0];
  const now = firebase.database.ServerValue.TIMESTAMP;

  const updates = {
    'status': 'playing',
    'winner': null,
    'pieces': pieces,
    'turn': {
      playerId:           firstPlayerId,
      startedAt:          now,
      consecutiveDoubles: 0,
      lastMovedPiece:     null,
      dice: {
        d1:     null,
        d2:     null,
        rolled: false,
        d1Used: false,
        d2Used: false,
      },
      bonus: {
        active: false,
        amount: null,
        type:   null,
      },
    },
    'events': {
      [Date.now()]: '🎮 ¡La partida ha comenzado!',
    },
  };

  try {
    await roomRef().update(updates);
    hideLoadingModal();
    console.log('[startGame] Partida iniciada. Primer turno:', firstPlayerId);
  } catch (err) {
    hideLoadingModal();
    console.error('[startGame]', err);
    showLobbyError('Error al iniciar la partida: ' + err.message);
  }
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 7 — LANZAMIENTO DE DADOS
   Genera d1 y d2, los escribe en Firebase, verifica si hay
   movimientos válidos y maneja el caso de turno automático.
═══════════════════════════════════════════════════════════════════ */

/**
 * El jugador local tira los dados.
 * Solo se ejecuta si es su turno y aún no tiró.
 */
async function rollDice() {
  const room = localState.room;
  if (!room || !room.turn) return;
  if (room.turn.playerId !== localState.playerId) return;
  if (room.turn.dice && room.turn.dice.rolled) return; // Ya tiró

  // Generar valores aleatorios
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;

  const isDouble = (d1 === d2);

  // Verificar dobles consecutivos
  let consecutiveDoubles = (room.turn.consecutiveDoubles || 0);
  if (isDouble) consecutiveDoubles++;

  try {
    await roomRef().update({
      'turn/dice/d1':     d1,
      'turn/dice/d2':     d2,
      'turn/dice/rolled': true,
      'turn/dice/d1Used': false,
      'turn/dice/d2Used': false,
      'turn/consecutiveDoubles': consecutiveDoubles,
    });

    // Log del evento
    const playerName = localState.playerName || 'Jugador';
    const msg = isDouble
      ? `🎲 ${playerName} sacó dobles: ${DICE_EMOJI[d1]}${DICE_EMOJI[d2]}`
      : `🎲 ${playerName} tiró: ${DICE_EMOJI[d1]} ${DICE_EMOJI[d2]}`;
    await addEvent(msg);

    // Si sacó 3 dobles consecutivos → castigo
    if (consecutiveDoubles >= MAX_CONSECUTIVE_DOUBLES) {
      await addEvent(`⚠️ ¡${playerName} sacó 3 dobles seguidos! Castigo.`);
      await punishTripleDoubles(room, d1, d2);
      return;
    }

    console.log(`[rollDice] d1=${d1} d2=${d2} dobles=${isDouble} consecutivos=${consecutiveDoubles}`);

    // Verificar si hay algún movimiento válido con alguno de los dados
    const freshRoom = (await roomRef().once('value')).val();
    const hasAny = checkAnyValidMove(freshRoom, localState.playerId, d1, d2);

    if (!hasAny) {
      await addEvent(`⏭️ ${playerName} no tiene movimientos válidos. Turno saltado.`);
      await nextTurn(freshRoom);
    }

  } catch (err) {
    console.error('[rollDice]', err);
  }
}

/**
 * Verifica si el jugador tiene al menos un movimiento válido
 * con cualquiera de los dos dados.
 * @param {object} room
 * @param {string} playerId
 * @param {number} d1
 * @param {number} d2
 * @returns {boolean}
 */
function checkAnyValidMove(room, playerId, d1, d2) {
  const color = room.players[playerId]?.color;
  if (!color) return false;

  for (let i = 0; i < PIECES_PER_PLAYER; i++) {
    if (getValidMoveResult(room, playerId, color, i, d1) !== null) return true;
    if (d2 !== d1 || i > 0) { // Evitar doble chequeo idéntico en mismo dado
      if (getValidMoveResult(room, playerId, color, i, d2) !== null) return true;
    }
  }
  // Revisar d2 para todas las piezas también si d1===d2
  if (d1 === d2) return false; // Ya revisamos todo
  return false;
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 8 — VALIDACIÓN DE MOVIMIENTOS
   Funciones puras que calculan si un movimiento es legal
   y adónde llegaría una ficha.
═══════════════════════════════════════════════════════════════════ */

/**
 * Convierte el progress de una ficha a su índice en PATH_CELLS.
 * Solo aplica para progress 0-51 (camino principal).
 * @param {string} color
 * @param {number} progress - 0 a 51
 * @returns {number} índice en PATH_CELLS (0-51)
 */
function getRingIndex(color, progress) {
  return (EXIT_CELLS[color] + progress) % PATH_LENGTH;
}

/**
 * Verifica si un índice de PATH_CELLS es casilla segura.
 * @param {number} ringIdx
 * @returns {boolean}
 */
function isSafeCell(ringIdx) {
  return SAFE_CELLS.has(ringIdx);
}

/**
 * Verifica si una casilla del camino principal tiene un bloqueo rival.
 * Un bloqueo es 2+ fichas del mismo color enemigo en ese ringIndex.
 * @param {object} room
 * @param {number} ringIdx - índice en PATH_CELLS
 * @param {string} ownColor - color del jugador que quiere pasar
 * @returns {boolean}
 */
function isBlockedByRival(room, ringIdx, ownColor) {
  if (!room.pieces || !room.players) return false;

  // Contar fichas rivales por color en ese ringIdx
  const counts = {};
  for (const [pid, playerPieces] of Object.entries(room.pieces)) {
    const color = room.players[pid]?.color;
    if (!color || color === ownColor) continue;

    for (const key of ['p0','p1','p2','p3']) {
      const prog = playerPieces[key];
      if (prog >= 0 && prog < PATH_LENGTH) {
        const idx = getRingIndex(color, prog);
        if (idx === ringIdx) {
          counts[color] = (counts[color] || 0) + 1;
          if (counts[color] >= 2) return true; // Bloqueo rival confirmado
        }
      }
    }
  }
  return false;
}

/**
 * Verifica si hay una ficha rival (exactamente 1) en un ringIdx.
 * Si hay 0 o 2+, no hay captura posible.
 * @param {object} room
 * @param {number} ringIdx
 * @param {string} attackerColor - color del atacante
 * @returns {{playerId:string, pieceKey:string}|null}
 */
function checkCapturePossibility(room, ringIdx, attackerColor) {
  if (!room.pieces || !room.players) return null;
  if (isSafeCell(ringIdx)) return null; // Casillas seguras: no hay captura

  const rivals = [];
  for (const [pid, playerPieces] of Object.entries(room.pieces)) {
    const color = room.players[pid]?.color;
    if (!color || color === attackerColor) continue;

    for (const key of ['p0','p1','p2','p3']) {
      const prog = playerPieces[key];
      if (prog >= 0 && prog < PATH_LENGTH) {
        const idx = getRingIndex(color, prog);
        if (idx === ringIdx) {
          rivals.push({ playerId: pid, pieceKey: key });
        }
      }
    }
  }

  // Solo hay captura si hay exactamente 1 ficha rival (2+ = bloqueo, sin captura)
  return rivals.length === 1 ? rivals[0] : null;
}

/**
 * Verifica si el camino desde fromProgress hasta fromProgress+dieValue
 * está bloqueado por algún rival (no puede atravesar ni aterrizar).
 * Solo aplica mientras la ficha está en el camino principal (progress 0-51).
 * @param {object} room
 * @param {string} color
 * @param {number} fromProgress - progress actual de la ficha
 * @param {number} dieValue
 * @returns {boolean} true si el camino está bloqueado
 */
function isPathBlocked(room, color, fromProgress, dieValue) {
  // Si la ficha está en casa, solo importa la casilla de salida
  if (fromProgress === HOME_PROGRESS) {
    const exitRing = EXIT_CELLS[color];
    return isBlockedByRival(room, exitRing, color);
  }

  // Verificar cada casilla intermedia y la de destino
  for (let step = 1; step <= dieValue; step++) {
    const checkProgress = fromProgress + step;

    // Si ya llegamos al pasillo final, no hay bloqueos allí
    if (checkProgress >= HOME_STRETCH_START) break;

    const ringIdx = getRingIndex(color, checkProgress % PATH_LENGTH);
    if (isBlockedByRival(room, ringIdx, color)) return true;
  }
  return false;
}

/**
 * Calcula el progress final de una ficha si se mueve con un dado.
 * Maneja: salida de casa, rebote en meta, bloqueos.
 * @param {object} room
 * @param {string} playerId
 * @param {string} color
 * @param {number} pieceIdx - 0 a 3
 * @param {number} dieValue - 1 a 6
 * @returns {number|null} progress final, o null si el movimiento es inválido
 */
function getValidMoveResult(room, playerId, color, pieceIdx, dieValue) {
  if (!room.pieces || !room.pieces[playerId]) return null;

  const key      = 'p' + pieceIdx;
  const progress = room.pieces[playerId][key];

  // ── Ficha ya en meta → no se mueve ────────────────────────────
  if (progress === GOAL_PROGRESS) return null;

  // ── Ficha en casa ──────────────────────────────────────────────
  if (progress === HOME_PROGRESS) {
    // Solo sale con 1 o 6
    if (dieValue !== 1 && dieValue !== 6) return null;

    // Verificar si la salida está bloqueada por rival
    const exitRing = EXIT_CELLS[color];
    if (isBlockedByRival(room, exitRing, color)) return null;

    return 0; // Sale a su casilla de salida (progress = 0)
  }

  // ── Ficha en pasillo final (progress 52-56) ────────────────────
  if (progress >= HOME_STRETCH_START) {
    const rawTarget = progress + dieValue;

    if (rawTarget > GOAL_PROGRESS) {
      // Rebote: 2*GOAL - rawTarget
      return 2 * GOAL_PROGRESS - rawTarget;
    }
    return rawTarget; // Avanza normalmente en el pasillo
  }

  // ── Ficha en camino principal (progress 0-51) ──────────────────
  const rawTarget = progress + dieValue;

  // Verificar bloqueos en el camino
  if (isPathBlocked(room, color, progress, dieValue)) return null;

  // ¿Entra al pasillo final?
  // El pasillo empieza cuando el progreso supera 51 (una vuelta completa)
  if (rawTarget >= PATH_LENGTH) {
    // Cuántos pasos quedan en el camino + cuántos entran al pasillo
    const stepsIntoStretch = rawTarget - PATH_LENGTH;
    const stretchProgress  = HOME_STRETCH_START + stepsIntoStretch;

    if (stretchProgress > GOAL_PROGRESS) {
      // Rebote dentro del pasillo
      return 2 * GOAL_PROGRESS - stretchProgress;
    }
    return stretchProgress;
  }

  // Avance normal en camino principal
  return rawTarget;
}

/**
 * Obtiene todos los movimientos válidos para el jugador local
 * con un valor de dado específico.
 * @param {object} room
 * @param {string} playerId
 * @param {number} dieValue
 * @returns {Array<{pieceIdx:number, resultProgress:number, captureInfo:object|null}>}
 */
function getAllValidMoves(room, playerId, dieValue) {
  const color = room.players[playerId]?.color;
  if (!color) return [];

  const moves = [];
  for (let i = 0; i < PIECES_PER_PLAYER; i++) {
    const result = getValidMoveResult(room, playerId, color, i, dieValue);
    if (result === null) continue;

    // Calcular si hay captura en el destino
    let captureInfo = null;
    if (result >= 0 && result < PATH_LENGTH) {
      const destRing = getRingIndex(color, result);
      captureInfo = checkCapturePossibility(room, destRing, color);
    }

    moves.push({ pieceIdx: i, resultProgress: result, captureInfo });
  }
  return moves;
}

/**
 * Obtiene los movimientos válidos para un bonus (captura o meta).
 * El bonus es un movimiento especial: no puede generar otro bonus.
 * @param {object} room
 * @param {string} playerId
 * @param {number} bonusAmount - casillas del bonus (10 o 20)
 * @returns {Array<{pieceIdx:number, resultProgress:number}>}
 */
function getAllBonusMoves(room, playerId, bonusAmount) {
  const color = room.players[playerId]?.color;
  if (!color || !room.pieces || !room.pieces[playerId]) return [];

  const moves = [];
  for (let i = 0; i < PIECES_PER_PLAYER; i++) {
    const key      = 'p' + i;
    const progress = room.pieces[playerId][key];

    // Solo fichas que están en el camino o en pasillo (no en casa ni en meta)
    if (progress < 0 || progress === GOAL_PROGRESS) continue;

    // Calcular destino del bonus (mismo cálculo que movimiento normal)
    const result = getValidMoveResult(room, playerId, color, i, bonusAmount);
    if (result === null) continue;

    moves.push({ pieceIdx: i, resultProgress: result });
  }
  return moves;
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 9 — EJECUCIÓN DE MOVIMIENTOS
   Aplica el movimiento elegido en Firebase y desencadena
   las consecuencias (captura, meta, bonus, siguiente dado).
═══════════════════════════════════════════════════════════════════ */

/**
 * Ejecuta el movimiento de una ficha con el dado seleccionado.
 * Valida que sea legal, actualiza Firebase y maneja consecuencias.
 * @param {number} pieceIdx - 0 a 3
 */
async function movePiece(pieceIdx) {
  const room = localState.room;
  if (!room || !room.turn) return;

  // Validaciones de seguridad (cliente)
  if (room.turn.playerId !== localState.playerId) return;
  if (!room.turn.dice || !room.turn.dice.rolled)  return;
  if (!localState.selectedDie) return;
  if (localState.bonusActive) return; // Primero resolver el bonus

  const dieKey   = localState.selectedDie; // 'die1' o 'die2'
  const dieDbKey = dieKey === 'die1' ? 'd1' : 'd2';
  const usedKey  = dieKey === 'die1' ? 'd1Used' : 'd2Used';

  // Verificar que este dado no fue ya usado
  if (room.turn.dice[usedKey]) return;

  const dieValue = room.turn.dice[dieDbKey];
  const color    = room.players[localState.playerId]?.color;
  if (!color) return;

  // Calcular el resultado del movimiento
  const resultProgress = getValidMoveResult(room, localState.playerId, color, pieceIdx, dieValue);
  if (resultProgress === null) {
    showGameMsg('❌ Movimiento inválido para esa ficha.');
    return;
  }

  const key = 'p' + pieceIdx;
  const oldProgress = room.pieces[localState.playerId][key];

  try {
    // ── 1. Actualizar posición de la ficha ─────────────────────
    await roomRef().update({
      [`pieces/${localState.playerId}/${key}`]: resultProgress,
      [`turn/dice/${usedKey}`]:                true,
      'turn/lastMovedPiece':                   key,
    });

    const playerName = localState.playerName;

    // ── 2. Log de movimiento ────────────────────────────────────
    const fromLabel = oldProgress === HOME_PROGRESS ? 'casa' : `pos ${oldProgress}`;
    const toLabel   = resultProgress === GOAL_PROGRESS ? 'META 🏁' : `pos ${resultProgress}`;
    await addEvent(`♟️ ${playerName} movió ficha ${pieceIdx + 1}: ${fromLabel} → ${toLabel}`);

    // ── 3. Verificar captura ────────────────────────────────────
    let hasCapture = false;
    if (resultProgress >= 0 && resultProgress < PATH_LENGTH) {
      const destRing   = getRingIndex(color, resultProgress);
      const captureTarget = checkCapturePossibility(room, destRing, color);

      if (captureTarget) {
        hasCapture = true;
        await executeCapture(captureTarget, playerName);
      }
    }

    // ── 4. Verificar si llegó a meta ────────────────────────────
    let hasGoal = false;
    if (resultProgress === GOAL_PROGRESS) {
      hasGoal = true;
      await addEvent(`🏁 ¡${playerName} llevó una ficha a la META!`);

      // Verificar si ganó la partida
      const freshRoom = (await roomRef().once('value')).val();
      if (checkWinner(freshRoom, localState.playerId)) {
        await roomRef().update({
          'status': 'finished',
          'winner': localState.playerId,
        });
        await addEvent(`🏆 ¡${playerName} GANÓ LA PARTIDA!`);
        return; // Fin del juego
      }
    }

    // ── 5. Activar bonus (captura tiene prioridad sobre meta) ───
    if (hasCapture) {
      await activateBonus('capture', CAPTURE_BONUS);
      return; // Esperar a que el jugador elija ficha para bonus
    }

    if (hasGoal && !hasCapture) {
      await activateBonus('goal', GOAL_BONUS);
      return; // Esperar bonus de meta
    }

    // ── 6. Sin bonus → continuar con el siguiente dado ──────────
    await checkDiceCompletion();

  } catch (err) {
    console.error('[movePiece]', err);
  }
}

/**
 * Ejecuta la captura de una ficha rival.
 * La manda a casa (progress = -1).
 * @param {{playerId:string, pieceKey:string}} target
 * @param {string} attackerName
 */
async function executeCapture(target, attackerName) {
  const capturedPlayerColor = localState.room.players[target.playerId]?.color;
  const capturedName        = getPlayerName(target.playerId, localState.room);

  // Regresar ficha rival a casa
  await roomRef().update({
    [`pieces/${target.playerId}/${target.pieceKey}`]: HOME_PROGRESS,
  });

  await addEvent(`💥 ¡${attackerName} comió una ficha de ${capturedName}! (+${CAPTURE_BONUS} bonus)`, 'capture');
}

/**
 * Activa el modo bonus en Firebase.
 * El jugador debe elegir a qué ficha aplicar el bonus.
 * @param {'capture'|'goal'} type
 * @param {number} amount
 */
async function activateBonus(type, amount) {
  // Verificar si hay fichas elegibles para el bonus
  const freshRoom = (await roomRef().once('value')).val();
  const bonusMoves = getAllBonusMoves(freshRoom, localState.playerId, amount);

  if (bonusMoves.length === 0) {
    // No hay fichas para aplicar el bonus → se pierde
    const typeLabel = type === 'capture' ? 'captura' : 'meta';
    await addEvent(`⚠️ Bonus de ${typeLabel} perdido (no hay fichas elegibles).`, 'system');
    await checkDiceCompletion();
    return;
  }

  // Marcar bonus activo en Firebase
  await roomRef().update({
    'turn/bonus/active': true,
    'turn/bonus/amount': amount,
    'turn/bonus/type':   type,
  });

  // Marcar en el estado local para que la UI lo muestre
  localState.bonusActive = true;
  localState.bonusAmount  = amount;
  localState.bonusType    = type;
}

/**
 * Aplica el bonus a la ficha elegida por el jugador.
 * @param {number} pieceIdx - 0 a 3
 */
async function applyBonus(pieceIdx) {
  const room = localState.room;
  if (!room || !room.turn || !room.turn.bonus?.active) return;
  if (room.turn.playerId !== localState.playerId) return;

  const amount = room.turn.bonus.amount;
  const color  = room.players[localState.playerId]?.color;
  if (!color) return;

  // Validar que la ficha elegida puede recibir el bonus
  const result = getValidMoveResult(room, localState.playerId, color, pieceIdx, amount);
  if (result === null) {
    showGameMsg('❌ No puedes aplicar el bonus a esa ficha.');
    return;
  }

  const key = 'p' + pieceIdx;

  try {
    await roomRef().update({
      [`pieces/${localState.playerId}/${key}`]: result,
      'turn/bonus/active':                      false,
      'turn/bonus/amount':                      null,
      'turn/bonus/type':                        null,
    });

    const typeLabel = room.turn.bonus.type === 'capture' ? 'captura' : 'meta';
    await addEvent(`⚡ ${localState.playerName} usó bonus de ${typeLabel} (+${amount}) en ficha ${pieceIdx + 1}.`, 'bonus');

    localState.bonusActive = false;
    localState.bonusAmount = 0;
    localState.bonusType   = null;

    // Verificar si llegó a meta con el bonus
    if (result === GOAL_PROGRESS) {
      await addEvent(`🏁 ¡${localState.playerName} llevó otra ficha a la META con bonus!`);
      const freshRoom = (await roomRef().once('value')).val();
      if (checkWinner(freshRoom, localState.playerId)) {
        await roomRef().update({ 'status': 'finished', 'winner': localState.playerId });
        await addEvent(`🏆 ¡${localState.playerName} GANÓ LA PARTIDA!`);
        return;
      }
    }

    // El bonus no genera otro bonus (evitar cadenas infinitas)
    await checkDiceCompletion();

  } catch (err) {
    console.error('[applyBonus]', err);
  }
}

/**
 * El jugador salta (descarta) el bonus activo.
 * Se llama cuando el jugador hace clic en "Saltar bonus"
 * o cuando el timer llega a cero durante la fase de bonus.
 */
async function skipBonus() {
  if (!localState.bonusActive) return;

  try {
    await roomRef().update({
      'turn/bonus/active': false,
      'turn/bonus/amount': null,
      'turn/bonus/type':   null,
    });

    localState.bonusActive = false;
    localState.bonusAmount = 0;
    localState.bonusType   = null;

    await addEvent(`⏭️ ${localState.playerName} saltó el bonus.`, 'system');
    await checkDiceCompletion();
  } catch (err) {
    console.error('[skipBonus]', err);
  }
}

/**
 * Verifica si quedan dados por usar.
 * Si ambos están usados → maneja dobles o pasa el turno.
 * Si queda uno → la UI lo mostrará disponible.
 */
async function checkDiceCompletion() {
  const freshRoom = (await roomRef().once('value')).val();
  if (!freshRoom?.turn?.dice) return;

  const { d1Used, d2Used, d1, d2 } = freshRoom.turn.dice;

  // Verificar si el dado no usado tiene movimientos válidos
  // Si no los tiene, marcarlo también como usado automáticamente
  if (d1Used && !d2Used) {
    const movesD2 = getAllValidMoves(freshRoom, localState.playerId, d2);
    if (movesD2.length === 0) {
      await roomRef().update({ 'turn/dice/d2Used': true });
      await addEvent('⏭️ Dado 2 sin movimientos válidos. Turno completado.', 'system');
      await handleDoublesAndNextTurn(freshRoom);
      return;
    }
    // Hay movimientos con d2 → la UI mostrará el dado 2 disponible
    localState.selectedDie   = null;
    localState.selectedPiece = null;
    return;
  }

  if (!d1Used && d2Used) {
    const movesD1 = getAllValidMoves(freshRoom, localState.playerId, d1);
    if (movesD1.length === 0) {
      await roomRef().update({ 'turn/dice/d1Used': true });
      await addEvent('⏭️ Dado 1 sin movimientos válidos. Turno completado.', 'system');
      await handleDoublesAndNextTurn(freshRoom);
      return;
    }
    localState.selectedDie   = null;
    localState.selectedPiece = null;
    return;
  }

  if (d1Used && d2Used) {
    // Ambos dados usados → fin del turno o dobles
    await handleDoublesAndNextTurn(freshRoom);
  }
}

/**
 * Verifica si el turno terminó con dobles para dar turno extra,
 * o pasa el turno al siguiente jugador.
 * @param {object} room
 */
async function handleDoublesAndNextTurn(room) {
  if (!room.turn) return;

  const { d1, d2, consecutiveDoubles } = {
    d1: room.turn.dice?.d1,
    d2: room.turn.dice?.d2,
    consecutiveDoubles: room.turn.consecutiveDoubles || 0,
  };

  const isDouble = (d1 === d2 && d1 !== null);

  // Si sacó dobles (y no es castigo de triple doble) → turno extra
  if (isDouble && consecutiveDoubles < MAX_CONSECUTIVE_DOUBLES) {
    await addEvent(`🎯 ¡${localState.playerName} sacó dobles! Tira de nuevo.`, 'doubles');

    // Reiniciar los dados para el nuevo tiro (mantener consecutiveDoubles)
    await roomRef().update({
      'turn/dice/d1':     null,
      'turn/dice/d2':     null,
      'turn/dice/rolled': false,
      'turn/dice/d1Used': false,
      'turn/dice/d2Used': false,
      'turn/startedAt':   firebase.database.ServerValue.TIMESTAMP,
    });

    localState.selectedDie   = null;
    localState.selectedPiece = null;
    return;
  }

  // Sin dobles o ya manejado el castigo → siguiente jugador
  await nextTurn(room);
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 10 — CAPTURAS (referencia cruzada)
   La lógica principal de capturas está en la Sección 9:
   - executeCapture()       → manda ficha rival a casa
   - checkCapturePossibility() → detecta si hay captura posible
   Esta sección contiene helpers adicionales de captura.
═══════════════════════════════════════════════════════════════════ */

/**
 * Obtiene todas las fichas rivales en una posición del camino principal.
 * Útil para debug y para mostrar en la UI qué fichas serían comidas.
 * @param {object} room
 * @param {number} ringIdx
 * @param {string} ownColor
 * @returns {Array<{playerId:string, pieceKey:string, color:string}>}
 */
function getRivalsAtRingIdx(room, ringIdx, ownColor) {
  if (!room.pieces || !room.players) return [];
  const rivals = [];

  for (const [pid, playerPieces] of Object.entries(room.pieces)) {
    const color = room.players[pid]?.color;
    if (!color || color === ownColor) continue;

    for (const key of ['p0','p1','p2','p3']) {
      const prog = playerPieces[key];
      if (prog >= 0 && prog < PATH_LENGTH) {
        if (getRingIndex(color, prog) === ringIdx) {
          rivals.push({ playerId: pid, pieceKey: key, color });
        }
      }
    }
  }
  return rivals;
}

/**
 * Cuenta cuántas fichas propias tiene un jugador en una casilla.
 * Si hay 2+, es un bloqueo propio (válido para él, bloquea rivales).
 * @param {object} room
 * @param {string} playerId
 * @param {number} ringIdx
 * @returns {number}
 */
function countOwnPiecesAtRingIdx(room, playerId, ringIdx) {
  if (!room.pieces || !room.pieces[playerId] || !room.players) return 0;
  const color = room.players[playerId]?.color;
  if (!color) return 0;

  let count = 0;
  for (const key of ['p0','p1','p2','p3']) {
    const prog = room.pieces[playerId][key];
    if (prog >= 0 && prog < PATH_LENGTH) {
      if (getRingIndex(color, prog) === ringIdx) count++;
    }
  }
  return count;
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 11 — BLOQUEOS (referencia cruzada)
   La validación de bloqueos está en la Sección 8:
   - isBlockedByRival()  → verifica bloqueo rival en ringIdx
   - isPathBlocked()     → verifica bloqueo en todo el camino
   Esta sección contiene helpers para mostrar bloqueos en la UI.
═══════════════════════════════════════════════════════════════════ */

/**
 * Devuelve todos los ringIdx que tienen bloqueos en el camino principal.
 * Un bloqueo es 2+ fichas del mismo color en la misma casilla.
 * Se usa para resaltar visualmente las casillas bloqueadas.
 * @param {object} room
 * @returns {Map<number, string>} ringIdx → color del bloqueador
 */
function getAllBlocks(room) {
  const blocks = new Map();
  if (!room.pieces || !room.players) return blocks;

  for (const [pid, playerPieces] of Object.entries(room.pieces)) {
    const color = room.players[pid]?.color;
    if (!color) continue;

    // Contar piezas del mismo color por ringIdx
    const ringCounts = {};
    for (const key of ['p0','p1','p2','p3']) {
      const prog = playerPieces[key];
      if (prog >= 0 && prog < PATH_LENGTH) {
        const idx = getRingIndex(color, prog);
        ringCounts[idx] = (ringCounts[idx] || 0) + 1;
      }
    }

    // Si hay 2+ en el mismo ringIdx → bloqueo
    for (const [idx, count] of Object.entries(ringCounts)) {
      if (count >= 2) blocks.set(Number(idx), color);
    }
  }
  return blocks;
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 12 — GESTIÓN DE TURNOS
   nextTurn(), punishTripleDoubles(), y helpers de orden de turno.
═══════════════════════════════════════════════════════════════════ */

/**
 * Pasa el turno al siguiente jugador conectado.
 * Salta jugadores desconectados.
 * Reinicia el estado de dados y bonus en Firebase.
 * @param {object} room - snapshot actual de la sala
 */
async function nextTurn(room) {
  if (!room || !room.players || !room.turn) return;

  // Obtener orden de jugadores por joinedAt
  const ordered = getPlayersOrdered(room);
  const currentIdx = ordered.findIndex(pid => pid === room.turn.playerId);

  // Buscar el siguiente jugador conectado
  let nextIdx = (currentIdx + 1) % ordered.length;
  let attempts = 0;

  while (attempts < ordered.length) {
    const candidate = ordered[nextIdx];
    if (room.players[candidate]?.connected !== false) break;
    nextIdx = (nextIdx + 1) % ordered.length;
    attempts++;
  }

  // Si no hay jugadores conectados (caso extremo), mantener turno actual
  if (attempts >= ordered.length) {
    console.warn('[nextTurn] No hay jugadores conectados.');
    return;
  }

  const nextPlayerId   = ordered[nextIdx];
  const nextPlayerName = room.players[nextPlayerId]?.name || 'Jugador';

  try {
    await roomRef().update({
      'turn/playerId':            nextPlayerId,
      'turn/startedAt':           firebase.database.ServerValue.TIMESTAMP,
      'turn/consecutiveDoubles':  0,
      'turn/lastMovedPiece':      null,
      'turn/dice/d1':             null,
      'turn/dice/d2':             null,
      'turn/dice/rolled':         false,
      'turn/dice/d1Used':         false,
      'turn/dice/d2Used':         false,
      'turn/bonus/active':        false,
      'turn/bonus/amount':        null,
      'turn/bonus/type':          null,
    });

    await addEvent(`▶️ Turno de ${nextPlayerName}.`, 'turn');
    console.log('[nextTurn] →', nextPlayerId, nextPlayerName);

  } catch (err) {
    console.error('[nextTurn]', err);
  }
}

/**
 * Castigo por triple doble: regresa la última ficha movida a casa.
 * DECISIÓN: Si la última ficha ya está en meta, busca la ficha
 * con mayor progress fuera de meta y la castiga.
 * Si no hay ninguna → el castigo no aplica (documentado).
 * @param {object} room - snapshot antes del castigo
 * @param {number} d1
 * @param {number} d2
 */
async function punishTripleDoubles(room, d1, d2) {
  const playerId   = localState.playerId;
  const playerName = localState.playerName;

  if (!room.pieces || !room.pieces[playerId]) {
    await nextTurn(room);
    return;
  }

  const pieces    = room.pieces[playerId];
  let targetKey   = room.turn.lastMovedPiece; // La última ficha movida

  // Si la última ficha ya está en meta → buscar la de mayor progress fuera de meta
  if (!targetKey || pieces[targetKey] === GOAL_PROGRESS) {
    let maxProg = -2;
    for (const k of ['p0','p1','p2','p3']) {
      const prog = pieces[k];
      if (prog !== GOAL_PROGRESS && prog > maxProg) {
        maxProg   = prog;
        targetKey = k;
      }
    }
  }

  // Si todas están en meta → no hay castigo posible
  if (!targetKey || pieces[targetKey] === GOAL_PROGRESS || pieces[targetKey] === HOME_PROGRESS) {
    await addEvent(`⚠️ Castigo no aplicable (fichas en casa o meta).`, 'system');
    await nextTurn(room);
    return;
  }

  const oldProgress = pieces[targetKey];

  try {
    // Regresar la ficha a casa
    await roomRef().update({
      [`pieces/${playerId}/${targetKey}`]: HOME_PROGRESS,
    });

    await addEvent(
      `💀 ¡CASTIGO! ${playerName} perdió ficha (de pos ${oldProgress} → casa) por 3 dobles seguidos.`,
      'capture'
    );

    // Pasar el turno (no hay tiro extra después del castigo)
    const freshRoom = (await roomRef().once('value')).val();
    await nextTurn(freshRoom);

  } catch (err) {
    console.error('[punishTripleDoubles]', err);
  }
}

/**
 * Devuelve los IDs de jugadores ordenados por joinedAt (ascendente).
 * Este es el orden de turno oficial de la partida.
 * @param {object} room
 * @returns {string[]} array de playerIds ordenados
 */
function getPlayersOrdered(room) {
  if (!room.players) return [];
  return Object.keys(room.players).sort((a, b) => {
    return (room.players[a].joinedAt || 0) - (room.players[b].joinedAt || 0);
  });
}

/**
 * Verifica si es el turno del jugador local.
 * @param {object} room
 * @returns {boolean}
 */
function isMyTurn(room) {
  return room?.turn?.playerId === localState.playerId;
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 13 — TIMER Y AUTO-MOVIMIENTO
   El timer corre en cada cliente pero solo el cliente del jugador
   activo ejecuta el auto-movimiento cuando llega a cero.
   DECISIÓN: Si el tiempo expira, el sistema mueve una ficha al azar.
═══════════════════════════════════════════════════════════════════ */

/**
 * Inicia el countdown local de 25 segundos.
 * Solo el jugador cuyo turno es ejecuta auto-acciones al expirar.
 * @param {object} room - snapshot actual
 */
function startLocalTimer(room) {
  clearTimer(); // Limpiar timer anterior si existía

  // Calcular cuánto tiempo queda basado en turn.startedAt
  const startedAt = room.turn?.startedAt || Date.now();
  const elapsed   = Math.floor((Date.now() - startedAt) / 1000);
  let remaining   = Math.max(0, TIMER_SECONDS - elapsed);

  localState.timerValue = remaining;
  updateTimerUI(remaining);

  if (remaining === 0) {
    // Ya expiró (ej: reconexión tardía)
    handleTimeout(room);
    return;
  }

  localState.timerInterval = setInterval(async () => {
    remaining--;
    localState.timerValue = remaining;
    updateTimerUI(remaining);

    if (remaining <= 0) {
      clearTimer();
      // Solo el jugador activo ejecuta el auto-movimiento
      if (isMyTurn(localState.room) && !localState.handlingTimeout) {
        localState.handlingTimeout = true;
        await handleTimeout(localState.room);
      }
    }
  }, 1000);
}

/**
 * Para y limpia el timer local.
 */
function clearTimer() {
  if (localState.timerInterval) {
    clearInterval(localState.timerInterval);
    localState.timerInterval = null;
  }
}

/**
 * Actualiza la barra y el número del timer en la UI.
 * @param {number} remaining - segundos restantes
 */
function updateTimerUI(remaining) {
  const bar     = document.getElementById('timer-bar');
  const display = document.getElementById('timer-display');
  if (!bar || !display) return;

  const pct = (remaining / TIMER_SECONDS) * 100;
  bar.style.width = pct + '%';
  display.textContent = remaining;

  // Cambiar color según urgencia
  bar.classList.remove('warning', 'danger');
  display.classList.remove('warning', 'danger');

  if (remaining <= 5) {
    bar.classList.add('danger');
    display.classList.add('danger');
  } else if (remaining <= 10) {
    bar.classList.add('warning');
    display.classList.add('warning');
  }
}

/**
 * Se ejecuta cuando el timer llega a cero.
 * DECISIÓN TOMADA: El sistema hace todo automáticamente de forma random.
 * - Si no tiró → tira los dados automáticamente.
 * - Si tiró pero no movió → mueve una ficha válida al azar.
 * - Si hay bonus → lo salta.
 * - Si los dados no tienen movimientos → pasa el turno.
 * @param {object} room - snapshot del momento del timeout
 */
async function handleTimeout(room) {
  if (!room || !room.turn) return;
  if (!isMyTurn(room)) return;

  console.log('[handleTimeout] Timer expirado. Auto-movimiento.');
  await addEvent(`⏱️ Tiempo agotado. El sistema actúa por ${localState.playerName}.`, 'system');

  try {
    // ── Caso 1: Bonus activo → saltarlo ──────────────────────────
    if (room.turn.bonus?.active || localState.bonusActive) {
      await skipBonus();
      return;
    }

    // ── Caso 2: No tiró los dados → tirar automáticamente ────────
    if (!room.turn.dice?.rolled) {
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;

      let consecutiveDoubles = room.turn.consecutiveDoubles || 0;
      const isDouble = (d1 === d2);
      if (isDouble) consecutiveDoubles++;

      await roomRef().update({
        'turn/dice/d1':              d1,
        'turn/dice/d2':              d2,
        'turn/dice/rolled':          true,
        'turn/dice/d1Used':          false,
        'turn/dice/d2Used':          false,
        'turn/consecutiveDoubles':   consecutiveDoubles,
      });

      // Si triple doble → castigar
      if (consecutiveDoubles >= MAX_CONSECUTIVE_DOUBLES) {
        const r2 = (await roomRef().once('value')).val();
        await punishTripleDoubles(r2, d1, d2);
        return;
      }

      // Verificar si hay movimientos con estos dados
      const r2 = (await roomRef().once('value')).val();
      const hasAny = checkAnyValidMove(r2, localState.playerId, d1, d2);
      if (!hasAny) {
        await addEvent('⏭️ Sin movimientos válidos. Turno saltado.', 'system');
        await nextTurn(r2);
        return;
      }

      // Continuar a auto-mover con los dados recién tirados
      await autoMoveRandom(r2);
      return;
    }

    // ── Caso 3: Ya tiró, pero no movió → auto-mover ──────────────
    await autoMoveRandom(room);

  } catch (err) {
    console.error('[handleTimeout]', err);
    // Fallback de seguridad: pasar el turno
    const r = (await roomRef().once('value')).val();
    if (r) await nextTurn(r);
  }
}

/**
 * Elige y ejecuta un movimiento válido al azar con los dados disponibles.
 * Primero intenta con d1, luego con d2.
 * @param {object} room
 */
async function autoMoveRandom(room) {
  if (!room.turn?.dice) return;

  const { d1, d2, d1Used, d2Used } = room.turn.dice;

  // Intentar con el primer dado disponible
  const diesToTry = [];
  if (!d1Used && d1 !== null) diesToTry.push({ value: d1, key: 'die1', usedKey: 'd1Used' });
  if (!d2Used && d2 !== null) diesToTry.push({ value: d2, key: 'die2', usedKey: 'd2Used' });

  for (const die of diesToTry) {
    const moves = getAllValidMoves(room, localState.playerId, die.value);
    if (moves.length > 0) {
      // Elegir una ficha al azar de las disponibles
      const chosen = moves[Math.floor(Math.random() * moves.length)];

      // Seleccionar el dado y la ficha en el estado local para reutilizar movePiece()
      localState.selectedDie   = die.key;
      localState.selectedPiece = chosen.pieceIdx;

      await movePiece(chosen.pieceIdx);
      return; // movePiece se encarga del resto (bonus, siguiente dado, etc.)
    }
  }

  // Si no hay ningún movimiento válido → pasar turno
  await addEvent('⏭️ Sin movimientos posibles. Turno saltado (auto).', 'system');
  await nextTurn(room);
}

/**
 * Auto-aplica el bonus a una ficha válida al azar.
 * Se llama desde handleTimeout cuando hay un bonus pendiente.
 * @param {object} room
 * @param {number} amount
 */
async function autoApplyBonus(room, amount) {
  const moves = getAllBonusMoves(room, localState.playerId, amount);
  if (moves.length === 0) {
    await skipBonus();
    return;
  }
  const chosen = moves[Math.floor(Math.random() * moves.length)];
  await applyBonus(chosen.pieceIdx);
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 14 — DETECCIÓN DE GANADOR
═══════════════════════════════════════════════════════════════════ */

/**
 * Verifica si un jugador tiene sus 4 fichas en la meta (progress = 57).
 * @param {object} room - snapshot actual
 * @param {string} playerId
 * @returns {boolean}
 */
function checkWinner(room, playerId) {
  if (!room.pieces || !room.pieces[playerId]) return false;

  const pieces = room.pieces[playerId];
  return (
    pieces.p0 === GOAL_PROGRESS &&
    pieces.p1 === GOAL_PROGRESS &&
    pieces.p2 === GOAL_PROGRESS &&
    pieces.p3 === GOAL_PROGRESS
  );
}

/**
 * Cuenta cuántas fichas de un jugador están en la meta.
 * Útil para la UI (indicadores de progreso por jugador).
 * @param {object} room
 * @param {string} playerId
 * @returns {number} 0-4
 */
function countPiecesAtGoal(room, playerId) {
  if (!room.pieces || !room.pieces[playerId]) return 0;
  const p = room.pieces[playerId];
  return [p.p0, p.p1, p.p2, p.p3].filter(v => v === GOAL_PROGRESS).length;
}

/**
 * Muestra el modal de ganador con el nombre y color del ganador.
 * @param {string} winnerId
 * @param {object} room
 */
function showWinner(winnerId, room) {
  const winner = room.players[winnerId];
  if (!winner) return;

  // Limpiar timer
  clearTimer();

  // Rellenar modal
  document.getElementById('winner-name').textContent = winner.name;
  const banner = document.getElementById('winner-color-banner');
  banner.className = 'winner-color-banner ' + winner.color;

  // Añadir el color al título
  const colorName = COLOR_NAME[winner.color] || winner.color;
  document.getElementById('winner-subtitle').textContent =
    `¡El equipo ${colorName} llevó sus 4 fichas a la meta!`;

  // Mostrar modal
  document.getElementById('winner-modal').style.display = 'flex';
  console.log('[showWinner]', winner.name, winner.color);
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 15 — RENDERIZADO DEL TABLERO
   Crea el grid 15×15, clasifica cada celda y coloca las fichas.
═══════════════════════════════════════════════════════════════════ */

/**
 * Crea el grid HTML del tablero (15×15 = 225 celdas).
 * Se llama UNA sola vez al entrar a la pantalla de juego.
 * Asigna clases CSS según el tipo de cada celda.
 */
function initBoard() {
  const board = document.getElementById('board');
  if (!board) return;
  board.innerHTML = '';

  for (let row = 0; row < 15; row++) {
    for (let col = 0; col < 15; col++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.col = col;
      cell.dataset.row = row;
      cell.dataset.cell = `${col},${row}`;

      // Aplicar clase de tipo de celda
      applyCellType(cell, col, row);

      const content = document.createElement('div');
      content.className = 'cell-content';
      cell.appendChild(content);

      board.appendChild(cell);
    }
  }
}

/**
 * Asigna la clase CSS correcta a una celda según su posición en el grid.
 * El orden de prioridad es importante (de mayor a menor):
 *   1. Meta (centro)
 *   2. Pasillo final de cada color
 *   3. Camino principal (safe, exit, normal)
 *   4. Casas de color (esquinas)
 *   5. Centro decorativo
 * @param {HTMLElement} cell
 * @param {number} col
 * @param {number} row
 */
function applyCellType(cell, col, row) {
  // ── 1. Meta ──────────────────────────────────────────────────
  if (col === 7 && row === 7) {
    cell.classList.add('cell-goal');
    return;
  }

  // ── 2. Pasillo final por color ────────────────────────────────
  for (const color of COLOR_ORDER) {
    const hs = HOME_STRETCH[color];
    for (let i = 0; i < hs.length; i++) {
      if (hs[i].col === col && hs[i].row === row) {
        cell.classList.add('cell-hs', `cell-hs-${color}`);
        return;
      }
    }
  }

  // ── 3. Camino principal ───────────────────────────────────────
  for (let idx = 0; idx < PATH_CELLS.length; idx++) {
    const pc = PATH_CELLS[idx];
    if (pc.col === col && pc.row === row) {
      cell.classList.add('cell-path');

      // ¿Es casilla segura?
      if (SAFE_CELLS.has(idx)) {
        cell.classList.add('cell-safe');
      }

      // ¿Es casilla de salida de algún color?
      for (const color of COLOR_ORDER) {
        if (EXIT_CELLS[color] === idx) {
          cell.classList.add(`cell-exit-${color}`);
        }
      }
      return;
    }
  }

  // ── 4. Casas de color (esquinas 6×6) ─────────────────────────
  // Rojo: rows 9-14, cols 0-5
  if (row >= 9 && row <= 14 && col >= 0 && col <= 5) {
    cell.classList.add('cell-home', 'cell-home-red');
    // Interior de la casita (zona donde se ponen las fichas en casa)
    if (row >= 9 && row <= 13 && col >= 1 && col <= 4) {
      cell.classList.add('cell-home-inner-red');
    }
    return;
  }
  // Azul: rows 9-14, cols 9-14
  if (row >= 9 && row <= 14 && col >= 9 && col <= 14) {
    cell.classList.add('cell-home', 'cell-home-blue');
    if (row >= 9 && row <= 13 && col >= 10 && col <= 13) {
      cell.classList.add('cell-home-inner-blue');
    }
    return;
  }
  // Amarillo: rows 0-5, cols 9-14
  if (row >= 0 && row <= 5 && col >= 9 && col <= 14) {
    cell.classList.add('cell-home', 'cell-home-yellow');
    if (row >= 1 && row <= 4 && col >= 10 && col <= 13) {
      cell.classList.add('cell-home-inner-yellow');
    }
    return;
  }
  // Verde: rows 0-5, cols 0-5
  if (row >= 0 && row <= 5 && col >= 0 && col <= 5) {
    cell.classList.add('cell-home', 'cell-home-green');
    if (row >= 1 && row <= 4 && col >= 1 && col <= 4) {
      cell.classList.add('cell-home-inner-green');
    }
    return;
  }

  // ── 5. Centro decorativo (la cruz central) ────────────────────
  if (row >= 6 && row <= 8 && col >= 6 && col <= 8) {
    cell.classList.add('cell-center');
    return;
  }

  // Celda vacía (no debería quedar ninguna sin clase)
  cell.classList.add('cell-empty');
}

/**
 * Construye un mapa de posición visual → fichas.
 * Clave: "col,row" | Valor: array de {color, playerId, pieceIdx, progress}
 * @param {object} room
 * @returns {Map<string, Array>}
 */
function buildCellPiecesMap(room) {
  const map = new Map();
  if (!room.pieces || !room.players) return map;

  for (const [pid, playerPieces] of Object.entries(room.pieces)) {
    const color = room.players[pid]?.color;
    if (!color) continue;

    for (let i = 0; i < PIECES_PER_PLAYER; i++) {
      const key      = 'p' + i;
      const progress = playerPieces[key];
      if (progress === undefined) continue;

      let pos;
      if (progress === HOME_PROGRESS) {
        // En casa → posición fija de la casita
        pos = HOME_POSITIONS[color][i];
      } else if (progress === GOAL_PROGRESS) {
        // En meta → centro
        pos = GOAL_POSITION;
      } else if (progress >= HOME_STRETCH_START) {
        // En pasillo final
        pos = HOME_STRETCH[color][progress - HOME_STRETCH_START];
      } else {
        // En camino principal
        const ringIdx = getRingIndex(color, progress);
        pos = PATH_CELLS[ringIdx];
      }

      if (!pos) continue;

      const cellKey = `${pos.col},${pos.row}`;
      if (!map.has(cellKey)) map.set(cellKey, []);
      map.get(cellKey).push({ color, playerId: pid, pieceIdx: i, progress });
    }
  }
  return map;
}

/**
 * Renderiza el tablero completo: coloca fichas, highlights y previews.
 * Se llama cada vez que Firebase envía un update.
 * @param {object} room
 */
function renderBoard(room) {
  if (!room) return;
  const board = document.getElementById('board');
  if (!board) return;

  // Limpiar contenido de todas las celdas y highlights
  board.querySelectorAll('.cell-content').forEach(c => {
    c.innerHTML = '';
    c.classList.remove('multi-piece', 'has-block');
  });
  board.querySelectorAll('.cell').forEach(c => {
    c.classList.remove('cell-valid', 'cell-preview', 'cell-blocked');
  });

  // Construir mapa de piezas
  const piecesMap = buildCellPiecesMap(room);
  const blocks    = getAllBlocks(room);

  // Calcular movimientos válidos para highlights
  let validDestinations = new Set();
  let previewDestination = null;

  if (isMyTurn(room) && room.turn?.dice?.rolled && !localState.bonusActive) {
    const dieKey   = localState.selectedDie;
    const dieValue = dieKey === 'die1'
      ? room.turn.dice.d1
      : dieKey === 'die2'
      ? room.turn.dice.d2
      : null;

    if (dieValue !== null) {
      const moves = getAllValidMoves(room, localState.playerId, dieValue);
      moves.forEach(m => validDestinations.add(m.pieceIdx));

      // Preview del destino de la ficha seleccionada
      if (localState.selectedPiece !== null) {
        const color = room.players[localState.playerId]?.color;
        const result = getValidMoveResult(room, localState.playerId, color, localState.selectedPiece, dieValue);
        if (result !== null) {
          let pos;
          if (result === GOAL_PROGRESS)           pos = GOAL_POSITION;
          else if (result >= HOME_STRETCH_START)  pos = HOME_STRETCH[color][result - HOME_STRETCH_START];
          else                                     pos = PATH_CELLS[getRingIndex(color, result)];
          if (pos) previewDestination = `${pos.col},${pos.row}`;
        }
      }
    }
  }

  // Highlights de bonus
  if (localState.bonusActive && isMyTurn(room)) {
    const moves = getAllBonusMoves(room, localState.playerId, localState.bonusAmount);
    moves.forEach(m => validDestinations.add(m.pieceIdx));
  }

  // Colocar bloqueos rivales en celdas del camino
  blocks.forEach((color, ringIdx) => {
    const pos = PATH_CELLS[ringIdx];
    if (!pos) return;
    const cellKey  = `${pos.col},${pos.row}`;
    const cell     = board.querySelector(`[data-cell="${cellKey}"]`);
    if (cell) cell.classList.add('cell-blocked');
  });

  // Colocar fichas en el tablero
  piecesMap.forEach((pieces, cellKey) => {
    const cell = board.querySelector(`[data-cell="${cellKey}"]`);
    if (!cell) return;
    const content = cell.querySelector('.cell-content');
    if (!content) return;

    if (pieces.length > 1) content.classList.add('multi-piece');

    pieces.forEach(({ color, playerId, pieceIdx, progress }) => {
      const piece = document.createElement('div');
      piece.className = `piece piece-${color}`;
      piece.dataset.pieceIdx  = pieceIdx;
      piece.dataset.playerId  = playerId;
      piece.title = `${room.players[playerId]?.name || ''} — Ficha ${pieceIdx + 1}`;

      // Tamaño especial en casa
      if (progress === HOME_PROGRESS) piece.classList.add('piece-in-home');
      if (progress === GOAL_PROGRESS) piece.classList.add('piece-at-goal');

      // ¿Es una ficha del jugador local válida para mover?
      const isOwn = (playerId === localState.playerId);
      if (isOwn && validDestinations.has(pieceIdx)) {
        piece.classList.add('piece-clickable', 'cell-valid');
        piece.addEventListener('click', () => onPieceClick(pieceIdx));
      }

      // ¿Es la ficha seleccionada?
      if (isOwn && localState.selectedPiece === pieceIdx) {
        piece.classList.add('piece-selected');
      }

      content.appendChild(piece);
    });

    // Indicador de bloqueo propio
    if (pieces.length >= 2 && pieces.every(p => p.playerId === pieces[0].playerId)) {
      content.classList.add('has-block');
    }
  });

  // Resaltar celda de destino (preview)
  if (previewDestination) {
    const cell = board.querySelector(`[data-cell="${previewDestination}"]`);
    if (cell) cell.classList.add('cell-preview');
  }
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 16 — RENDERIZADO DE LA INTERFAZ (UI)
   Actualiza el panel lateral: turno, dados, botones, jugadores.
═══════════════════════════════════════════════════════════════════ */

/**
 * Actualiza todo el panel lateral de la pantalla de juego.
 * Se llama cada vez que Firebase envía un update.
 * @param {object} room
 */
function renderUI(room) {
  if (!room) return;

  renderTurnInfo(room);
  renderDice(room);
  renderButtons(room);
  renderPlayersList(room);
  renderBonusPanel(room);
}

/**
 * Muestra el nombre del jugador activo y el código de sala.
 * @param {object} room
 */
function renderTurnInfo(room) {
  const nameEl   = document.getElementById('current-turn-name');
  const dotEl    = document.getElementById('current-turn-color-dot');
  const codeEl   = document.getElementById('panel-room-code');
  const dblEl    = document.getElementById('doubles-info');
  const dblCount = document.getElementById('doubles-count');

  if (codeEl) codeEl.textContent = localState.roomCode || '------';

  if (!room.turn) return;

  const currentPlayer = room.players[room.turn.playerId];
  if (nameEl && currentPlayer) {
    const isMe = (room.turn.playerId === localState.playerId);
    nameEl.textContent = isMe ? `${currentPlayer.name} (Tú)` : currentPlayer.name;
  }

  if (dotEl && currentPlayer) {
    dotEl.className = `color-dot ${currentPlayer.color}`;
  }

  // Mostrar contador de dobles si hay alguno
  const doubles = room.turn.consecutiveDoubles || 0;
  if (dblEl && dblCount) {
    dblEl.style.display = doubles > 0 ? 'block' : 'none';
    dblCount.textContent = doubles;
  }
}

/**
 * Renderiza los dados según su estado actual.
 * @param {object} room
 */
function renderDice(room) {
  const die1El = document.getElementById('die1');
  const die2El = document.getElementById('die2');
  if (!die1El || !die2El) return;

  // Resetear clases
  [die1El, die2El].forEach(el => {
    el.classList.remove('die-unrolled','die-available','die-selected','die-used','die-double');
    el.onclick = null;
  });

  if (!room.turn?.dice?.rolled) {
    // No se han tirado
    die1El.classList.add('die-unrolled');
    die2El.classList.add('die-unrolled');
    die1El.querySelector('.die-face').textContent = '?';
    die2El.querySelector('.die-face').textContent = '?';
    return;
  }

  const { d1, d2, d1Used, d2Used } = room.turn.dice;
  const isDouble = (d1 === d2);

  // Dado 1
  die1El.querySelector('.die-face').textContent = DICE_EMOJI[d1] || d1;
  if (d1Used) {
    die1El.classList.add('die-used');
  } else {
    die1El.classList.add('die-available');
    if (isDouble) die1El.classList.add('die-double');
    if (localState.selectedDie === 'die1') die1El.classList.add('die-selected');
    if (isMyTurn(room) && !localState.bonusActive) {
      die1El.onclick = () => onDieClick('die1', room);
    }
  }

  // Dado 2
  die2El.querySelector('.die-face').textContent = DICE_EMOJI[d2] || d2;
  if (d2Used) {
    die2El.classList.add('die-used');
  } else {
    die2El.classList.add('die-available');
    if (isDouble) die2El.classList.add('die-double');
    if (localState.selectedDie === 'die2') die2El.classList.add('die-selected');
    if (isMyTurn(room) && !localState.bonusActive) {
      die2El.onclick = () => onDieClick('die2', room);
    }
  }
}

/**
 * Muestra u oculta los botones según el estado del turno.
 * @param {object} room
 */
function renderButtons(room) {
  const btnRoll      = document.getElementById('btn-roll');
  const notYourTurn  = document.getElementById('not-your-turn-msg');
  const confirmSec   = document.getElementById('confirm-section');
  const previewText  = document.getElementById('move-preview-text');

  const myTurn    = isMyTurn(room);
  const rolled    = room.turn?.dice?.rolled || false;
  const hasBonus  = localState.bonusActive;

  // Botón "Tirar dados"
  if (btnRoll) {
    btnRoll.style.display = (myTurn && !rolled && !hasBonus) ? 'block' : 'none';
  }

  // Mensaje "Espera tu turno"
  if (notYourTurn) {
    notYourTurn.style.display = (!myTurn) ? 'block' : 'none';
  }

  // Sección de confirmación (aparece cuando hay dado Y ficha seleccionados)
  const showConfirm = myTurn && rolled && !hasBonus
    && localState.selectedDie !== null
    && localState.selectedPiece !== null;

  if (confirmSec) {
    confirmSec.style.display = showConfirm ? 'block' : 'none';
  }

  // Texto de preview del movimiento
  if (previewText && showConfirm && room.turn?.dice) {
    const dieVal   = localState.selectedDie === 'die1'
      ? room.turn.dice.d1 : room.turn.dice.d2;
    const color    = room.players[localState.playerId]?.color;
    const result   = getValidMoveResult(
      room, localState.playerId, color, localState.selectedPiece, dieVal
    );
    if (result !== null) {
      const dest = result === GOAL_PROGRESS ? '🏁 META'
        : result >= HOME_STRETCH_START ? `Pasillo (pos ${result})`
        : `Casilla ${result}`;
      previewText.textContent = `Ficha ${localState.selectedPiece + 1} → ${dest} con ${DICE_EMOJI[dieVal]}`;
    }
  }
}

/**
 * Renderiza la lista de jugadores en el panel lateral.
 * Muestra nombre, color, fichas en meta y si está desconectado.
 * @param {object} room
 */
function renderPlayersList(room) {
  const list = document.getElementById('players-list');
  if (!list || !room.players) return;

  const ordered = getPlayersOrdered(room);
  list.innerHTML = '';

  ordered.forEach(pid => {
    const player = room.players[pid];
    if (!player) return;

    const li = document.createElement('li');
    li.className = 'player-item';
    if (pid === room.turn?.playerId) li.classList.add('is-turn');
    if (pid === localState.playerId) li.classList.add('is-me');

    const atGoal   = countPiecesAtGoal(room, pid);
    const isDisc   = (player.connected === false);

    // Puntos mini de progreso de fichas
    const piecesHtml = Array.from({ length: PIECES_PER_PLAYER }, (_, i) => {
      const prog = room.pieces?.[pid]?.[`p${i}`];
      const atG  = (prog === GOAL_PROGRESS) ? 'at-goal' : '';
      return `<span class="piece-mini ${player.color} ${atG}"></span>`;
    }).join('');

    li.innerHTML = `
      <span class="player-color-swatch ${player.color}"></span>
      <span class="player-name-text">${escapeHtml(player.name)}${pid === localState.playerId ? ' <em style="opacity:.5;font-size:.75em">(tú)</em>' : ''}</span>
      <span class="player-pieces-mini">${piecesHtml}</span>
      ${isDisc ? '<span class="disconnected-badge">⚫</span>' : ''}
    `;
    list.appendChild(li);
  });
}

/**
 * Muestra u oculta el panel de bonus y actualiza su contenido.
 * @param {object} room
 */
function renderBonusPanel(room) {
  const panel = document.getElementById('bonus-panel');
  const icon  = document.getElementById('bonus-icon');
  const title = document.getElementById('bonus-title');
  const desc  = document.getElementById('bonus-description');
  if (!panel) return;

  const bonusActive = room.turn?.bonus?.active || localState.bonusActive;

  if (!bonusActive || !isMyTurn(room)) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';

  const amount = room.turn?.bonus?.amount || localState.bonusAmount;
  const type   = room.turn?.bonus?.type   || localState.bonusType;

  if (type === 'capture') {
    icon.textContent  = '💥';
    title.textContent = `¡Bonus de captura! (+${amount})`;
    if (desc) desc.textContent = `Elige una ficha para avanzar ${amount} casillas.`;
  } else {
    icon.textContent  = '🏁';
    title.textContent = `¡Bonus de meta! (+${amount})`;
    if (desc) desc.textContent = `Elige una ficha para avanzar ${amount} casillas.`;
  }
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 17 — UI DE LOBBY Y SALA DE ESPERA
═══════════════════════════════════════════════════════════════════ */

/**
 * Cambia la pantalla visible (solo una .screen a la vez tiene .active).
 * @param {string} screenId
 */
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
}

/**
 * Lleva al jugador a la sala de espera y llena los datos iniciales.
 * @param {string} roomCode
 */
function showWaitingRoom(roomCode) {
  showScreen('screen-waiting');

  // Código de sala
  const codeEl = document.getElementById('display-room-code');
  if (codeEl) codeEl.textContent = roomCode;

  // URL compartible
  const url   = getRoomUrl(roomCode);
  const urlEl = document.getElementById('display-room-url');
  if (urlEl) urlEl.textContent = url;
}

/**
 * Actualiza la sala de espera cuando llegan cambios de Firebase.
 * @param {object} room
 */
function updateWaitingRoomUI(room) {
  const players   = room.players || {};
  const playerIds = Object.keys(players);

  // Contador
  const countEl = document.getElementById('player-count');
  if (countEl) countEl.textContent = `${playerIds.length} / ${MAX_PLAYERS}`;

  // Lista de jugadores
  const list = document.getElementById('waiting-players');
  if (list) {
    list.innerHTML = '';
    const ordered = playerIds.sort((a,b) =>
      (players[a].joinedAt||0) - (players[b].joinedAt||0)
    );
    ordered.forEach(pid => {
      const p  = players[pid];
      const li = document.createElement('li');
      li.className = 'waiting-player-item';

      const isHost = (pid === room.hostId);
      const isMe   = (pid === localState.playerId);

      li.innerHTML = `
        <div class="player-color-badge ${p.color}"></div>
        <span class="player-name">${escapeHtml(p.name)}</span>
        ${isHost ? '<span class="host-badge">Anfitrión</span>' : ''}
        ${isMe   ? '<span class="you-badge">Tú</span>' : ''}
      `;
      list.appendChild(li);
    });
  }

  // Botón iniciar (solo host)
  const btnStart   = document.getElementById('btn-start');
  const startHint  = document.getElementById('start-hint');
  const waitingMsg = document.getElementById('waiting-for-host');

  if (localState.isHost) {
    if (btnStart) {
      btnStart.style.display = 'block';
      btnStart.disabled = (playerIds.length < MIN_PLAYERS);
    }
    if (startHint) startHint.style.display = playerIds.length < MIN_PLAYERS ? 'block' : 'none';
    if (waitingMsg) waitingMsg.style.display = 'none';
  } else {
    if (btnStart)   btnStart.style.display   = 'none';
    if (startHint)  startHint.style.display  = 'none';
    if (waitingMsg) waitingMsg.style.display = 'block';
  }
}

/**
 * Muestra un error en el lobby (desaparece a los 4 segundos).
 * @param {string} msg
 */
function showLobbyError(msg) {
  const el = document.getElementById('lobby-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

/**
 * Muestra un mensaje temporal durante la partida (3 segundos).
 * @param {string} msg
 */
function showGameMsg(msg) {
  const el = document.getElementById('game-msg');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

/**
 * Muestra el modal de "cargando".
 * @param {string} [text]
 */
function showLoadingModal(text) {
  const modal   = document.getElementById('loading-modal');
  const textEl  = document.getElementById('loading-modal-text');
  if (textEl && text) textEl.textContent = text;
  if (modal) modal.style.display = 'flex';
}

/** Oculta el modal de "cargando". */
function hideLoadingModal() {
  const modal = document.getElementById('loading-modal');
  if (modal) modal.style.display = 'none';
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 18 — LOG DE EVENTOS
═══════════════════════════════════════════════════════════════════ */

/**
 * Agrega un evento al log en Firebase.
 * @param {string} message
 * @param {string} [type] - 'capture'|'bonus'|'goal'|'doubles'|'turn'|'system'
 */
async function addEvent(message, type) {
  if (!localState.roomCode || !localState.db) return;
  const key = Date.now() + '_' + Math.random().toString(36).substr(2,4);
  try {
    await localState.db.ref(`rooms/${localState.roomCode}/events/${key}`).set({
      msg:  message,
      type: type || 'turn',
      ts:   firebase.database.ServerValue.TIMESTAMP,
    });
  } catch (err) {
    console.warn('[addEvent]', err.message);
  }
}

/**
 * Renderiza el log de eventos en el panel lateral.
 * Muestra los últimos 20 eventos.
 * @param {object} events - objeto de Firebase con los eventos
 */
function updateEventLog(events) {
  const log = document.getElementById('event-log');
  if (!log) return;

  if (!events) {
    log.innerHTML = '<li class="event-item text-muted">Sin eventos aún...</li>';
    return;
  }

  // Ordenar por timestamp (los más recientes primero)
  const sorted = Object.values(events)
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    .slice(0, 20);

  log.innerHTML = sorted.map(e => {
    const typeClass = e.type ? `event-${e.type}` : '';
    return `<li class="event-item ${typeClass}">${escapeHtml(e.msg || String(e))}</li>`;
  }).join('');
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 19 — FUNCIONES DE UTILIDAD
═══════════════════════════════════════════════════════════════════ */

/**
 * Retorna el nombre de un jugador dado su ID.
 * @param {string} playerId
 * @param {object} room
 * @returns {string}
 */
function getPlayerName(playerId, room) {
  return room?.players?.[playerId]?.name || 'Jugador';
}

/**
 * Retorna el color hex de un color de jugador.
 * @param {string} color
 * @returns {string}
 */
function getColorHex(color) {
  return COLOR_HEX[color] || '#888';
}

/**
 * Escapa caracteres HTML para prevenir XSS en contenido dinámico.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Copia un texto al portapapeles y muestra retroalimentación al usuario.
 * @param {string} text
 * @param {HTMLElement} btn - botón que se presionó (para feedback visual)
 */
async function copyToClipboard(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    if (btn) {
      const original = btn.textContent;
      btn.textContent = '✅';
      setTimeout(() => { btn.textContent = original; }, 1500);
    }
  } catch {
    // Fallback para navegadores sin clipboard API
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity  = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    if (btn) {
      const original = btn.textContent;
      btn.textContent = '✅';
      setTimeout(() => { btn.textContent = original; }, 1500);
    }
  }
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 20 — MANEJADORES DE EVENTOS (CLICS DE UI)
═══════════════════════════════════════════════════════════════════ */

/**
 * El jugador hace clic en un dado para seleccionarlo.
 * @param {string} dieKey - 'die1' o 'die2'
 * @param {object} room
 */
function onDieClick(dieKey, room) {
  if (!isMyTurn(room)) return;
  if (!room.turn?.dice?.rolled) return;
  if (localState.bonusActive) return;

  const usedKey = dieKey === 'die1' ? 'd1Used' : 'd2Used';
  if (room.turn.dice[usedKey]) return; // Ya usado

  // Si hace clic en el mismo dado → deseleccionar
  if (localState.selectedDie === dieKey) {
    localState.selectedDie   = null;
    localState.selectedPiece = null;
  } else {
    localState.selectedDie   = dieKey;
    localState.selectedPiece = null; // Limpiar ficha al cambiar dado
  }

  renderBoard(room);
  renderButtons(room);
  renderDice(room);
}

/**
 * El jugador hace clic en una ficha del tablero.
 * @param {number} pieceIdx
 */
function onPieceClick(pieceIdx) {
  const room = localState.room;
  if (!room || !isMyTurn(room)) return;

  // Si hay bonus activo → esta ficha es candidata a recibir el bonus
  if (localState.bonusActive) {
    localState.selectedPiece = pieceIdx;
    renderBoard(room);
    // Mostrar botón de confirmar bonus
    const confirmSec = document.getElementById('confirm-section');
    if (confirmSec) confirmSec.style.display = 'block';
    const previewText = document.getElementById('move-preview-text');
    if (previewText) {
      previewText.textContent = `Aplicar +${localState.bonusAmount} a ficha ${pieceIdx + 1}`;
    }
    return;
  }

  if (!localState.selectedDie) {
    showGameMsg('Primero selecciona un dado.');
    return;
  }

  // Seleccionar / deseleccionar ficha
  if (localState.selectedPiece === pieceIdx) {
    localState.selectedPiece = null;
  } else {
    localState.selectedPiece = pieceIdx;
  }

  renderBoard(room);
  renderButtons(room);
}

/**
 * El jugador confirma el movimiento (botón "Confirmar movimiento").
 */
async function onConfirmMove() {
  const room = localState.room;
  if (!room) return;

  // Modo bonus
  if (localState.bonusActive) {
    if (localState.selectedPiece === null) {
      showGameMsg('Selecciona una ficha para el bonus.');
      return;
    }
    await applyBonus(localState.selectedPiece);
    localState.selectedPiece = null;
    return;
  }

  // Modo movimiento normal
  if (localState.selectedDie === null || localState.selectedPiece === null) {
    showGameMsg('Selecciona un dado y una ficha.');
    return;
  }

  await movePiece(localState.selectedPiece);
  localState.selectedPiece = null;
}

/**
 * El jugador cancela la selección de ficha.
 */
function onCancelMove() {
  localState.selectedPiece = null;
  const room = localState.room;
  if (room) {
    renderBoard(room);
    renderButtons(room);
  }
}

/**
 * Registra todos los event listeners de la UI de una vez.
 * Se llama una sola vez en DOMContentLoaded.
 */
function registerUIListeners() {

  // ── Lobby ─────────────────────────────────────────────────────
  document.getElementById('btn-create')?.addEventListener('click', () => {
    const name = document.getElementById('create-name')?.value || '';
    createRoom(name);
  });

  document.getElementById('create-name')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-create')?.click();
  });

  document.getElementById('btn-join')?.addEventListener('click', () => {
    const name = document.getElementById('join-name')?.value || '';
    const code = document.getElementById('join-code')?.value || '';
    joinRoom(code, name);
  });

  document.getElementById('join-code')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-join')?.click();
  });

  document.getElementById('join-name')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-join')?.click();
  });

  // Código en URL → pre-llenar el campo de código
  const urlCode = getUrlRoomCode();
  if (urlCode) {
    const joinCodeEl = document.getElementById('join-code');
    if (joinCodeEl) joinCodeEl.value = urlCode;
  }

  // Reconexión
  document.getElementById('btn-reconnect')?.addEventListener('click', () => {
    attemptReconnect();
  });

  document.getElementById('btn-clear-session')?.addEventListener('click', () => {
    clearSession();
    document.getElementById('reconnect-panel').style.display = 'none';
  });

  // ── Sala de espera ─────────────────────────────────────────────
  document.getElementById('btn-start')?.addEventListener('click', () => {
    startGame();
  });

  document.getElementById('btn-copy-code')?.addEventListener('click', (e) => {
    const code = document.getElementById('display-room-code')?.textContent || '';
    copyToClipboard(code, e.currentTarget);
  });

  document.getElementById('btn-copy-url')?.addEventListener('click', (e) => {
    const url = document.getElementById('display-room-url')?.textContent || '';
    copyToClipboard(url, e.currentTarget);
  });

  document.getElementById('btn-leave-waiting')?.addEventListener('click', () => {
    if (confirm('¿Seguro que quieres salir de la sala?')) {
      clearSession();
      if (activeRoomListener && localState.roomCode) {
        localState.db?.ref('rooms/' + localState.roomCode).off('value', activeRoomListener);
      }
      showScreen('screen-lobby');
    }
  });

  // ── Pantalla de juego ──────────────────────────────────────────
  document.getElementById('btn-roll')?.addEventListener('click', () => {
    rollDice();
  });

  document.getElementById('btn-confirm')?.addEventListener('click', () => {
    onConfirmMove();
  });

  document.getElementById('btn-cancel-move')?.addEventListener('click', () => {
    onCancelMove();
  });

  document.getElementById('btn-skip-bonus')?.addEventListener('click', () => {
    skipBonus();
  });

  // ── Modal ganador ──────────────────────────────────────────────
  document.getElementById('btn-new-game')?.addEventListener('click', () => {
    // Recargar la página vuelve al lobby limpio
    window.location.href = window.location.origin + window.location.pathname;
  });
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 21 — RECONEXIÓN
   Detecta sesión guardada en localStorage y ofrece reconectarse.
═══════════════════════════════════════════════════════════════════ */

/**
 * Revisa si hay datos de sesión en localStorage.
 * Si los hay, muestra el panel de reconexión en el lobby.
 */
function checkStoredSession() {
  const storedCode = localStorage.getItem('parchis_roomCode');
  const storedName = localStorage.getItem('parchis_playerName');

  if (!storedCode || !storedName) return;

  // Mostrar panel de reconexión
  const panel = document.getElementById('reconnect-panel');
  const info  = document.getElementById('reconnect-info');
  if (panel) panel.style.display = 'block';
  if (info)  info.textContent    = `Sala: ${storedCode} · Nombre: ${storedName}`;
}

/**
 * Intenta reconectarse a la sala guardada en localStorage.
 * Verifica que la sala exista y que el playerId sea válido.
 */
async function attemptReconnect() {
  const storedCode = localStorage.getItem('parchis_roomCode');
  const storedName = localStorage.getItem('parchis_playerName');

  if (!storedCode || !storedName) {
    showLobbyError('No hay sesión guardada para reconectar.');
    return;
  }

  if (!localState.playerId) {
    showLobbyError('Esperando conexión con Firebase...');
    return;
  }

  showLoadingModal('Reconectando...');

  try {
    const snap = await localState.db.ref('rooms/' + storedCode).once('value');

    if (!snap.exists()) {
      hideLoadingModal();
      showLobbyError('La sala ya no existe. Empieza una nueva partida.');
      clearSession();
      document.getElementById('reconnect-panel').style.display = 'none';
      return;
    }

    const room = snap.val();
    hideLoadingModal();
    await reconnectToRoom(storedCode, storedName, room);

  } catch (err) {
    hideLoadingModal();
    showLobbyError('Error al reconectar: ' + err.message);
    console.error('[attemptReconnect]', err);
  }
}

/**
 * Si la URL tiene ?room=CODIGO, pre-intenta reconexión automática
 * o muestra la opción de unirse.
 */
async function handleUrlRoom() {
  const urlCode = getUrlRoomCode();
  if (!urlCode) return;

  // Pre-llenar el campo de código en el lobby
  const joinCodeEl = document.getElementById('join-code');
  if (joinCodeEl) joinCodeEl.value = urlCode;

  // Si hay sesión guardada para esta sala → ofrecer reconexión
  const storedCode = localStorage.getItem('parchis_roomCode');
  const storedName = localStorage.getItem('parchis_playerName');

  if (storedCode === urlCode && storedName && localState.playerId) {
    // Intentar reconexión automática silenciosa
    try {
      const snap = await localState.db.ref('rooms/' + urlCode).once('value');
      if (snap.exists()) {
        const room = snap.val();
        if (room.players?.[localState.playerId]) {
          await reconnectToRoom(urlCode, storedName, room);
          return;
        }
      }
    } catch (err) {
      console.warn('[handleUrlRoom] Reconexión automática fallida:', err.message);
    }
  }
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 22 — INICIALIZACIÓN
   Punto de entrada de la aplicación.
═══════════════════════════════════════════════════════════════════ */

/**
 * Punto de entrada principal.
 * Orden: Firebase → listeners UI → sesión guardada → URL room.
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[App] Iniciando Parchís Online...');

  // 1. Registrar todos los event listeners de la UI
  registerUIListeners();

  // 2. Inicializar Firebase (auth + database)
  await initFirebase();

  // 3. Esperar a que Firebase Auth resuelva el UID
  //    (onAuthStateChanged es asíncrono, damos un momento)
  await new Promise(resolve => {
    if (localState.playerId) {
      resolve();
    } else {
      const unsubscribe = localState.auth?.onAuthStateChanged(() => {
        unsubscribe?.();
        resolve();
      });
      // Fallback timeout: si auth tarda más de 3 segundos, continuar de todas formas
      setTimeout(resolve, 3000);
    }
  });

  // 4. Verificar si hay sesión guardada → mostrar panel de reconexión
  checkStoredSession();

  // 5. Si la URL tiene ?room=, manejarlo (pre-llenar o reconectar)
  await handleUrlRoom();

  // 6. Listo — la pantalla de lobby ya es visible (es la .screen.active por defecto)
  console.log('[App] Listo. PlayerId:', localState.playerId);
});

// ── Parche de renderizado del log ──────────────────────────────────
// El onRoomUpdate recibe room.events pero la sección de listener
// llama a renderUI que no actualiza el log. Lo actualizamos aquí
// enganchando al final de onRoomUpdate.
const _origOnRoomUpdate = onRoomUpdate;
window.onRoomUpdate = function(room) {
  _origOnRoomUpdate(room);
  if (room.events) updateEventLog(room.events);
};
// Reasignar la función exportada
