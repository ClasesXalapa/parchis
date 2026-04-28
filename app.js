/* ═══════════════════════════════════════════════════════════════════
   PARCHÍS ONLINE v2 — app.js
   Lógica principal del juego. Depende de:
   - board.js        → geometría del tablero
   - special-cells.js → sistema de casillas especiales
   - wildcards.js    → sistema de comodines
   - events.js       → sistema de eventos

   SECCIONES:
    1.  Constantes y configuración
    2.  Estado local
    3.  Firebase init
    4.  Creación y unión a salas
    5.  Configuración de partida (host)
    6.  Listener Firebase en tiempo real
    7.  Inicio de partida                  ← paso 7
    8.  Sistema de dados                   ← paso 7
    9.  Validación de movimientos          ← paso 7
    10. Preview de movimiento              ← paso 8
    11. Ejecución de movimientos           ← paso 8
    12. Sistema de capturas                ← paso 8
    13. Casillas especiales                ← paso 9
    14. Sistema de comodines               ← paso 9
    15. Sistema de eventos                 ← paso 9
    16. Números y casillas de salida       ← paso 9
    17. Gestión de turnos                  ← paso 10
    18. Timer y auto-movimiento            ← paso 10
    19. Fin de partida y ranking           ← paso 10
    20. Renderizado del tablero            ← paso 11
    21. Renderizado de UI y paneles        ← paso 11
    22. Renderizado de comodines           ← paso 11
    23. UI de lobby, config y espera       ← paso 12
    24. Log de eventos                     ← paso 12
    25. Utilidades                         ← paso 12
    26. Manejadores de eventos (clics)     ← paso 12
    27. Reconexión                         ← paso 12
    28. Inicialización                     ← paso 12
═══════════════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 1 — CONSTANTES Y CONFIGURACIÓN
   Modificar aquí para ajustar reglas sin buscar en el código.
═══════════════════════════════════════════════════════════════════ */

// ── Tiempo y jugabilidad ─────────────────────────────────────────
const TIMER_SECONDS_DEFAULT    = 25;   // ← Tiempo por turno (configurable por host)
const MAX_CONSECUTIVE_SIXES    = 3;    // ← Triple 6 = castigo
const CAPTURE_BONUS_TURNS      = 1;    // ← Turnos extra por comer una ficha
const DEFAULT_EXIT_NUMBERS_ARR = [1, 6]; // ← Números de salida iniciales

// ── Sala ─────────────────────────────────────────────────────────
const MAX_PLAYERS_GLOBAL   = 4;
const MIN_PLAYERS_GLOBAL   = 2;
const MIN_PLAYERS_WILD     = 3;   // Modo Wild requiere mínimo 3 jugadores
const FB_ROOMS_PATH        = 'rooms';

// ── Duración de mensajes en pantalla ─────────────────────────────
const MSG_DURATION_MS        = 3000;
const EVENT_BANNER_DURATION  = 3500; // Cuánto tiempo se muestra el banner de evento
const EVENT_LOG_MAX          = 30;   // Máximo de eventos en el log

// ── Emojis de dados ───────────────────────────────────────────────
const DICE_EMOJI = { 1:'⚀', 2:'⚁', 3:'⚂', 4:'⚃', 5:'⚄', 6:'⚅' };

// ── Modos de juego ────────────────────────────────────────────────
const GAME_MODES = {
  CLASSIC: 'classic',
  RACE:    'race',
  WILD:    'wild',
};


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 2 — ESTADO LOCAL
   Solo vive en el cliente. Nunca se sube a Firebase.
   Se resetea entre partidas.
═══════════════════════════════════════════════════════════════════ */
const localState = {
  // ── Identidad del jugador ──────────────────────────────────────
  playerId:     null,    // UID de Firebase Auth anónimo (o fallback localStorage)
  roomCode:     null,    // Código de sala activa
  playerName:   null,    // Nombre del jugador local
  playerColor:  null,    // Color asignado ('blue','yellow','red','green')
  isHost:       false,   // ¿Es el creador de la sala?

  // ── Snapshot de Firebase ───────────────────────────────────────
  room: null,            // Snapshot más reciente de la sala

  // ── UI de selección de movimiento ──────────────────────────────
  selectedPieceIdx:  null,  // Índice (0-3) de la ficha seleccionada para mover
  previewProgress:   null,  // Progress destino para el preview

  // ── UI de comodines ────────────────────────────────────────────
  activeWildcard:    null,  // Tipo de comodín siendo usado ('discard','dir_attack',etc.)
  shieldTargetMode:  false, // true cuando el jugador está eligiendo ficha para el escudo

  // ── Control del timer ──────────────────────────────────────────
  timerInterval:    null,
  timerValue:       TIMER_SECONDS_DEFAULT,
  handlingTimeout:  false,  // Anti-duplicación de auto-movimiento

  // ── Anti-duplicación de turno ──────────────────────────────────
  lastTurnStartedAt: null,  // Para detectar cambio de turno por startedAt

  // ── Configuración temporal (solo en pantalla config) ───────────
  pendingConfig: {
    gameMode:       GAME_MODES.CLASSIC,
    maxPlayers:     3,
    timerSeconds:   TIMER_SECONDS_DEFAULT,
    positiveCells:  3,
    negativeCells:  2,
  },

  // ── Referencias de Firebase ────────────────────────────────────
  db:   null,
  auth: null,
};


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 3 — FIREBASE INIT
═══════════════════════════════════════════════════════════════════ */

/**
 * Inicializa Firebase App, Auth anónimo y Database.
 * Si el auth falla usa un ID de localStorage como fallback.
 */
async function initFirebase() {
  if (window.FIREBASE_CONFIG_MISSING || typeof FIREBASE_CONFIG === 'undefined') {
    document.getElementById('firebase-error').style.display = 'block';
    console.error('[Firebase] firebase-config.js no encontrado o mal configurado.');
    return;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    localState.auth = firebase.auth();
    localState.db   = firebase.database();

    await localState.auth.signInAnonymously();

    localState.auth.onAuthStateChanged((user) => {
      if (user) {
        const stored = localStorage.getItem('parchis_v2_playerId');
        if (!stored) {
          localState.playerId = user.uid;
          localStorage.setItem('parchis_v2_playerId', user.uid);
        } else {
          localState.playerId = stored;
        }
        console.log('[Firebase] Auth OK. PlayerId:', localState.playerId);
      }
    });

  } catch (err) {
    console.warn('[Firebase] Auth anónimo falló, usando fallback:', err.message);
    let fallbackId = localStorage.getItem('parchis_v2_playerId');
    if (!fallbackId) {
      fallbackId = 'p_' + Math.random().toString(36).substr(2, 12);
      localStorage.setItem('parchis_v2_playerId', fallbackId);
    }
    localState.playerId = fallbackId;
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    localState.db = firebase.database();
  }
}

/** Retorna referencia al nodo de la sala actual (o al código dado). */
function roomRef(code) {
  return localState.db.ref(`${FB_ROOMS_PATH}/${code || localState.roomCode}`);
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 4 — CREACIÓN Y UNIÓN A SALAS
═══════════════════════════════════════════════════════════════════ */

/**
 * Genera un código de sala de 6 caracteres sin caracteres confusos.
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/**
 * El host crea una nueva sala y va a la pantalla de configuración.
 * @param {string} playerName
 */
async function createRoom(playerName) {
  if (!localState.playerId) { showLobbyError('Error de conexión. Recarga la página.'); return; }
  playerName = playerName.trim();
  if (!playerName) { showLobbyError('Escribe tu nombre para crear una sala.'); return; }

  showLoadingModal('Creando sala...');

  // Generar código único
  let code = generateRoomCode();
  for (let i = 0; i < 5; i++) {
    const snap = await localState.db.ref(`${FB_ROOMS_PATH}/${code}`).once('value');
    if (!snap.exists()) break;
    code = generateRoomCode();
  }

  localState.roomCode   = code;
  localState.playerName = playerName;
  localState.playerColor = COLOR_ORDER[0]; // El host siempre es azul
  localState.isHost     = true;

  const now = firebase.database.ServerValue.TIMESTAMP;

  const roomData = {
    status:    'config',   // Empieza en config (host configura antes de espera)
    hostId:    localState.playerId,
    createdAt: now,
    players: {
      [localState.playerId]: {
        name:       playerName,
        color:      COLOR_ORDER[0],
        connected:  true,
        joinedAt:   now,
        lastSeen:   now,
        eliminated: false,
        position:   null,
      }
    },
  };

  try {
    await localState.db.ref(`${FB_ROOMS_PATH}/${code}`).set(roomData);
    saveSession(code, playerName, localState.playerId, true);
    setupPresence(code, localState.playerId);
    hideLoadingModal();
    // El host va a la pantalla de configuración (NO a sala de espera)
    showScreen('screen-config');
  } catch (err) {
    hideLoadingModal();
    showLobbyError('Error al crear la sala: ' + err.message);
    console.error('[createRoom]', err);
  }
}

/**
 * Un jugador se une a una sala existente.
 * @param {string} roomCode
 * @param {string} playerName
 */
async function joinRoom(roomCode, playerName) {
  if (!localState.playerId) { showLobbyError('Error de conexión. Recarga la página.'); return; }

  roomCode   = (roomCode || '').trim().toUpperCase();
  playerName = (playerName || '').trim();

  if (!roomCode || roomCode.length !== 6) { showLobbyError('Código de sala inválido (6 caracteres).'); return; }
  if (!playerName) { showLobbyError('Escribe tu nombre para unirte.'); return; }

  showLoadingModal('Uniéndote a la sala...');

  try {
    const snap = await localState.db.ref(`${FB_ROOMS_PATH}/${roomCode}`).once('value');

    if (!snap.exists()) {
      hideLoadingModal();
      showLobbyError('Sala no encontrada. Verifica el código.');
      return;
    }

    const room = snap.val();

    // ── Reconexión: el jugador ya estaba en la sala ────────────
    if (room.players?.[localState.playerId]) {
      hideLoadingModal();
      await reconnectToRoom(roomCode, playerName, room);
      return;
    }

    // ── Validaciones ───────────────────────────────────────────
    if (room.status === 'playing' || room.status === 'finished') {
      hideLoadingModal();
      showLobbyError('La partida ya inició. No puedes unirte.');
      return;
    }

    const players   = room.players || {};
    const playerIds = Object.keys(players);
    const maxPlayers = room.config?.maxPlayers || MAX_PLAYERS_GLOBAL;

    if (playerIds.length >= maxPlayers) {
      hideLoadingModal();
      showLobbyError(`La sala está llena (máximo ${maxPlayers} jugadores).`);
      return;
    }

    // ── Asignar color disponible ────────────────────────────────
    const usedColors = Object.values(players).map(p => p.color);
    const color = COLOR_ORDER.find(c => !usedColors.includes(c));
    if (!color) {
      hideLoadingModal();
      showLobbyError('No hay colores disponibles.');
      return;
    }

    const now = firebase.database.ServerValue.TIMESTAMP;
    await localState.db.ref(`${FB_ROOMS_PATH}/${roomCode}/players/${localState.playerId}`).set({
      name:       playerName,
      color,
      connected:  true,
      joinedAt:   now,
      lastSeen:   now,
      eliminated: false,
      position:   null,
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
 * Reconecta a un jugador que ya estaba en la sala.
 * @param {string} roomCode
 * @param {string} playerName
 * @param {object} room - snapshot de Firebase
 */
async function reconnectToRoom(roomCode, playerName, room) {
  const player = room.players[localState.playerId];

  localState.roomCode    = roomCode;
  localState.playerName  = player.name || playerName;
  localState.playerColor = player.color;
  localState.isHost      = (room.hostId === localState.playerId);

  await localState.db.ref(`${FB_ROOMS_PATH}/${roomCode}/players/${localState.playerId}`).update({
    connected: true,
    lastSeen:  firebase.database.ServerValue.TIMESTAMP,
  });

  saveSession(roomCode, localState.playerName, localState.playerId, localState.isHost);
  setupPresence(roomCode, localState.playerId);
  console.log('[reconnectToRoom] Reconectado. Color:', localState.playerColor);

  if (room.status === 'playing') {
    showScreen('screen-game');
    initBoard(); // CRÍTICO: siempre reiniciar el tablero al reconectar
    if (room) { renderBoard(room); renderAllPanels(room); }
    startTurnLogic(room);
  } else if (room.status === 'waiting' || room.status === 'config') {
    showWaitingRoom(roomCode);
  } else if (room.status === 'finished') {
    showScreen('screen-game');
    showFinalResults(room);
  }

  subscribeToRoom(roomCode);
}

/**
 * Configura la presencia en Firebase.
 * Al desconectarse, marca al jugador como offline automáticamente.
 */
function setupPresence(roomCode, playerId) {
  const connRef = localState.db.ref(`${FB_ROOMS_PATH}/${roomCode}/players/${playerId}/connected`);
  const seenRef = localState.db.ref(`${FB_ROOMS_PATH}/${roomCode}/players/${playerId}/lastSeen`);

  connRef.onDisconnect().set(false);
  seenRef.onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);
  connRef.set(true);
  seenRef.set(firebase.database.ServerValue.TIMESTAMP);

  // Heartbeat cada 30 segundos
  setInterval(() => {
    if (localState.roomCode === roomCode) {
      seenRef.set(firebase.database.ServerValue.TIMESTAMP).catch(() => {});
    }
  }, 30000);
}

/** Guarda la sesión en localStorage para reconexión. */
function saveSession(roomCode, playerName, playerId, isHost) {
  localStorage.setItem('parchis_v2_roomCode',   roomCode);
  localStorage.setItem('parchis_v2_playerName', playerName);
  localStorage.setItem('parchis_v2_playerId',   playerId);
  localStorage.setItem('parchis_v2_isHost',     isHost ? 'true' : 'false');
}

/** Borra la sesión de sala del localStorage. */
function clearSession() {
  localStorage.removeItem('parchis_v2_roomCode');
  localStorage.removeItem('parchis_v2_playerName');
}

/** Lee el código de sala del parámetro ?room= en la URL. */
function getUrlRoomCode() {
  return new URLSearchParams(window.location.search).get('room')?.toUpperCase() || null;
}

/** Genera la URL compartible de una sala. */
function getRoomUrl(code) {
  return `${window.location.origin}${window.location.pathname}?room=${code}`;
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 5 — CONFIGURACIÓN DE PARTIDA (HOST)
   El host configura el modo, jugadores y parámetros
   antes de que los demás entren a la sala de espera.
═══════════════════════════════════════════════════════════════════ */

/**
 * El host confirma la configuración y avanza a la sala de espera.
 * Escribe la config en Firebase y cambia status a 'waiting'.
 */
async function confirmConfig() {
  if (!localState.isHost) return;

  const config = localState.pendingConfig;

  // Validar modo Wild requiere mínimo 3 jugadores
  if (config.gameMode === GAME_MODES.WILD && config.maxPlayers < MIN_PLAYERS_WILD) {
    showLobbyError(`El modo Wild requiere mínimo ${MIN_PLAYERS_WILD} jugadores.`);
    return;
  }

  showLoadingModal('Creando sala de espera...');

  try {
    await roomRef().update({
      'status':                'waiting',
      'config/gameMode':       config.gameMode,
      'config/maxPlayers':     config.maxPlayers,
      'config/timerSeconds':   config.timerSeconds,
      'config/positiveCells':  config.positiveCells,
      'config/negativeCells':  config.negativeCells,
    });

    hideLoadingModal();
    showWaitingRoom(localState.roomCode);
    subscribeToRoom(localState.roomCode);

  } catch (err) {
    hideLoadingModal();
    showLobbyError('Error al guardar la configuración: ' + err.message);
    console.error('[confirmConfig]', err);
  }
}

/**
 * Actualiza la configuración pendiente cuando el host cambia opciones en la UI.
 * Se llama desde los event listeners de los controles de configuración.
 * @param {string} key - clave en pendingConfig
 * @param {*} value
 */
function updatePendingConfig(key, value) {
  localState.pendingConfig[key] = value;

  // Mostrar/ocultar sección de casillas especiales según el modo
  const cellsSection = document.getElementById('config-cells-section');
  if (cellsSection) {
    const showCells = ['race', 'wild'].includes(localState.pendingConfig.gameMode);
    cellsSection.style.display = showCells ? 'block' : 'none';
  }
}

/**
 * Lee los valores actuales de los controles de configuración de la UI.
 * Se llama antes de confirmarConfig() para sincronizar pendingConfig.
 */
function syncConfigFromUI() {
  const timerEl    = document.getElementById('config-timer');
  const posEl      = document.getElementById('config-positive-cells');
  const negEl      = document.getElementById('config-negative-cells');

  if (timerEl) localState.pendingConfig.timerSeconds  = parseInt(timerEl.value, 10) || TIMER_SECONDS_DEFAULT;
  if (posEl)   localState.pendingConfig.positiveCells = parseInt(posEl.value, 10)   || 3;
  if (negEl)   localState.pendingConfig.negativeCells = parseInt(negEl.value, 10)   || 2;
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 6 — LISTENER DE FIREBASE EN TIEMPO REAL
═══════════════════════════════════════════════════════════════════ */

let activeRoomListener = null;

/**
 * Suscribe al snapshot de la sala. Cada cambio dispara onRoomUpdate().
 * @param {string} roomCode
 */
function subscribeToRoom(roomCode) {
  // Cancelar listener anterior si existía
  if (activeRoomListener) {
    localState.db.ref(`${FB_ROOMS_PATH}/${localState.roomCode || roomCode}`)
      .off('value', activeRoomListener);
    activeRoomListener = null;
  }

  activeRoomListener = localState.db.ref(`${FB_ROOMS_PATH}/${roomCode}`)
    .on('value', (snap) => {
      if (!snap.exists()) {
        showLobbyError('La sala fue eliminada.');
        showScreen('screen-lobby');
        clearSession();
        return;
      }
      const room = snap.val();
      localState.room = room;
      onRoomUpdate(room);
    }, (err) => {
      console.error('[Firebase listener]', err);
    });
}

/**
 * Despacha los updates de Firebase a la pantalla correcta.
 * @param {object} room - snapshot completo de Firebase
 */
function onRoomUpdate(room) {
  // Actualizar log de eventos siempre
  if (room.eventLog) updateEventLog(room.eventLog);

  const screen = document.querySelector('.screen.active')?.id;

  // ── Sala de espera ─────────────────────────────────────────────
  if (screen === 'screen-waiting') {
    updateWaitingRoomUI(room);
    if (room.status === 'playing') {
      showScreen('screen-game');
      const bd = document.getElementById('board');
      if (!bd || bd.children.length === 0) initBoard();
      renderBoard(room);
      renderAllPanels(room);
      startTurnLogic(room);
    }
    return;
  }

  // ── Pantalla de juego ──────────────────────────────────────────
  if (screen === 'screen-game') {
    if (room.status === 'finished') {
      clearTimer();
      renderBoard(room);
      renderAllPanels(room);
      showFinalResults(room);
      return;
    }

    renderBoard(room);
    renderAllPanels(room);

    // Detectar cambio de turno por startedAt
    if (room.turn?.startedAt && room.turn.startedAt !== localState.lastTurnStartedAt) {
      localState.lastTurnStartedAt = room.turn.startedAt;
      localState.handlingTimeout   = false;
      localState.selectedPieceIdx  = null;
      localState.previewProgress   = null;
      localState.activeWildcard    = null;
      localState.shieldTargetMode  = false;
      startLocalTimer(room);
    }
    return;
  }

  // ── Pantalla de configuración ──────────────────────────────────
  if (screen === 'screen-config') {
    // Si la sala pasa a waiting (otro admin cambió algo) → ir a espera
    if (room.status === 'waiting') {
      showWaitingRoom(localState.roomCode);
    }
    return;
  }

  // ── Lobby (reconexión tardía) ──────────────────────────────────
  if (room.status === 'playing') {
    showScreen('screen-game');
    const boardEl = document.getElementById('board');
    if (!boardEl || boardEl.children.length === 0) initBoard();
    renderBoard(room);
    renderAllPanels(room);
    startTurnLogic(room);
  }
}

/**
 * Evalúa el estado del turno al iniciar o reconectar.
 * @param {object} room
 */
function startTurnLogic(room) {
  if (!room?.turn) return;
  renderAllPanels(room);
  if (isMyTurn(room)) {
    console.log('[Turno] Es MI turno:', localState.playerColor);
  } else {
    console.log('[Turno] Turno de:', room.players?.[room.turn.playerId]?.name);
  }
}

/**
 * Retorna los jugadores ordenados por joinedAt.
 * @param {object} room
 * @param {boolean} excludeEliminated
 * @returns {string[]}
 */
function getPlayersOrdered(room, excludeEliminated = false) {
  if (!room.players) return [];
  return Object.keys(room.players)
    .filter(pid => !excludeEliminated || !room.players[pid].eliminated)
    .sort((a, b) => (room.players[a].joinedAt || 0) - (room.players[b].joinedAt || 0));
}

/**
 * Retorna true si es el turno del jugador local.
 * @param {object} room
 * @returns {boolean}
 */
function isMyTurn(room) {
  return room?.turn?.playerId === localState.playerId;
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 7 — INICIO DE PARTIDA
═══════════════════════════════════════════════════════════════════ */

/**
 * El host inicia la partida.
 * - Valida mínimo de jugadores
 * - Inicializa piezas, stats, casillas especiales
 * - Elige el primer jugador al azar
 * - Escribe el estado inicial en Firebase
 */
async function startGame() {
  const room = localState.room;
  if (!room || room.hostId !== localState.playerId) return;

  const players   = room.players || {};
  const playerIds = getPlayersOrdered(room);
  const config    = room.config || {};
  const gameMode  = config.gameMode || GAME_MODES.CLASSIC;
  const maxP      = config.maxPlayers || MAX_PLAYERS_GLOBAL;

  if (playerIds.length < MIN_PLAYERS_GLOBAL) {
    showLobbyError(`Necesitas al menos ${MIN_PLAYERS_GLOBAL} jugadores.`);
    return;
  }
  if (gameMode === GAME_MODES.WILD && playerIds.length < MIN_PLAYERS_WILD) {
    showLobbyError(`El modo Wild requiere mínimo ${MIN_PLAYERS_WILD} jugadores.`);
    return;
  }

  showLoadingModal('Iniciando partida...');

  try {
    // ── Primer jugador al azar ───────────────────────────────────
    const firstIdx      = Math.floor(Math.random() * playerIds.length);
    const firstPlayerId = playerIds[firstIdx];
    const now           = firebase.database.ServerValue.TIMESTAMP;

    // ── Inicializar piezas (-1 = base) ───────────────────────────
    const pieces = {};
    for (const pid of playerIds) {
      pieces[pid] = { p0: HOME_PROGRESS, p1: HOME_PROGRESS, p2: HOME_PROGRESS, p3: HOME_PROGRESS };
    }

    // ── Inicializar stats por jugador ────────────────────────────
    const playerStats = {};
    for (const pid of playerIds) {
      const color = players[pid].color;
      playerStats[pid] = {
        piecesEaten:    0,
        piecesSentBack: 0,
        exitNumbers:    [...DEFAULT_EXIT_NUMBERS_ARR],
        exitCells: {
          main:   EXIT_CELL_INDEX[color],
          extras: [],
        },
        wildcards: {
          [WILDCARD_TYPES.DISCARD]:     0,
          [WILDCARD_TYPES.ACME_SHIELD]: 0,
          [WILDCARD_TYPES.DIR_ATTACK]:  0,
        },
        shieldedPieces: [],
        piecesInGoal:   0,
      };
    }

    // ── Generar casillas especiales (solo Race y Wild) ───────────
    let specialCells = {};
    if (gameMode === GAME_MODES.RACE || gameMode === GAME_MODES.WILD) {
      specialCells = generateSpecialCells(
        config.positiveCells || 3,
        config.negativeCells || 2,
        [] // Al inicio no hay fichas en el camino
      );
    }

    // ── Estado global de la partida ──────────────────────────────
    const globalStats = {
      totalPiecesInGoal: 0,
      totalTurns:        0,
      firstToGoalDone:   false,
      dirAttackUsed:     false,
    };

    const updates = {
      'status':       'playing',
      'winner':       null,
      'pieces':       pieces,
      'playerStats':  playerStats,
      'specialCells': specialCells,
      'globalStats':  globalStats,
      'firedEvents':  {},
      'turn': {
        playerId:          firstPlayerId,
        startedAt:         now,
        consecutiveSixes:  0,
        bonusTurns:        0,
        lastMovedPiece:    null,
        diceValue:         null,
        rolled:            false,
        loseTurnPending:   false,
      },
      [`eventLog/${Date.now()}_start`]: {
        msg:  `🎮 ¡Partida iniciada! Modo: ${gameMode.toUpperCase()}. Primer turno: ${players[firstPlayerId]?.name} (aleatorio)`,
        type: 'system',
        ts:   now,
      },
    };

    await roomRef().update(updates);
    hideLoadingModal();
    console.log('[startGame] Partida iniciada. Primer jugador:', firstPlayerId);

  } catch (err) {
    hideLoadingModal();
    showLobbyError('Error al iniciar: ' + err.message);
    console.error('[startGame]', err);
  }
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 8 — SISTEMA DE DADOS
═══════════════════════════════════════════════════════════════════ */

/**
 * El jugador local tira el dado.
 * Genera un valor aleatorio 1-6, actualiza Firebase y
 * verifica si hay movimientos válidos.
 */
async function rollDice() {
  const room = localState.room;
  if (!room || !isMyTurn(room)) return;
  if (room.turn?.rolled) return; // Ya tiró este turno

  const value = Math.floor(Math.random() * 6) + 1;
  await _applyDiceRoll(value, room);
}

/**
 * Aplica el resultado de un dado (real o de Descarte).
 * Actualiza Firebase, maneja 6 consecutivos y verifica movimientos.
 * @param {number} value - resultado del dado (1-6)
 * @param {object} room  - snapshot actual
 */
async function _applyDiceRoll(value, room) {
  let consecutiveSixes = room.turn?.consecutiveSixes || 0;
  if (value === 6) consecutiveSixes++;

  const playerName = localState.playerName;

  try {
    await roomRef().update({
      'turn/diceValue':         value,
      'turn/rolled':            true,
      'turn/consecutiveSixes':  consecutiveSixes,
    });

    await addGameEvent(
      `🎲 ${playerName} sacó ${DICE_EMOJI[value] || value}${value === 6 ? ' (¡6!)' : ''}`,
      value === 6 ? 'event-six' : 'event-turn'
    );

    // ── Triple 6: castigo ────────────────────────────────────────
    if (consecutiveSixes >= MAX_CONSECUTIVE_SIXES) {
      await addGameEvent(`⚠️ ¡${playerName} sacó 6 tres veces seguidas! CASTIGO.`, 'event-six');
      await applyTripleSixPunishment(room);
      return;
    }

    // ── Verificar si hay movimientos válidos ─────────────────────
    const freshRoom = (await roomRef().once('value')).val();
    const validMoves = getValidMovesForDice(freshRoom, localState.playerId, value);

    if (validMoves.length === 0) {
      showGameMsg('Sin movimientos válidos. El turno pasa automáticamente.');
      await addGameEvent(`⏭️ ${playerName} no tiene movimientos válidos. Turno saltado.`, 'event-turn');
      await nextTurn(localState.playerId);
    }

  } catch (err) {
    console.error('[rollDice]', err);
  }
}

/**
 * Aplica el castigo por triple 6:
 * La última ficha movida en el camino regresa a la base.
 * @param {object} room
 */
async function applyTripleSixPunishment(room) {
  const pid          = localState.playerId;
  const lastKey      = room.turn?.lastMovedPiece; // 'p0','p1','p2','p3'
  const pieces       = room.pieces?.[pid];
  let   targetKey    = null;

  // Buscar la última ficha movida (debe estar en camino, no en meta)
  if (lastKey && pieces && isOnMainPath(pieces[lastKey])) {
    targetKey = lastKey;
  } else {
    // Si la última está en meta o no se encuentra, buscar la de mayor progress en camino
    let maxProgress = -1;
    for (const k of ['p0','p1','p2','p3']) {
      const prog = pieces?.[k];
      if (isOnMainPath(prog) && prog > maxProgress) {
        maxProgress = prog;
        targetKey   = k;
      }
    }
  }

  if (targetKey && pieces) {
    const oldProgress = pieces[targetKey];
    await roomRef().update({
      [`pieces/${pid}/${targetKey}`]: HOME_PROGRESS,
      'turn/consecutiveSixes':        0,
    });
    await addGameEvent(
      `💀 CASTIGO: La ficha ${PIECE_LETTERS[parseInt(targetKey[1])]} de ${localState.playerName} regresa a la base (desde pos ${oldProgress}).`,
      'event-six'
    );
  }

  // Pasar turno después del castigo
  const freshRoom = (await roomRef().once('value')).val();
  await nextTurn(localState.playerId);
}

/**
 * Verifica si el jugador puede usar el comodín Descarte
 * (después de tirar, antes de mover).
 * @param {object} room
 * @returns {boolean}
 */
function canUseDiscard(room) {
  if (!isMyTurn(room)) return false;
  if (!room.turn?.rolled) return false;                     // Aún no tiró
  if (localState.selectedPieceIdx !== null) return false;   // Ya eligió ficha
  const wildcards = room.playerStats?.[localState.playerId]?.wildcards;
  return hasWildcard(wildcards, WILDCARD_TYPES.DISCARD);
}

/**
 * Activa el comodín Descarte: descarta el dado actual y vuelve a tirar.
 */
async function activateDiscard() {
  const room = localState.room;
  if (!room || !canUseDiscard(room)) return;

  const oldValue  = room.turn?.diceValue;
  const wildcards = room.playerStats?.[localState.playerId]?.wildcards || {};
  const newWildcards = consumeWildcard(wildcards, WILDCARD_TYPES.DISCARD);

  // Resetear el dado en Firebase (el jugador vuelve a tirar)
  await roomRef().update({
    'turn/rolled':    false,
    'turn/diceValue': null,
    [`playerStats/${localState.playerId}/wildcards`]: newWildcards,
  });

  await addGameEvent(
    `🎲 ${localState.playerName} usó DESCARTE (dado ${DICE_EMOJI[oldValue] || oldValue} descartado). Vuelve a tirar.`,
    'event-wildcard'
  );

  // El jugador verá el botón de tirar dado de nuevo
  // El nuevo resultado puede ser 6 (turno extra), conserva todas las ventajas
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 9 — VALIDACIÓN DE MOVIMIENTOS
   Funciones puras que calculan qué movimientos son válidos.
═══════════════════════════════════════════════════════════════════ */

/**
 * Retorna todos los movimientos válidos para el jugador dado
 * con el valor del dado actual.
 * @param {object} room
 * @param {string} playerId
 * @param {number} diceValue
 * @returns {Array<{pieceIdx, resultProgress, isExit, captureInfo}>}
 */
function getValidMovesForDice(room, playerId, diceValue) {
  const color      = room.players?.[playerId]?.color;
  const stats      = room.playerStats?.[playerId];
  if (!color || !stats) return [];

  const exitNumbers = stats.exitNumbers || DEFAULT_EXIT_NUMBERS_ARR;
  const exitCells   = stats.exitCells   || { main: EXIT_CELL_INDEX[color], extras: [] };
  const pieces      = room.pieces?.[playerId];
  if (!pieces) return [];

  const moves = [];

  for (let i = 0; i < PIECES_PER_PLAYER; i++) {
    const progress = pieces['p' + i];

    // ── Ficha en meta: no se mueve ───────────────────────────────
    if (isAtGoal(progress)) continue;

    // ── Ficha en base: necesita número de salida ─────────────────
    if (isAtHome(progress)) {
      if (!exitNumbers.includes(diceValue)) continue;

      // Verificar si la casilla de salida principal está libre
      // (con la opción de elegir entre varias salidas si hay extras)
      const availableExits = getAvailableExitCells(room, playerId, color, exitCells);
      if (availableExits.length === 0) continue; // Todas las salidas ocupadas por propia ficha

      // Para cada casilla de salida disponible, agregar un movimiento
      for (const exitRingIdx of availableExits) {
        const resultProgress = ringIndexToProgress(color, exitRingIdx);
        const captureInfo    = checkCaptureAt(room, exitRingIdx, color);
        moves.push({
          pieceIdx:       i,
          resultProgress,
          isExit:         true,
          exitRingIdx,
          captureInfo,
          fromHome:       true,
        });
      }
      continue;
    }

    // ── Ficha en camino o pasillo: calcular destino ───────────────
    const resultProgress = calculateTargetProgress(
      color, progress, diceValue, exitCells, null
    );
    if (resultProgress === null) continue;

    // Verificar que la celda destino está libre (no hay otra ficha propia)
    if (!isDestinationFree(room, playerId, color, resultProgress)) continue;

    // Info de captura si aplica (solo en camino principal)
    let captureInfo = null;
    if (isOnMainPath(resultProgress)) {
      const destRingIdx = getRingIndex(color, resultProgress);
      captureInfo       = checkCaptureAt(room, destRingIdx, color);
    }

    moves.push({
      pieceIdx: i,
      resultProgress,
      isExit:   false,
      captureInfo,
      fromHome: false,
    });
  }

  return moves;
}

/**
 * Retorna las casillas de salida disponibles para un jugador.
 * Excluye casillas ya ocupadas por fichas propias.
 * (Una ficha rival en la salida SÍ puede ser comida → es válida)
 * @param {object} room
 * @param {string} playerId
 * @param {string} color
 * @param {object} exitCells - { main, extras }
 * @returns {number[]} array de ringIdxs disponibles
 */
function getAvailableExitCells(room, playerId, color, exitCells) {
  const allExits = [exitCells.main, ...(exitCells.extras || [])];
  const pieces   = room.pieces?.[playerId];
  if (!pieces) return allExits;

  // Verificar qué salidas no están bloqueadas por fichas propias
  return allExits.filter(ringIdx => {
    // ¿Hay una ficha propia en esta casilla?
    for (let i = 0; i < PIECES_PER_PLAYER; i++) {
      const prog = pieces['p' + i];
      if (isOnMainPath(prog) && getRingIndex(color, prog) === ringIdx) {
        return false; // Bloqueada por ficha propia (no puede haber 2 en la misma casilla)
      }
    }
    return true;
  });
}

/**
 * Verifica si una casilla de destino está libre para que llegue una ficha.
 * Una casilla está bloqueada solo si hay una ficha PROPIA ahí (no rival).
 * @param {object} room
 * @param {string} playerId - jugador que mueve
 * @param {string} color
 * @param {number} resultProgress - progress destino
 * @returns {boolean} true si puede aterrizar ahí
 */
function isDestinationFree(room, playerId, color, resultProgress) {
  if (!isOnMainPath(resultProgress) && !isInHomeStretch(resultProgress)) return true;

  // En el pasillo de meta: verificar que no hay ficha propia ahí
  if (isInHomeStretch(resultProgress)) {
    const pieces = room.pieces?.[playerId];
    if (!pieces) return true;
    for (let i = 0; i < PIECES_PER_PLAYER; i++) {
      if (pieces['p' + i] === resultProgress) return false;
    }
    return true;
  }

  // En camino principal: verificar que no hay ninguna ficha (propia o rival)
  // REGLA: en ninguna casilla del camino común puede haber 2 fichas simultáneas
  const destRingIdx = getRingIndex(color, resultProgress);

  for (const [pid, pcs] of Object.entries(room.pieces || {})) {
    const pColor = room.players?.[pid]?.color;
    if (!pColor) continue;
    for (let i = 0; i < PIECES_PER_PLAYER; i++) {
      const prog = pcs['p' + i];
      if (!isOnMainPath(prog)) continue;
      if (getRingIndex(pColor, prog) === destRingIdx) {
        // Si es ficha propia: movimiento inválido siempre
        if (pid === playerId) return false;
        // Si es ficha rival: válido SOLO si no es casilla segura
        // (la captura se maneja en checkCaptureAt; aquí solo bloqueamos
        //  si hay 2+ fichas rivales distintas en la misma casilla, imposible por diseño)
      }
    }
  }
  return true;
}

/**
 * Verifica si hay una ficha rival capturable en un ringIdx.
 * Retorna info de captura o null si no hay.
 * No hay captura si la casilla es SAFE o si la ficha tiene Escudo Acme.
 * @param {object} room
 * @param {number} ringIdx
 * @param {string} attackerColor
 * @returns {{victimId, victimPieceKey, victimProgress, shielded}|null}
 */
function checkCaptureAt(room, ringIdx, attackerColor) {
  if (!room.pieces || !room.players) return null;
  const specialCells = room.specialCells || {};

  // Casilla SAFE: no hay captura
  if (isSafeCell(specialCells, ringIdx)) return null;

  for (const [pid, pieces] of Object.entries(room.pieces)) {
    const color = room.players[pid]?.color;
    if (!color || color === attackerColor) continue;

    for (const key of ['p0','p1','p2','p3']) {
      const prog = pieces[key];
      if (!isOnMainPath(prog)) continue;
      if (getRingIndex(color, prog) !== ringIdx) continue;

      // Verificar Escudo Acme en la ficha
      const pieceIdx      = parseInt(key[1]);
      const shieldedPieces = room.playerStats?.[pid]?.shieldedPieces || [];
      const shielded       = shieldedPieces.includes(pieceIdx);

      return {
        victimId:       pid,
        victimPieceKey: key,
        victimProgress: prog,
        victimColor:    color,
        shielded,
      };
    }
  }
  return null;
}

/**
 * Retorna el progress resultante de la ficha especificada con el dado actual.
 * Devuelve null si el movimiento no es válido.
 * @param {object} room
 * @param {string} playerId
 * @param {number} pieceIdx
 * @param {number} diceValue
 * @param {number|null} chosenExitRingIdx - si viene de base, la salida elegida
 * @returns {number|null}
 */
function getResultProgressForPiece(room, playerId, pieceIdx, diceValue, chosenExitRingIdx = null) {
  const validMoves = getValidMovesForDice(room, playerId, diceValue);
  const match = validMoves.find(m => {
    if (m.pieceIdx !== pieceIdx) return false;
    if (m.fromHome && chosenExitRingIdx !== null) {
      return m.exitRingIdx === chosenExitRingIdx;
    }
    return true;
  });
  return match ? match.resultProgress : null;
}

/**
 * Retorna true si hay al menos un movimiento válido con el dado dado.
 * @param {object} room
 * @param {string} playerId
 * @param {number} diceValue
 * @returns {boolean}
 */
function hasAnyValidMove(room, playerId, diceValue) {
  return getValidMovesForDice(room, playerId, diceValue).length > 0;
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 10 — PREVIEW DE MOVIMIENTO
   El jugador toca una ficha → aparece ficha transparente en el destino.
   Toca la misma ficha de nuevo (o botón Confirmar) → ejecuta el movimiento.
═══════════════════════════════════════════════════════════════════ */

/**
 * El jugador toca una ficha en el tablero.
 * - Primera vez: selecciona y muestra preview
 * - Segunda vez en la misma: confirma el movimiento
 * - Diferente ficha: cambia la selección
 * @param {string} playerId - propietario de la ficha tocada
 * @param {number} pieceIdx - índice de la ficha (0-3)
 */
function onPieceTap(playerId, pieceIdx) {
  const room = localState.room;
  if (!room || !isMyTurn(room)) return;

  // Solo puede tocar sus propias fichas (salvo en modo shield)
  if (localState.shieldTargetMode) {
    onShieldPieceSelected(pieceIdx);
    return;
  }
  if (playerId !== localState.playerId) return;
  if (!room.turn?.rolled) {
    showGameMsg('Primero tira el dado.');
    return;
  }
  if (localState.activeWildcard) return; // Esperando confirmar comodín

  const diceValue = room.turn?.diceValue;
  if (!diceValue) return;

  // ── Modo bonus activo (aún no implementado en esta sección) ────
  // Se maneja en la sección 13 (casillas especiales)

  // ── Si ya había ficha seleccionada y es la misma → confirmar ──
  if (localState.selectedPieceIdx === pieceIdx) {
    confirmMove();
    return;
  }

  // ── Verificar que la ficha tiene movimiento válido ─────────────
  const validMoves = getValidMovesForDice(room, localState.playerId, diceValue);
  const matchingMoves = validMoves.filter(m => m.pieceIdx === pieceIdx);

  if (matchingMoves.length === 0) {
    showGameMsg('Esa ficha no puede moverse con este dado.');
    return;
  }

  // Si la ficha está en base y hay múltiples salidas disponibles → modal de elección
  if (matchingMoves[0].fromHome && matchingMoves.length > 1) {
    localState.selectedPieceIdx = pieceIdx;
    showExitChoiceModal(matchingMoves);
    return;
  }

  // Seleccionar ficha y mostrar preview
  localState.selectedPieceIdx = pieceIdx;
  localState.previewProgress  = matchingMoves[0].resultProgress;
  localState.selectedExitRingIdx = matchingMoves[0].exitRingIdx || null;

  // Solo renderizar preview — el botón fijo de la barra de acción confirma
  renderBoard(room);
  renderTurnControls(room);
}

/**
 * Muestra el modal de elegir casilla de salida.
 * @param {Array} exitMoves - movimientos disponibles desde base con diferentes salidas
 */
function showExitChoiceModal(exitMoves) {
  const room    = localState.room;
  const modal   = document.getElementById('modal-exit-choice');
  const options = document.getElementById('exit-options');
  if (!modal || !options) return;

  options.innerHTML = '';

  exitMoves.forEach((move, idx) => {
    const btn = document.createElement('button');
    btn.className = 'exit-option-btn';
    const pos     = PATH_CELLS[move.exitRingIdx];
    const isMain  = move.exitRingIdx === EXIT_CELL_INDEX[room.players?.[localState.playerId]?.color];
    btn.innerHTML = `
      <span>${isMain ? '🏠 Salida principal' : `🚪 Salida extra ${idx}`}</span>
      <span style="font-size:.8rem;color:var(--text-muted)">Casilla ${move.exitRingIdx}${move.captureInfo ? ' ⚔️ Come rival' : ''}</span>
    `;
    btn.addEventListener('click', () => {
      modal.style.display = 'none';
      localState.previewProgress     = move.resultProgress;
      localState.selectedExitRingIdx = move.exitRingIdx;
      renderBoard(room);
      renderTurnControls(room);
    });
    options.appendChild(btn);
  });

  modal.style.display = 'flex';
}

// showConfirmModal eliminado: el botón fijo de la barra de acción reemplaza el modal.

/**
 * El jugador confirma el movimiento (botón Confirmar o segundo toque).
 */
async function confirmMove() {
  const room = localState.room;
  if (!room || !isMyTurn(room)) return;

  const pieceIdx     = localState.selectedPieceIdx;
  const exitRingIdx  = localState.selectedExitRingIdx || null;
  if (pieceIdx === null) return;

  // No hay modal que cerrar — se usa el botón fijo de la barra de acción

  // Limpiar selección
  localState.selectedPieceIdx    = null;
  localState.previewProgress     = null;
  localState.selectedExitRingIdx = null;

  await movePiece(pieceIdx, exitRingIdx);
}

/**
 * Cancela la selección actual.
 */
function cancelMove() {
  localState.selectedPieceIdx    = null;
  localState.previewProgress     = null;
  localState.selectedExitRingIdx = null;
  const room = localState.room;
  if (room) { renderBoard(room); renderTurnControls(room); }
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 11 — EJECUCIÓN DE MOVIMIENTOS
═══════════════════════════════════════════════════════════════════ */

/**
 * Ejecuta el movimiento de una ficha.
 * Actualiza Firebase y desencadena capturas, casillas especiales, eventos.
 * @param {number} pieceIdx - índice de la ficha (0-3)
 * @param {number|null} chosenExitRingIdx - ringIdx de salida elegida (si viene de base)
 */
async function movePiece(pieceIdx, chosenExitRingIdx = null) {
  const room = localState.room;
  if (!room || !isMyTurn(room)) return;

  const color      = room.players?.[localState.playerId]?.color;
  const stats      = room.playerStats?.[localState.playerId];
  const diceValue  = room.turn?.diceValue;
  const pieceKey   = 'p' + pieceIdx;
  if (!color || !stats || !diceValue) return;

  const currentProgress = room.pieces?.[localState.playerId]?.[pieceKey];
  if (currentProgress === undefined) return;

  // Calcular progress destino
  let resultProgress;
  if (isAtHome(currentProgress)) {
    // Viene de base: el exitRingIdx elegido determina el progress
    const ringIdx    = chosenExitRingIdx ?? stats.exitCells.main;
    resultProgress   = ringIndexToProgress(color, ringIdx);
  } else {
    resultProgress = calculateTargetProgress(
      color, currentProgress, diceValue, stats.exitCells, null
    );
  }

  if (resultProgress === null) { showGameMsg('Movimiento inválido.'); return; }

  const playerName = localState.playerName;

  try {
    // ── 1. Actualizar posición de la ficha ─────────────────────
    await roomRef().update({
      [`pieces/${localState.playerId}/${pieceKey}`]: resultProgress,
      'turn/lastMovedPiece':                         pieceKey,
    });

    // Log del movimiento
    const fromLabel = isAtHome(currentProgress) ? 'base' : `pos ${currentProgress}`;
    const toLabel   = isAtGoal(resultProgress)  ? '¡META!' : `pos ${resultProgress}`;
    await addGameEvent(`♟️ ${playerName} (${PIECE_LETTERS[pieceIdx]}) ${fromLabel} → ${toLabel}`, 'event-turn');

    // Leer estado fresco para las siguientes verificaciones
    let freshRoom = (await roomRef().once('value')).val();

    // ── 2. Verificar captura ────────────────────────────────────
    if (isOnMainPath(resultProgress)) {
      const destRingIdx = getRingIndex(color, resultProgress);
      const captureInfo = checkCaptureAt(freshRoom, destRingIdx, color);
      if (captureInfo) {
        freshRoom = await executeCapture(captureInfo, playerName, pieceIdx);
      }
    }

    // ── 3. Verificar casilla especial ───────────────────────────
    if (isOnMainPath(resultProgress)) {
      const destRingIdx   = getRingIndex(color, resultProgress);
      const specialCell   = getSpecialCellAt(freshRoom.specialCells || {}, destRingIdx);
      if (specialCell) {
        freshRoom = await activateSpecialCellOnPiece(specialCell, destRingIdx, pieceIdx, resultProgress, freshRoom);
        // La ficha puede haber cambiado de posición por el efecto
        resultProgress = freshRoom?.pieces?.[localState.playerId]?.[pieceKey] ?? resultProgress;
      }
    }

    // ── 4. Verificar llegada a meta ──────────────────────────────
    if (isAtGoal(resultProgress)) {
      freshRoom = await handlePieceReachGoal(pieceIdx, freshRoom);
      if (!freshRoom) return; // La partida terminó
    }

    // ── 5. Verificar eventos del juego ───────────────────────────
    freshRoom = (await roomRef().once('value')).val();
    await checkAndProcessEvents(freshRoom, 'piece_moved', {
      playerId: localState.playerId,
      pieceIdx,
    });

    // ── 6. Actualizar stats globales ─────────────────────────────
    await roomRef().update({
      'globalStats/totalTurns': firebase.database.ServerValue.increment
        ? firebase.database.ServerValue.increment(0) // No incrementar aquí, se hace en nextTurn
        : (freshRoom.globalStats?.totalTurns || 0),
    });

    // ── 7. Calcular turno extra o pasar turno ────────────────────
    await handlePostMove(freshRoom, pieceIdx);

  } catch (err) {
    console.error('[movePiece]', err);
  }
}

/**
 * Maneja la lógica post-movimiento: turno extra por 6, por captura o siguiente turno.
 * @param {object} room
 * @param {number} pieceIdx
 */
async function handlePostMove(room, pieceIdx) {
  if (!room.turn) return;

  const diceValue       = room.turn.diceValue;
  const bonusTurns      = room.turn.bonusTurns || 0;
  const consecutiveSixes = room.turn.consecutiveSixes || 0;
  const isSix           = (diceValue === 6);

  // Si seis: turno extra (pero si es el tercer seis consecutivo ya fue manejado en rollDice)
  // Si bonusTurns > 0: tiene turnos extra pendientes
  if (isSix || bonusTurns > 0) {
    const remainingBonus = Math.max(0, bonusTurns - (isSix ? 0 : 1));

    await roomRef().update({
      'turn/rolled':     false,
      'turn/diceValue':  null,
      'turn/bonusTurns': remainingBonus,
      'turn/startedAt':  firebase.database.ServerValue.TIMESTAMP,
    });

    const reason = isSix ? '¡Seis!' : 'turno extra';
    await addGameEvent(`🎁 ${localState.playerName} tiene turno extra (${reason}).`, 'event-six');
  } else {
    await nextTurn(localState.playerId);
  }
}

/**
 * Maneja cuando una ficha llega a la meta.
 * Actualiza stats, verifica ganador, dispara eventos.
 * @param {number} pieceIdx
 * @param {object} room
 * @returns {object|null} nuevo snapshot, o null si la partida terminó
 */
async function handlePieceReachGoal(pieceIdx, room) {
  const pid        = localState.playerId;
  const playerName = localState.playerName;

  // Actualizar contador de fichas en meta
  const piecesInGoal = (room.playerStats?.[pid]?.piecesInGoal || 0) + 1;
  const totalInGoal  = (room.globalStats?.totalPiecesInGoal   || 0) + 1;

  await roomRef().update({
    [`playerStats/${pid}/piecesInGoal`]:     piecesInGoal,
    'globalStats/totalPiecesInGoal':          totalInGoal,
  });

  await addGameEvent(`🏁 ¡${playerName} (Ficha ${PIECE_LETTERS[pieceIdx]}) llegó a la META!`, 'event-goal');

  // Verificar si ganó (4 fichas en meta)
  const freshRoom = (await roomRef().once('value')).val();
  if (piecesInGoal >= PIECES_PER_PLAYER) {
    await handlePlayerWon(pid, freshRoom);
    return null;
  }

  // Disparar eventos de meta
  await checkAndProcessEvents(freshRoom, 'piece_to_goal', {
    playerId: pid,
    pieceIdx,
  });

  return (await roomRef().once('value')).val();
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 12 — SISTEMA DE CAPTURAS
═══════════════════════════════════════════════════════════════════ */

/**
 * Ejecuta la captura de una ficha rival.
 * - Sin Escudo Acme: la ficha va a la base
 * - Con Escudo Acme: la ficha va al punto medio, el escudo se consume
 * - El atacante obtiene turno extra (bonusTurn)
 * @param {object} captureInfo - { victimId, victimPieceKey, victimProgress, shielded }
 * @param {string} attackerName
 * @param {number} attackerPieceIdx
 * @returns {object} nuevo snapshot de Firebase
 */
async function executeCapture(captureInfo, attackerName, attackerPieceIdx) {
  const { victimId, victimPieceKey, victimProgress, victimColor, shielded } = captureInfo;
  const victimName    = localState.room?.players?.[victimId]?.name || 'Rival';
  const victimPieceIdx = parseInt(victimPieceKey[1]);
  const victimLetter  = PIECE_LETTERS[victimPieceIdx];

  let newProgress;
  let captureMsg;

  if (shielded) {
    // Con Escudo Acme: va al punto medio
    newProgress = calculateShieldedSendHome(victimProgress);
    captureMsg  = `⚔️ ${attackerName} comió la Ficha ${victimLetter} de ${victimName}. 🛡️ Escudo Acme: va al punto medio (pos ${newProgress}).`;

    // Consumir el escudo
    const shieldedPieces = localState.room?.playerStats?.[victimId]?.shieldedPieces || [];
    const newShielded    = shieldedPieces.filter(i => i !== victimPieceIdx);
    await roomRef().update({
      [`pieces/${victimId}/${victimPieceKey}`]:                   newProgress,
      [`playerStats/${victimId}/shieldedPieces`]:                 newShielded,
    });
  } else {
    // Sin escudo: va a la base
    newProgress = HOME_PROGRESS;
    captureMsg  = `💥 ${attackerName} comió la Ficha ${victimLetter} de ${victimName}. ¡Regresa a la base!`;

    await roomRef().update({
      [`pieces/${victimId}/${victimPieceKey}`]: HOME_PROGRESS,
    });
  }

  // Actualizar stats: el atacante suma 1 comida, la víctima suma 1 regresada
  const attackerStats   = localState.room?.playerStats?.[localState.playerId] || {};
  const victimStats     = localState.room?.playerStats?.[victimId] || {};

  await roomRef().update({
    [`playerStats/${localState.playerId}/piecesEaten`]:  (attackerStats.piecesEaten   || 0) + 1,
    [`playerStats/${victimId}/piecesSentBack`]:           (victimStats.piecesSentBack  || 0) + 1,
  });

  await addGameEvent(captureMsg, 'event-capture');

  // El atacante obtiene 1 turno extra por captura
  const currentBonus = localState.room?.turn?.bonusTurns || 0;
  await roomRef().update({
    'turn/bonusTurns': currentBonus + CAPTURE_BONUS_TURNS,
  });

  // Disparar eventos relacionados con la captura
  const freshRoom = (await roomRef().once('value')).val();
  await checkAndProcessEvents(freshRoom, 'piece_eaten', {
    attackerId:      localState.playerId,
    victimId,
    victimPieceIdx,
    playerId:        localState.playerId,
  });

  return (await roomRef().once('value')).val();
}

/**
 * Verifica todos los eventos relacionados con un contexto
 * y los procesa uno a uno.
 * @param {object} room
 * @param {string} context
 * @param {object} contextData
 */
async function checkAndProcessEvents(room, context, contextData) {
  const eventsToFire = checkAndFireEvents(room, context, contextData);
  if (eventsToFire.length === 0) return;

  for (const { event, contextData: cd } of eventsToFire) {
    // Leer snapshot fresco para cada evento
    const freshRoom = (await roomRef().once('value')).val();
    const updates   = applyEventEffect(event, freshRoom, cd);

    if (Object.keys(updates).length > 0) {
      await roomRef().update(updates);
    }

    // Mostrar banner de evento para todos los jugadores
    await showEventBanner(event, cd);

    console.log('[Evento disparado]', event.id);
  }
}

/**
 * Muestra el banner de evento en pantalla (visible para todos).
 * El banner desaparece automáticamente después de EVENT_BANNER_DURATION ms.
 * @param {object} event
 * @param {object} contextData
 */
async function showEventBanner(event, contextData) {
  const bannerData = getEventBannerData(event, contextData);
  const modal      = document.getElementById('modal-event-banner');
  if (!modal) return;

  document.getElementById('event-banner-icon')?.setAttribute('textContent', bannerData.icon);
  const iconEl = document.getElementById('event-banner-icon');
  const titleEl = document.getElementById('event-banner-title');
  const descEl  = document.getElementById('event-banner-desc');
  const effectEl = document.getElementById('event-banner-effect');

  if (iconEl)   iconEl.textContent   = bannerData.icon;
  if (titleEl)  titleEl.textContent  = bannerData.title;
  if (descEl)   descEl.textContent   = bannerData.description;
  if (effectEl) effectEl.textContent = bannerData.effectDesc;

  modal.style.display = 'flex';

  // Auto-ocultar después de EVENT_BANNER_DURATION ms
  clearTimeout(window._eventBannerTimeout);
  window._eventBannerTimeout = setTimeout(() => {
    modal.style.display = 'none';
  }, EVENT_BANNER_DURATION);
}

/**
 * Maneja cuando un jugador gana (4 fichas en meta).
 * Registra su posición y verifica si la partida debe terminar.
 * @param {string} winnerId
 * @param {object} room
 */
async function handlePlayerWon(winnerId, room) {
  const playerName  = room.players?.[winnerId]?.name || 'Jugador';
  const results     = room.results || [];
  const position    = results.length + 1;
  const now         = firebase.database.ServerValue.TIMESTAMP;

  const newResults  = [...results, { playerId: winnerId, position, finishedAt: now }];

  await roomRef().update({
    [`players/${winnerId}/eliminated`]:    true,
    [`players/${winnerId}/position`]:      position,
    'results':                             newResults,
  });

  await addGameEvent(
    `🏆 ¡${playerName} terminó en el lugar #${position} con sus 4 fichas en meta!`,
    'event-goal'
  );

  // Verificar si quedan jugadores activos
  const freshRoom    = (await roomRef().once('value')).val();
  const activePlayers = getPlayersOrdered(freshRoom, true);

  if (activePlayers.length <= 1) {
    // Solo queda 1 jugador (el perdedor) → fin automático
    if (activePlayers.length === 1) {
      const loserId   = activePlayers[0];
      const loserName = freshRoom.players?.[loserId]?.name || 'Jugador';
      const loserPos  = newResults.length + 1;
      const finalResults = [...newResults, { playerId: loserId, position: loserPos, finishedAt: now }];

      await roomRef().update({
        'status':                               'finished',
        [`players/${loserId}/eliminated`]:       true,
        [`players/${loserId}/position`]:         loserPos,
        'results':                               finalResults,
      });

      await addGameEvent(`🏁 ¡${loserName} quedó en último lugar!`, 'event-goal');
    } else {
      await roomRef().update({ 'status': 'finished' });
    }

    clearTimer();
    const finalRoom = (await roomRef().once('value')).val();
    showFinalResults(finalRoom);
  }
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 13 — ACTIVACIÓN DE CASILLAS ESPECIALES EN JUEGO
   Integra special-cells.js con el flujo de movimiento de app.js.
═══════════════════════════════════════════════════════════════════ */

/**
 * Activa una casilla especial cuando una ficha aterriza en ella.
 * Aplica el efecto, maneja el Escudo Acme si aplica,
 * y gestiona casillas de 1 uso (las elimina de Firebase).
 * Puede encadenarse si BONUS_MOVE lleva a otra casilla especial.
 *
 * @param {object} cell           - casilla especial de Firebase
 * @param {number} ringIdx        - índice en PATH_CELLS
 * @param {number} pieceIdx       - índice de la ficha (0-3)
 * @param {number} currentProgress- progress actual de la ficha
 * @param {object} room           - snapshot fresco de Firebase
 * @returns {object} nuevo snapshot después de aplicar el efecto
 */
async function activateSpecialCellOnPiece(cell, ringIdx, pieceIdx, currentProgress, room) {
  const pid        = localState.playerId;
  const playerName = localState.playerName;
  const pieceKey   = 'p' + pieceIdx;
  const color      = room.players?.[pid]?.color;

  // Verificar si la ficha tiene Escudo Acme
  const shieldedPieces = room.playerStats?.[pid]?.shieldedPieces || [];
  const isShielded     = shieldedPieces.includes(pieceIdx);

  // Obtener el resultado del handler de la casilla
  const result = activateSpecialCell(cell, playerName, pieceIdx);
  if (!result) return room;

  await addGameEvent(result.message, 'event-special');

  // Si es OASIS: solo loguear, no aplicar efecto
  if (result.isOasis) {
    if (result.consumed) {
      await roomRef().update({ [`specialCells/${ringIdx}`]: null });
    }
    return (await roomRef().once('value')).val();
  }

  // Si la casilla tiene 1 solo uso: eliminarla
  const updates = {};
  if (result.consumed || cell.uses === 1) {
    updates[`specialCells/${ringIdx}`] = null;
  }

  // Aplicar efecto según el tipo, con posible protección del Escudo
  switch (result.effectType) {

    case 'safe':
      // No hay efecto de movimiento. La protección se verifica en checkCaptureAt.
      break;

    case 'bonus_move': {
      const bonus        = result.effectValue; // +1 a +6
      const newProgress  = calculateTargetProgress(color, currentProgress, bonus, room.playerStats?.[pid]?.exitCells, null);
      if (newProgress !== null) {
        updates[`pieces/${pid}/${pieceKey}`] = newProgress;
        await roomRef().update(updates);
        await addGameEvent(`⭐ Bonus: +${bonus} casillas extra.`, 'event-special');

        // Verificar cadena: ¿la nueva casilla también es especial?
        const freshRoom2 = (await roomRef().once('value')).val();
        if (isOnMainPath(newProgress)) {
          const newRingIdx   = getRingIndex(color, newProgress);
          const chainedCell  = getSpecialCellAt(freshRoom2.specialCells || {}, newRingIdx);
          if (chainedCell) {
            await addGameEvent(`🔗 ¡Cadena de casillas especiales!`, 'event-special');
            return await activateSpecialCellOnPiece(chainedCell, newRingIdx, pieceIdx, newProgress, freshRoom2);
          }
        }
        return freshRoom2;
      }
      break;
    }

    case 'send_home': {
      let shieldResult = null;
      if (isShielded) shieldResult = applyShieldProtection('send_home', null);

      if (shieldResult) {
        // Escudo: ir al punto medio
        const midProgress = calculateShieldedSendHome(currentProgress);
        updates[`pieces/${pid}/${pieceKey}`]              = midProgress;
        updates[`playerStats/${pid}/shieldedPieces`]      = shieldedPieces.filter(i => i !== pieceIdx);
        await addGameEvent(shieldResult.protectionMsg, 'event-special');
      } else {
        updates[`pieces/${pid}/${pieceKey}`] = HOME_PROGRESS;
        updates[`playerStats/${pid}/piecesSentBack`] = (room.playerStats?.[pid]?.piecesSentBack || 0) + 1;
      }
      break;
    }

    case 'lose_turn': {
      let shieldResult = null;
      if (isShielded) shieldResult = applyShieldProtection('lose_turn', null);

      if (shieldResult) {
        // Escudo: protección completa (no pierde el turno)
        updates[`playerStats/${pid}/shieldedPieces`] = shieldedPieces.filter(i => i !== pieceIdx);
        await addGameEvent(shieldResult.protectionMsg, 'event-special');
      } else {
        // Si tiene turno extra: perder el turno extra
        const bonusTurns = room.turn?.bonusTurns || 0;
        if (bonusTurns > 0) {
          updates['turn/bonusTurns'] = bonusTurns - 1;
          await addGameEvent(`⏸️ Turno extra perdido por casilla.`, 'event-special');
        } else {
          updates['turn/loseTurnPending'] = true;
          await addGameEvent(`⏸️ ${playerName} perderá su próximo turno.`, 'event-special');
        }
      }
      break;
    }

    case 'retreat': {
      const retreatVal   = Math.abs(result.effectValue);
      let shieldResult   = null;
      if (isShielded) shieldResult = applyShieldProtection('retreat', result.effectValue);

      const effectiveRetreat = shieldResult
        ? Math.abs(shieldResult.effectValue)
        : retreatVal;

      const newProgress = calculateRetreatProgress(currentProgress, effectiveRetreat, false);
      updates[`pieces/${pid}/${pieceKey}`] = newProgress;

      if (shieldResult) {
        updates[`playerStats/${pid}/shieldedPieces`] = shieldedPieces.filter(i => i !== pieceIdx);
        await addGameEvent(shieldResult.protectionMsg, 'event-special');
      }

      // Verificar si el retroceso lleva a otra casilla especial
      if (isOnMainPath(newProgress)) {
        await roomRef().update(updates);
        const freshRoom3   = (await roomRef().once('value')).val();
        const newRingIdx   = getRingIndex(color, newProgress);
        const chainedCell  = getSpecialCellAt(freshRoom3.specialCells || {}, newRingIdx);
        if (chainedCell) {
          return await activateSpecialCellOnPiece(chainedCell, newRingIdx, pieceIdx, newProgress, freshRoom3);
        }
        return freshRoom3;
      }
      break;
    }
  }

  if (Object.keys(updates).length > 0) {
    await roomRef().update(updates);
  }

  return (await roomRef().once('value')).val();
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 14 — SISTEMA DE COMODINES EN JUEGO
═══════════════════════════════════════════════════════════════════ */

/**
 * El jugador activa el comodín Ataque Dirigido.
 * Solo puede hacerse antes de tirar el dado.
 * Abre el modal para elegir la ficha objetivo.
 */
function activateDirAttack() {
  const room = localState.room;
  if (!room || !isMyTurn(room)) return;
  if (room.turn?.rolled) { showGameMsg('El Ataque Dirigido debe usarse antes de tirar.'); return; }
  if (!canUseDirAttack(room, localState.playerId)) {
    showGameMsg('No puedes usar el Ataque Dirigido ahora.');
    return;
  }

  const targets = getAttackableTargets(room, localState.playerId);
  if (targets.length === 0) { showGameMsg('No hay fichas rivales atacables.'); return; }

  showAttackModal(targets);
}

/**
 * Muestra el modal de selección de objetivo del Ataque Dirigido.
 * @param {Array} targets - fichas atacables
 */
function showAttackModal(targets) {
  const modal   = document.getElementById('modal-attack-target');
  const container = document.getElementById('attack-targets');
  if (!modal || !container) return;

  container.innerHTML = '';
  targets.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'attack-target-btn';
    btn.innerHTML = `
      <span class="color-dot ${t.color}"></span>
      ${t.playerName} — Ficha ${t.pieceLetter} (pos ${t.progress})
    `;
    btn.addEventListener('click', () => {
      modal.style.display = 'none';
      executeDirAttack(t);
    });
    container.appendChild(btn);
  });

  modal.style.display = 'flex';
}

/**
 * Ejecuta el Ataque Dirigido sobre la ficha seleccionada.
 * @param {object} target - { playerId, playerName, pieceIdx, pieceLetter, progress, color }
 */
async function executeDirAttack(target) {
  const room       = localState.room;
  const pid        = localState.playerId;
  const playerName = localState.playerName;
  const wildcards  = room.playerStats?.[pid]?.wildcards || {};

  // Consumir comodín y marcar como usado globalmente
  const newWildcards = consumeWildcard(wildcards, WILDCARD_TYPES.DIR_ATTACK);
  const params = WILDCARD_HANDLERS[WILDCARD_TYPES.DIR_ATTACK]({
    playerName,
    targetPlayerId:   target.playerId,
    targetPlayerName: target.playerName,
    targetPieceIdx:   target.pieceIdx,
    targetPieceLetter:target.pieceLetter,
    targetProgress:   target.progress,
    targetColor:      target.color,
  });

  // Calcular destino final (evitar casillas positivas)
  const freshRoom       = (await roomRef().once('value')).val();
  const occupiedRingIdxs = new Set(getOccupiedRingIdxs(freshRoom));
  const rawNewProgress   = params.actionData.newProgress;

  let finalProgress = rawNewProgress;
  if (rawNewProgress >= 0 && isOnMainPath(rawNewProgress)) {
    const rawRingIdx    = getRingIndex(target.color, rawNewProgress);
    const finalRingIdx  = resolveAttackTargetCell(rawRingIdx, freshRoom.specialCells || {}, occupiedRingIdxs);
    finalProgress       = ringIndexToProgress(target.color, finalRingIdx);
  }

  const pieceKey = 'p' + target.pieceIdx;
  await roomRef().update({
    [`pieces/${target.playerId}/${pieceKey}`]:           finalProgress,
    [`playerStats/${pid}/wildcards`]:                    newWildcards,
    'globalStats/dirAttackUsed':                         true,
  });

  await addGameEvent(params.message, 'event-wildcard');

  // Si aterriza en casilla especial negativa, activarla
  if (isOnMainPath(finalProgress)) {
    const finalRingIdx = getRingIndex(target.color, finalProgress);
    const cell         = getSpecialCellAt((await roomRef().once('value')).val().specialCells || {}, finalRingIdx);
    if (cell && !cell.positive) {
      // El efecto se aplica sobre la ficha de la víctima (temporalmente cambia localState)
      await addGameEvent(`⚡ Ficha atacada cayó en casilla negativa.`, 'event-special');
    }
  }

  // Disparar evento relacionado con captura/ataque
  const fr2 = (await roomRef().once('value')).val();
  await checkAndProcessEvents(fr2, 'piece_moved', { playerId: pid });
}

/**
 * El jugador activa el Escudo Acme.
 * Muestra modal para elegir qué ficha proteger.
 */
function activateAcmeShield() {
  const room = localState.room;
  if (!room || !isMyTurn(room)) return;
  const wildcards = room.playerStats?.[localState.playerId]?.wildcards;
  if (!hasWildcard(wildcards, WILDCARD_TYPES.ACME_SHIELD)) {
    showGameMsg('No tienes Escudo Acme disponible.');
    return;
  }

  const targets = getShieldableTargets(room, localState.playerId);
  if (targets.length === 0) {
    showGameMsg('No tienes fichas en el camino para proteger.');
    return;
  }

  showShieldModal(targets);
  localState.shieldTargetMode = true;
}

/**
 * Muestra el modal de selección de ficha para el Escudo Acme.
 * @param {Array} targets
 */
function showShieldModal(targets) {
  const modal     = document.getElementById('modal-shield-assign');
  const container = document.getElementById('shield-targets');
  if (!modal || !container) return;

  container.innerHTML = '';
  targets.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'shield-target-btn';
    btn.textContent = `Ficha ${t.pieceLetter} (pos ${t.progress})`;
    btn.addEventListener('click', () => {
      modal.style.display = 'none';
      onShieldPieceSelected(t.pieceIdx);
    });
    container.appendChild(btn);
  });

  modal.style.display = 'flex';
}

/**
 * El jugador seleccionó una ficha para el Escudo Acme.
 * @param {number} pieceIdx
 */
async function onShieldPieceSelected(pieceIdx) {
  localState.shieldTargetMode = false;
  const room      = localState.room;
  const pid       = localState.playerId;
  const wildcards = room.playerStats?.[pid]?.wildcards || {};
  const newWildcards = consumeWildcard(wildcards, WILDCARD_TYPES.ACME_SHIELD);

  const shieldedPieces = room.playerStats?.[pid]?.shieldedPieces || [];
  if (!shieldedPieces.includes(pieceIdx)) {
    shieldedPieces.push(pieceIdx);
  }

  await roomRef().update({
    [`playerStats/${pid}/wildcards`]:       newWildcards,
    [`playerStats/${pid}/shieldedPieces`]:  shieldedPieces,
  });

  await addGameEvent(
    `🛡️ ${localState.playerName} protegió su Ficha ${PIECE_LETTERS[pieceIdx]} con Escudo Acme.`,
    'event-wildcard'
  );

  const fr = (await roomRef().once('value')).val();
  renderAllPanels(fr);
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 15 — SISTEMA DE EVENTOS (integración con app.js)
   Las funciones core están en events.js.
   Esta sección maneja la integración con Firebase.
═══════════════════════════════════════════════════════════════════ */

// checkAndProcessEvents() ya está definida en la Sección 12 (capturas).
// showEventBanner() ya está definida en la Sección 12.
// Esta sección agrega helpers de integración.

/**
 * Verifica y procesa eventos al inicio de cada turno.
 * @param {object} room
 */
async function processStartOfTurnEvents(room) {
  if (!room.turn) return;

  // Verificar si el turno es de un jugador que tiene loseTurnPending
  const currentPid = room.turn.playerId;
  if (room.turn.loseTurnPending && currentPid === localState.playerId) {
    await roomRef().update({ 'turn/loseTurnPending': false });
    await addGameEvent(`⏸️ ${localState.playerName} pierde este turno (efecto pendiente).`, 'event-special');
    await nextTurn(localState.playerId);
    return;
  }

  // Verificar eventos de turno
  const totalTurns = (room.globalStats?.totalTurns || 0) + 1;
  await roomRef().update({ 'globalStats/totalTurns': totalTurns });

  const freshRoom = (await roomRef().once('value')).val();
  await checkAndProcessEvents(freshRoom, 'turn_started', {
    playerId:  currentPid,
    turnCount: totalTurns,
  });
}

/**
 * Verifica y procesa eventos al final de cada turno.
 * @param {object} room
 * @param {string} currentPlayerId
 */
async function processEndOfTurnEvents(room, currentPlayerId) {
  const freshRoom = (await roomRef().once('value')).val();
  await checkAndProcessEvents(freshRoom, 'turn_ended', {
    playerId: currentPlayerId,
  });
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 16 — NÚMEROS Y CASILLAS DE SALIDA DINÁMICOS
═══════════════════════════════════════════════════════════════════ */

/**
 * Retorna la lista de números de salida actuales de un jugador.
 * Considera los que tiene en sus stats de Firebase.
 * @param {object} room
 * @param {string} playerId
 * @returns {number[]}
 */
function getPlayerExitNumbers(room, playerId) {
  return room.playerStats?.[playerId]?.exitNumbers || [...DEFAULT_EXIT_NUMBERS_ARR];
}

/**
 * Retorna todas las casillas de salida disponibles de un jugador.
 * Incluye la principal y las extras desbloqueadas por eventos.
 * @param {object} room
 * @param {string} playerId
 * @returns {{ main: number, extras: number[], all: number[] }}
 */
function getPlayerExitCells(room, playerId) {
  const stats = room.playerStats?.[playerId];
  const color = room.players?.[playerId]?.color;
  const main  = stats?.exitCells?.main  ?? EXIT_CELL_INDEX[color];
  const extras = stats?.exitCells?.extras ?? [];
  return { main, extras, all: [main, ...extras] };
}

/**
 * Verifica si el dado permite sacar una ficha de la base para un jugador.
 * @param {object} room
 * @param {string} playerId
 * @param {number} diceValue
 * @returns {boolean}
 */
function canExitBase(room, playerId, diceValue) {
  const exitNumbers = getPlayerExitNumbers(room, playerId);
  return exitNumbers.includes(diceValue);
}

/**
 * Genera el texto de los números de salida para mostrar en el panel.
 * Formato: [1] [6] [5] con clase especial para los añadidos por eventos.
 * @param {object} room
 * @param {string} playerId
 * @returns {string} HTML para el panel
 */
function renderExitNumbersHTML(room, playerId) {
  const exitNumbers = getPlayerExitNumbers(room, playerId);
  const defaultNums = DEFAULT_EXIT_NUMBERS_ARR;

  return '<span class="panel-exit-numbers">' +
    '<span class="exit-num-label">Sale con:</span>' +
    exitNumbers.map(n => {
      const isSpecial = !defaultNums.includes(n);
      return `<span class="exit-num-badge ${isSpecial ? 'special' : ''}">${n}</span>`;
    }).join('') +
    '</span>';
}

/**
 * Genera el texto de las casillas de salida para el modal.
 * @param {object} room
 * @param {string} playerId
 * @returns {Array<{ringIdx, label, isMain}>}
 */
function getExitCellsForDisplay(room, playerId) {
  const { main, extras } = getPlayerExitCells(room, playerId);
  const result = [{ ringIdx: main, label: 'Salida principal', isMain: true }];

  extras.forEach((ringIdx, idx) => {
    result.push({
      ringIdx,
      label:  `Salida extra ${idx + 1}`,
      isMain: false,
    });
  });

  return result;
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 17 — GESTIÓN DE TURNOS
   IMPLEMENTACIÓN CRÍTICA: nextTurn siempre recibe currentPlayerId
   explícito y siempre lee datos frescos de Firebase.
   Ver documento SISTEMA_DE_TURNOS.md para la explicación completa.
═══════════════════════════════════════════════════════════════════ */

/**
 * Avanza el turno al siguiente jugador activo.
 *
 * CRÍTICO: Recibe currentPlayerId EXPLÍCITO (siempre localState.playerId).
 * Lee datos frescos de Firebase internamente para evitar stale data.
 * Lee datos frescos de Firebase internamente.
 *
 * @param {string} currentPlayerId - el jugador cuyo turno ACABA de terminar
 */
async function nextTurn(currentPlayerId) {
  // Procesar eventos de fin de turno
  const roomSnap = (await roomRef().once('value')).val();
  if (roomSnap) await processEndOfTurnEvents(roomSnap, currentPlayerId);

  // Leer estado fresco de Firebase SIEMPRE
  let room;
  try {
    const snap = await roomRef().once('value');
    if (!snap.exists()) return;
    room = snap.val();
  } catch (err) {
    console.error('[nextTurn] Error al leer Firebase:', err.message);
    return;
  }

  if (!room?.players || room.status !== 'playing') return;

  const nextId   = getNextPlayerId(room, currentPlayerId);
  const nextName = room.players[nextId]?.name || 'Jugador';
  const now      = firebase.database.ServerValue.TIMESTAMP;

  console.log(`[nextTurn] ${room.players[currentPlayerId]?.name} → ${nextName}`);

  try {
    await roomRef().update({
      'turn/playerId':          nextId,
      'turn/startedAt':         now,
      'turn/consecutiveSixes':  0,
      'turn/bonusTurns':        0,
      'turn/lastMovedPiece':    null,
      'turn/diceValue':         null,
      'turn/rolled':            false,
      'turn/loseTurnPending':   room.turn?.loseTurnPending || false,
    });

    await addGameEvent(`▶️ Turno de ${nextName}.`, 'event-turn');

  } catch (err) {
    console.error('[nextTurn] Error al actualizar Firebase:', err);
  }
}

/**
 * Calcula el ID del siguiente jugador activo dado el jugador actual EXPLÍCITO.
 *
 * USA currentPlayerId EXPLÍCITO para evitar el bug de indexOf=-1
 * que hace que el juego siempre vuelva al primer jugador con 3+ jugadores.
 *
 * @param {object} room
 * @param {string} currentPlayerId - jugador cuyo turno termina
 * @returns {string} playerId del siguiente jugador
 */
function getNextPlayerId(room, currentPlayerId) {
  // Solo jugadores activos (no eliminados)
  const ordered = getPlayersOrdered(room, true);

  console.log('[getNextPlayerId] Activos:', ordered.map(id => room.players[id]?.name));
  console.log('[getNextPlayerId] Current:', room.players[currentPlayerId]?.name);

  if (ordered.length === 0) return currentPlayerId;
  if (ordered.length === 1) return ordered[0];

  let currentIdx = ordered.indexOf(currentPlayerId);

  // Caso especial: currentPlayerId fue eliminado o no está en activos
  // Buscar en la lista COMPLETA para calcular posición relativa
  if (currentIdx === -1) {
    const allOrdered = getPlayersOrdered(room, false);
    const allIdx     = allOrdered.indexOf(currentPlayerId);
    if (allIdx === -1) return ordered[0]; // Último recurso

    const allLen = allOrdered.length;
    for (let i = 1; i <= allLen; i++) {
      const ci = ((allIdx + i) % allLen + allLen) % allLen;
      if (ordered.includes(allOrdered[ci])) {
        console.log('[getNextPlayerId] Fallback (eliminado) →', room.players[allOrdered[ci]]?.name);
        return allOrdered[ci];
      }
    }
    return ordered[0];
  }

  const len = ordered.length;

  // Avanzar 1 posición, saltando desconectados
  for (let i = 1; i <= len; i++) {
    const ni = ((currentIdx + i) % len + len) % len;
    if (room.players[ordered[ni]]?.connected !== false) {
      console.log(`[getNextPlayerId] idx ${currentIdx} → ${ni} = ${room.players[ordered[ni]]?.name}`);
      return ordered[ni];
    }
  }

  // Si todos desconectados: siguiente sin importar
  return ordered[((currentIdx + 1) % len + len) % len];
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 18 — TIMER Y AUTO-MOVIMIENTO
   El timer corre localmente en el cliente.
   Solo el cliente del jugador activo ejecuta la auto-acción.
   DECISIÓN: Al expirar, el sistema actúa automáticamente (random).
═══════════════════════════════════════════════════════════════════ */

/**
 * Inicia el countdown local.
 * Calcula el tiempo restante desde turn.startedAt para funcionar
 * incluso tras reconexión a mitad de turno.
 * @param {object} room
 */
function startLocalTimer(room) {
  clearTimer();

  // Llamar a eventos de inicio de turno (solo el jugador activo)
  if (isMyTurn(room)) {
    processStartOfTurnEvents(room).catch(err =>
      console.error('[startLocalTimer] Error en processStartOfTurnEvents:', err)
    );
  }

  const timerSeconds = room.config?.timerSeconds || TIMER_SECONDS_DEFAULT;
  const startedAt    = room.turn?.startedAt || Date.now();
  const elapsed      = Math.floor((Date.now() - startedAt) / 1000);
  let   remaining    = Math.max(0, timerSeconds - elapsed);

  localState.timerValue = remaining;
  updateTimerUI(remaining, timerSeconds);

  if (remaining === 0) {
    if (isMyTurn(localState.room) && !localState.handlingTimeout) {
      localState.handlingTimeout = true;
      handleTimeout(localState.room).catch(console.error);
    }
    return;
  }

  localState.timerInterval = setInterval(async () => {
    remaining--;
    localState.timerValue = remaining;
    updateTimerUI(remaining, timerSeconds);

    if (remaining <= 0) {
      clearTimer();
      if (isMyTurn(localState.room) && !localState.handlingTimeout) {
        localState.handlingTimeout = true;
        await handleTimeout(localState.room);
      }
    }
  }, 1000);
}

/** Para y limpia el timer local. */
function clearTimer() {
  if (localState.timerInterval) {
    clearInterval(localState.timerInterval);
    localState.timerInterval = null;
  }
}

/**
 * Actualiza la barra y número del timer en la UI.
 * @param {number} remaining
 * @param {number} total
 */
function updateTimerUI(remaining, total = TIMER_SECONDS_DEFAULT) {
  const bar     = document.getElementById('timer-bar');
  const display = document.getElementById('timer-display');
  if (!bar || !display) return;

  const pct = (remaining / total) * 100;
  bar.style.width = pct + '%';
  display.textContent = remaining;

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
 * El sistema actúa automáticamente de forma random.
 * Casos:
 * 1. No tiró el dado → tira automáticamente
 * 2. Tiró pero no movió → mueve ficha random válida
 * 3. Tiene loseTurnPending → pasa el turno
 * @param {object} room
 */
async function handleTimeout(room) {
  if (!room?.turn) return;
  if (!isMyTurn(room)) return;

  await addGameEvent(
    `⏱️ Tiempo agotado. El sistema actúa por ${localState.playerName}.`,
    'event-system'
  );

  try {
    // ── Caso 0: loseTurnPending → pasar turno ──────────────────
    if (room.turn.loseTurnPending) {
      await roomRef().update({ 'turn/loseTurnPending': false });
      await nextTurn(localState.playerId);
      return;
    }

    // ── Caso 1: No tiró el dado → tirar automáticamente ────────
    if (!room.turn.rolled) {
      const value = Math.floor(Math.random() * 6) + 1;
      await _applyDiceRoll(value, room);

      // Después del tiro automático, si hay movimientos, mover random
      const freshRoom = (await roomRef().once('value')).val();
      if (freshRoom?.turn?.rolled) {
        const diceVal = freshRoom.turn.diceValue;
        await autoMoveRandom(freshRoom, diceVal);
      }
      return;
    }

    // ── Caso 2: Ya tiró pero no movió → mover ficha random ──────
    const diceVal = room.turn.diceValue;
    await autoMoveRandom(room, diceVal);

  } catch (err) {
    console.error('[handleTimeout]', err);
    // Fallback: pasar turno
    try { await nextTurn(localState.playerId); } catch (e) { console.error('[handleTimeout fallback]', e); }
  }
}

/**
 * Mueve una ficha válida al azar.
 * Si no hay fichas válidas, pasa el turno.
 * @param {object} room
 * @param {number} diceValue
 */
async function autoMoveRandom(room, diceValue) {
  const validMoves = getValidMovesForDice(room, localState.playerId, diceValue);

  if (validMoves.length === 0) {
    await addGameEvent('⏭️ Sin movimientos válidos (auto). Turno saltado.', 'event-system');
    await nextTurn(localState.playerId);
    return;
  }

  // Elegir movimiento al azar
  const chosen = validMoves[Math.floor(Math.random() * validMoves.length)];
  const exitRingIdx = chosen.fromHome ? chosen.exitRingIdx : null;

  // Simular el tap (para que pase por la lógica de confirmación)
  await movePiece(chosen.pieceIdx, exitRingIdx);
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 19 — FIN DE PARTIDA Y RANKING
═══════════════════════════════════════════════════════════════════ */

/**
 * Muestra el modal de resultados finales.
 * Calcula el ranking completo y muestra la tabla.
 * @param {object} room
 */
function showFinalResults(room) {
  clearTimer();

  const modal = document.getElementById('modal-results');
  const tbody = document.getElementById('results-body');
  if (!modal || !tbody) return;

  // Obtener resultados ordenados por posición
  const results = [...(room.results || [])].sort((a, b) => a.position - b.position);
  const medals  = ['🥇', '🥈', '🥉'];

  tbody.innerHTML = results.map(r => {
    const player    = room.players?.[r.playerId];
    const stats     = room.playerStats?.[r.playerId];
    const name      = escapeHtml(player?.name || 'Jugador');
    const color     = player?.color || 'blue';
    const eaten     = stats?.piecesEaten    || 0;
    const sentBack  = stats?.piecesSentBack || 0;
    const medal     = medals[r.position - 1] || '';
    const posClass  = r.position <= 3 ? `pos-${r.position}` : '';

    return `
      <tr>
        <td><span class="${posClass}">${medal} ${r.position}º</span></td>
        <td>
          <span class="color-dot ${color}" style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;"></span>
          ${name}
        </td>
        <td style="text-align:center">${eaten}</td>
        <td style="text-align:center">${sentBack}</td>
      </tr>
    `;
  }).join('');

  modal.style.display = 'flex';
}

/**
 * Calcula el ranking de posiciones actuales durante la partida.
 * No se muestra en pantalla durante la partida (solo al final).
 * Se usa internamente para eventos de balanceo (último lugar).
 * @param {object} room
 * @returns {Array<{playerId, position, score}>}
 */
function calculateCurrentRanking(room) {
  if (!room.players || !room.pieces) return [];

  const players = Object.keys(room.players).filter(pid => !room.players[pid].eliminated);

  return players.map(pid => {
    const pieces   = room.pieces[pid]        || {};
    const stats    = room.playerStats?.[pid] || {};
    const inGoal   = countPiecesInState(pieces, 'goal');
    const inBase   = countPiecesInState(pieces, 'home');
    const wildcards = getTotalWildcards(stats.wildcards);

    // Score: más fichas en meta = mejor; más en base = peor; menos comodines = mejor en empate
    const score = (inGoal * 1000) - (inBase * 100) - wildcards;

    return { playerId: pid, score, inGoal, inBase, wildcards };
  })
  .sort((a, b) => b.score - a.score)
  .map((entry, idx) => ({ ...entry, position: idx + 1 }));
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 20 — RENDERIZADO DEL TABLERO
═══════════════════════════════════════════════════════════════════ */

// Mapa de tipos de celda, construido una vez en initBoard()
let _cellTypeMap = null;

/**
 * Crea el grid HTML del tablero (15×15 = 225 celdas).
 * Se llama UNA sola vez al entrar a la pantalla de juego.
 */
function initBoard() {
  const board = document.getElementById('board');
  if (!board) return;
  board.innerHTML = '';

  _cellTypeMap = buildCellTypeMap();

  for (let row = 0; row < 15; row++) {
    for (let col = 0; col < 15; col++) {
      const cell    = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.col  = col;
      cell.dataset.row  = row;
      cell.dataset.cell = `${col},${row}`;

      // Aplicar clase CSS según tipo de celda
      _applyCellClasses(cell, col, row);

      const content = document.createElement('div');
      content.className = 'cell-content';
      cell.appendChild(content);

      board.appendChild(cell);
    }
  }
  console.log('[initBoard] Tablero creado (15×15).');
}

/**
 * Asigna las clases CSS a una celda según su tipo.
 * @param {HTMLElement} cell
 * @param {number} col
 * @param {number} row
 */
function _applyCellClasses(cell, col, row) {
  const ck       = cellKey(col, row);
  const cellType = _cellTypeMap?.get(ck) || getCellType(col, row);

  switch (cellType.type) {
    case 'goal-center':
      cell.classList.add('cell-goal-center');
      break;
    case 'goal-triangle':
      cell.classList.add(`cell-goal-${cellType.color}`);
      break;
    case 'home-stretch':
      cell.classList.add('cell-hs', `cell-hs-${cellType.color}`);
      break;
    case 'exit':
      cell.classList.add('cell-path', `cell-exit-${cellType.color}`);
      break;
    case 'path':
      cell.classList.add('cell-path');
      break;
    case 'home':
      cell.classList.add('cell-home', `cell-home-${cellType.color}`);
      if (cellType.isInner) cell.classList.add(`cell-home-inner-${cellType.color}`);
      break;
    case 'center':
      cell.classList.add('cell-center');
      break;
    default:
      cell.classList.add('cell-empty');
  }
}

/**
 * Renderiza el estado completo del tablero.
 * Se llama en cada update de Firebase.
 * @param {object} room
 */
function renderBoard(room) {
  if (!room) return;
  const board = document.getElementById('board');
  if (!board) return;

  // Limpiar contenido y highlights de todas las celdas
  board.querySelectorAll('.cell-content').forEach(c => { c.innerHTML = ''; });
  board.querySelectorAll('.cell').forEach(c => {
    c.classList.remove('cell-valid', 'cell-preview');
    // Limpiar casillas especiales anteriores (se redibujan)
    c.classList.remove('cell-special-pos', 'cell-special-neg');
    c.removeAttribute('data-effect');
    // Limpiar contadores de meta
    const counter = c.querySelector('.goal-counter');
    if (counter) counter.remove();
  });

  // Construir mapa de piezas
  const piecesMap = buildPiecesMap(room);

  // Calcular highlights de movimiento válido y preview
  let validPieceIdxs    = new Set();
  let previewCellKey    = null;

  if (isMyTurn(room) && room.turn?.rolled && !localState.shieldTargetMode) {
    const diceValue = room.turn?.diceValue;
    if (diceValue) {
      const validMoves = getValidMovesForDice(room, localState.playerId, diceValue);
      validMoves.forEach(m => validPieceIdxs.add(m.pieceIdx));

      // Preview de la ficha seleccionada
      if (localState.selectedPieceIdx !== null && localState.previewProgress !== null) {
        const color = room.players?.[localState.playerId]?.color;
        const pos   = getVisualPosition(color, localState.previewProgress, localState.selectedPieceIdx);
        if (pos) previewCellKey = cellKey(pos.col, pos.row);
      }
    }
  }

  // Renderizar casillas de salida extra por jugador
  _renderExtraExitCells(board, room);

  // Renderizar casillas especiales
  _renderSpecialCells(board, room.specialCells || {});

  // Renderizar contadores de fichas en meta (centro)
  _renderGoalCounters(board, room);

  // Renderizar fichas
  piecesMap.forEach((pieces, ck) => {
    const [col, row] = ck.split(',').map(Number);
    const cell    = board.querySelector(`[data-cell="${ck}"]`);
    if (!cell) return;
    const content = cell.querySelector('.cell-content');
    if (!content) return;

    pieces.forEach(({ color, playerId, pieceIdx, progress }) => {
      const pieceEl = _buildPieceElement(color, playerId, pieceIdx, progress, room, validPieceIdxs);
      content.appendChild(pieceEl);
    });
  });

  // Aplicar highlight de celdas válidas (donde están las fichas válidas)
  if (isMyTurn(room) && room.turn?.rolled) {
    const color = room.players?.[localState.playerId]?.color;
    const diceValue = room.turn?.diceValue;
    if (color && diceValue) {
      const validMoves = getValidMovesForDice(room, localState.playerId, diceValue);
      validMoves.forEach(m => {
        const pos = getVisualPosition(color, room.pieces?.[localState.playerId]?.['p' + m.pieceIdx], m.pieceIdx);
        if (pos) {
          const c = board.querySelector(`[data-cell="${cellKey(pos.col, pos.row)}"]`);
          if (c) c.classList.add('cell-valid');
        }
      });
    }
  }

  // Aplicar preview
  if (previewCellKey) {
    const previewCell = board.querySelector(`[data-cell="${previewCellKey}"]`);
    if (previewCell) {
      previewCell.classList.add('cell-preview');
      const myColor   = room.players?.[localState.playerId]?.color;
      const content   = previewCell.querySelector('.cell-content');
      if (content && myColor) {
        const ghost = document.createElement('div');
        ghost.className = `piece-ghost piece-ghost-${myColor}`;
        content.appendChild(ghost);
      }
    }
  }

  // Previsualización de captura: tachar ficha rival que será comida
  if (isMyTurn(room) && room.turn?.rolled && localState.selectedPieceIdx !== null && localState.previewProgress !== null) {
    const myColor  = room.players?.[localState.playerId]?.color;
    const diceVal  = room.turn?.diceValue;
    if (myColor && diceVal) {
      const destProgress = localState.previewProgress;
      if (isOnMainPath(destProgress)) {
        const destRing    = getRingIndex(myColor, destProgress);
        const captureInfo = checkCaptureAt(room, destRing, myColor);
        if (captureInfo) {
          // Tachar la ficha que será comida en su posición actual
          const victimColor = captureInfo.victimColor;
          const victimProg  = captureInfo.victimProgress;
          const victimPos   = getVisualPosition(victimColor, victimProg, parseInt(captureInfo.victimPieceKey[1]));
          if (victimPos) {
            const victimCell = board.querySelector(`[data-cell="${cellKey(victimPos.col, victimPos.row)}"]`);
            if (victimCell) {
              const pieces = victimCell.querySelectorAll('.piece');
              pieces.forEach(p => {
                if (p.dataset.playerId === captureInfo.victimId) p.classList.add('piece-capture-preview');
              });
            }
          }
        }
      }
    }
  }
}

/**
 * Pinta las casillas de salida adicionales desbloqueadas por eventos.
 * Muestra el número (2, 3...) del color del jugador en el centro de la casilla.
 * @param {HTMLElement} board
 * @param {object} room
 */
function _renderExtraExitCells(board, room) {
  if (!room.players || !room.playerStats) return;

  for (const [pid, player] of Object.entries(room.players)) {
    const color   = player.color;
    const extras  = room.playerStats?.[pid]?.exitCells?.extras || [];
    if (extras.length === 0) continue;

    extras.forEach((ringIdx, idx) => {
      const pos = PATH_CELLS[ringIdx];
      if (!pos) return;

      const domCell = board.querySelector(`[data-cell="${cellKey(pos.col, pos.row)}"]`);
      if (!domCell) return;

      // Aplicar clase de salida extra
      domCell.classList.add('cell-path', `cell-exit-extra`, `cell-exit-extra-${color}`);

      // Agregar número (2, 3, 4...) en el centro
      if (!domCell.querySelector('.exit-cell-number')) {
        const num = document.createElement('span');
        num.className   = `exit-cell-number ${color}`;
        num.textContent = String(idx + 2); // 2, 3, 4...
        domCell.appendChild(num);
      }
    });
  }
}

/**
 * Renderiza todas las casillas especiales activas en el tablero.
 * @param {HTMLElement} board
 * @param {object} specialCells - mapa de Firebase { ringIdx: cellObject }
 */
function _renderSpecialCells(board, specialCells) {
  Object.entries(specialCells).forEach(([ringIdxStr, cell]) => {
    if (!cell) return;
    const ringIdx = parseInt(ringIdxStr);
    const pos     = PATH_CELLS[ringIdx];
    if (!pos) return;

    const domCell = board.querySelector(`[data-cell="${cellKey(pos.col, pos.row)}"]`);
    if (!domCell) return;

    const renderData = getSpecialCellRenderData(cell);
    if (!renderData) return;

    domCell.classList.add(renderData.cssClass);
    domCell.setAttribute('data-effect', renderData.effectLabel);

    // Símbolo central de la casilla
    const content = domCell.querySelector('.cell-content');
    if (content && !content.querySelector('.special-cell-symbol')) {
      const sym = document.createElement('span');
      sym.className   = 'special-cell-symbol';
      sym.textContent = renderData.symbol;
      sym.title       = getSpecialCellDescription(cell);
      content.appendChild(sym);
    }
  });
}

/**
 * Renderiza los contadores de fichas en meta en los triángulos centrales.
 * @param {HTMLElement} board
 * @param {object} room
 */
function _renderGoalCounters(board, room) {
  if (!room.pieces || !room.players) return;

  COLOR_ORDER.forEach(color => {
    const triangle = GOAL_TRIANGLES[color];
    if (!triangle) return;

    const domCell = board.querySelector(`[data-cell="${cellKey(triangle.col, triangle.row)}"]`);
    if (!domCell) return;

    // Contar fichas de este color en meta
    let count = 0;
    for (const [pid, pieces] of Object.entries(room.pieces)) {
      if (room.players[pid]?.color !== color) continue;
      for (let i = 0; i < PIECES_PER_PLAYER; i++) {
        if (isAtGoal(pieces['p' + i])) count++;
      }
    }

    if (count > 0) {
      const counter = document.createElement('div');
      counter.className   = 'goal-counter';
      counter.textContent = `${count}/4`;
      domCell.appendChild(counter);
    }
  });
}

/**
 * Construye el elemento HTML de una ficha.
 * @param {string} color
 * @param {string} playerId
 * @param {number} pieceIdx
 * @param {number} progress
 * @param {object} room
 * @param {Set<number>} validPieceIdxs - índices de fichas válidas para mover
 * @returns {HTMLElement}
 */
function _buildPieceElement(color, playerId, pieceIdx, progress, room, validPieceIdxs) {
  const piece = document.createElement('div');
  piece.className = `piece piece-${color}`;
  piece.dataset.playerId  = playerId;
  piece.dataset.pieceIdx  = pieceIdx;
  piece.textContent       = PIECE_LETTERS[pieceIdx];
  piece.title             = `${room.players?.[playerId]?.name} — Ficha ${PIECE_LETTERS[pieceIdx]}`;

  // Tamaño especial según posición
  if (isAtHome(progress))   piece.classList.add('piece-in-home');
  if (isAtGoal(progress))   piece.classList.add('piece-at-goal');

  // Indicador de Escudo Acme activo
  const shieldedPieces = room.playerStats?.[playerId]?.shieldedPieces || [];
  if (shieldedPieces.includes(pieceIdx)) {
    piece.classList.add('piece-shielded');
  }

  const isOwn = (playerId === localState.playerId);
  const myTurn = isMyTurn(room);

  // ¿Ficha con movimiento válido?
  if (isOwn && myTurn && validPieceIdxs.has(pieceIdx) && room.turn?.rolled) {
    piece.classList.add('piece-clickable');
    piece.addEventListener('click', (e) => {
      e.stopPropagation();
      onPieceTap(playerId, pieceIdx);
    });
  } else if (!isOwn && myTurn && localState.shieldTargetMode) {
    // Modo de asignación de escudo: no clickeable sobre rivales
  } else if (isOwn && myTurn && localState.shieldTargetMode) {
    // En modo shield: fichas propias en camino son clickeables
    if (isOnMainPath(progress)) {
      piece.classList.add('piece-clickable');
      piece.addEventListener('click', (e) => {
        e.stopPropagation();
        onShieldPieceSelected(pieceIdx);
      });
    }
  } else {
    piece.classList.add('piece-disabled');
  }

  // Ficha seleccionada actualmente
  if (isOwn && localState.selectedPieceIdx === pieceIdx) {
    piece.classList.add('piece-selected');
  }

  return piece;
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 21 — RENDERIZADO DE UI Y PANELES DE JUGADORES
═══════════════════════════════════════════════════════════════════ */

/**
 * Actualiza todos los paneles de jugadores y los controles del turno.
 * Se llama en cada update de Firebase.
 * @param {object} room
 */
function renderAllPanels(room) {
  if (!room) return;
  renderPlayerPanels(room);
  renderMobilePanels(room);
  renderTurnControls(room);
  renderDiceDisplay(room);
  renderWildcardButtons(room);
  renderBonusTurnsInfo(room);
}

/**
 * Clona los paneles de jugadores al contenedor móvil (2x2 grid).
 * @param {object} room
 */
function renderMobilePanels(room) {
  const mobileContainer = document.getElementById('game-players-info-mobile');
  if (!mobileContainer) return;
  mobileContainer.innerHTML = '';

  const ordered = getPlayersOrdered(room, false);
  const currentTurnId = room.turn?.playerId;

  ordered.forEach(pid => {
    const player = room.players?.[pid];
    if (!player) return;
    const color  = player.color;
    const pieces = room.pieces?.[pid] || {};
    const stats  = room.playerStats?.[pid] || {};
    const shielded = stats.shieldedPieces || [];
    const isActive = pid === currentTurnId;

    const panel = document.createElement('div');
    panel.className = `player-panel player-panel-${color}${isActive ? ' is-active-turn' : ''}`;

    const piecesHtml = Array.from({length: PIECES_PER_PLAYER}, (_, i) => {
      const prog    = pieces['p' + i];
      const letter  = PIECE_LETTERS[i];
      const inBase  = isAtHome(prog);
      const atGoal  = isAtGoal(prog);
      const hasShield = shielded.includes(i);
      const cls = [inBase ? 'in-base' : atGoal ? 'at-goal' : '', hasShield ? 'has-shield' : ''].join(' ');
      return `<span class="piece-badge ${color} ${cls}">${letter}</span>`;
    }).join('');

    panel.innerHTML = `
      <div class="panel-name-row">
        <span class="panel-color-dot ${color}"></span>
        <span class="panel-player-name">${escapeHtml(player.name)}${pid === localState.playerId ? ' (Tú)' : ''}</span>
        ${isActive ? '<span class="panel-turn-arrow">▶</span>' : ''}
      </div>
      <div class="panel-pieces-row">${piecesHtml}</div>
      <div>${renderExitNumbersHTML(room, pid)}</div>
      <div>${_renderWildcardChipsHTML(room, pid)}</div>
    `;
    mobileContainer.appendChild(panel);
  });
}

/**
 * Renderiza los 4 paneles de jugadores (azul, amarillo, rojo, verde).
 * @param {object} room
 */
function renderPlayerPanels(room) {
  const ordered = getPlayersOrdered(room, false);
  const currentTurnId = room.turn?.playerId;

  // Ocultar paneles de colores no usados
  COLOR_ORDER.forEach(color => {
    const panel = document.getElementById(`panel-${color}`);
    if (panel) panel.style.display = 'none';
  });

  ordered.forEach(pid => {
    const player  = room.players?.[pid];
    if (!player) return;
    const color   = player.color;
    const panel   = document.getElementById(`panel-${color}`);
    if (!panel) return;

    panel.style.display = '';
    panel.classList.toggle('is-active-turn', pid === currentTurnId);

    // Nombre
    const nameEl = document.getElementById(`name-${color}`);
    if (nameEl) {
      nameEl.textContent = player.name + (pid === localState.playerId ? ' (Tú)' : '');
    }

    // Flecha de turno activo
    const arrowEl = document.getElementById(`arrow-${color}`);
    if (arrowEl) arrowEl.style.display = pid === currentTurnId ? 'inline' : 'none';

    // Fichas A B C D
    const piecesEl = document.getElementById(`pieces-${color}`);
    if (piecesEl) piecesEl.innerHTML = _renderPieceBadgesHTML(pid, color, room);

    // Números de salida
    const exitEl = document.getElementById(`exit-nums-${color}`);
    if (exitEl) exitEl.innerHTML = renderExitNumbersHTML(room, pid);

    // Comodines
    const wcEl = document.getElementById(`wildcards-${color}`);
    if (wcEl) wcEl.innerHTML = _renderWildcardChipsHTML(room, pid);
  });
}

/**
 * Genera el HTML de las fichas A/B/C/D para el panel.
 * @param {string} playerId
 * @param {string} color
 * @param {object} room
 * @returns {string} HTML
 */
function _renderPieceBadgesHTML(playerId, color, room) {
  const pieces         = room.pieces?.[playerId] || {};
  const shieldedPieces = room.playerStats?.[playerId]?.shieldedPieces || [];
  let html = '';

  for (let i = 0; i < PIECES_PER_PLAYER; i++) {
    const progress  = pieces['p' + i];
    const letter    = PIECE_LETTERS[i];
    const inBase    = isAtHome(progress);
    const atGoal    = isAtGoal(progress);
    const hasShield = shieldedPieces.includes(i);
    const stateClass = inBase ? 'in-base' : atGoal ? 'at-goal' : '';
    const shieldAttr = hasShield ? 'has-shield' : '';

    html += `<span class="piece-badge ${color} ${stateClass} ${shieldAttr}" title="Ficha ${letter}">${letter}</span>`;
  }

  return html;
}

/**
 * Genera el HTML de chips de comodines para el panel de un jugador.
 * @param {object} room
 * @param {string} playerId
 * @returns {string} HTML
 */
function _renderWildcardChipsHTML(room, playerId) {
  if (!room.config || room.config.gameMode !== GAME_MODES.WILD) return '';
  const wildcards = room.playerStats?.[playerId]?.wildcards;
  const display   = getWildcardDisplayData(wildcards);
  if (display.length === 0) return '<span style="font-size:.7rem;color:var(--text-muted)">Sin comodines</span>';

  return display.map(w =>
    `<span class="wildcard-chip">
      <span class="wc-icon">${w.icon}</span>
      <span>${w.name}</span>
      <span class="wc-count">×${w.count}</span>
    </span>`
  ).join('');
}

/**
 * Renderiza los controles del turno: turno actual, dado, botón tirar.
 * @param {object} room
 */
function renderTurnControls(room) {
  const rollBtn      = document.getElementById('btn-roll');
  const notYourTurn  = document.getElementById('not-your-turn-msg');
  const currentName  = document.getElementById('current-turn-name');

  if (!room.turn) return;

  const myTurn     = isMyTurn(room);
  const rolled     = room.turn.rolled || false;
  const currentPlayer = room.players?.[room.turn.playerId];

  if (currentName) {
    currentName.textContent = currentPlayer?.name || '---';
  }

  // Botón tirar dado: visible si es mi turno y no tiré aún
  if (rollBtn) {
    rollBtn.style.display = (myTurn && !rolled) ? 'inline-flex' : 'none';
  }
  if (notYourTurn) {
    notYourTurn.style.display = (!myTurn) ? 'block' : 'none';
  }

  // Botón confirmar: siempre visible, activo solo cuando hay preview
  const confirmBtn = document.getElementById('btn-confirm-move');
  const hasPreview = myTurn && rolled && localState.selectedPieceIdx !== null && localState.previewProgress !== null;
  if (confirmBtn) {
    confirmBtn.disabled = !hasPreview;
    confirmBtn.style.opacity = hasPreview ? '1' : '0.4';
    confirmBtn.textContent   = hasPreview ? '✅ Confirmar' : 'Selecciona una ficha';
  }
}

/**
 * Renderiza el display del dado.
 * @param {object} room
 */
function renderDiceDisplay(room) {
  const diceDisplay = document.getElementById('dice-display');
  const diceValue   = document.getElementById('dice-value');
  if (!diceDisplay || !diceValue) return;

  if (!room.turn?.rolled || !room.turn?.diceValue) {
    diceValue.textContent = '🎲';
    diceDisplay.classList.remove('rolled');
  } else {
    const val = room.turn.diceValue;
    diceValue.textContent = DICE_EMOJI[val] || val;
    diceDisplay.classList.add('rolled');
    diceDisplay.classList.toggle('rolling', false);
  }

  // Mostrar info de seises consecutivos
  const sixInfo    = document.getElementById('six-counter-info');
  const sixCount   = document.getElementById('six-count');
  const consecutive = room.turn?.consecutiveSixes || 0;
  if (sixInfo && sixCount) {
    sixInfo.style.display = consecutive > 0 ? 'block' : 'none';
    sixCount.textContent  = consecutive;
  }
}

/**
 * Renderiza los botones de comodines disponibles para el turno actual.
 * Solo muestra los comodines que el jugador puede usar en este momento.
 * También actualiza el botón fijo de comodín (móvil).
 * @param {object} room
 */
function renderWildcardButtons(room) {
  const container    = document.getElementById('wildcard-buttons');
  const mobileWcBtn  = document.getElementById('btn-wildcard-mobile');

  if (container) container.innerHTML = '';

  // Botón móvil: siempre visible, gris si no hay comodines o no es tu turno
  if (mobileWcBtn) {
    const hasAny = isMyTurn(room) &&
      room.config?.gameMode === GAME_MODES.WILD &&
      getTotalWildcards(room.playerStats?.[localState.playerId]?.wildcards) > 0;
    mobileWcBtn.disabled       = !hasAny;
    mobileWcBtn.style.opacity  = hasAny ? '1' : '0.4';
    mobileWcBtn.style.cursor   = hasAny ? 'pointer' : 'not-allowed';
  }

  if (!container) return;
  if (!isMyTurn(room) || room.config?.gameMode !== GAME_MODES.WILD) return;

  const rolled     = room.turn?.rolled || false;
  const wildcards  = room.playerStats?.[localState.playerId]?.wildcards || {};

  // Ataque Dirigido: solo antes de tirar
  if (!rolled && hasWildcard(wildcards, WILDCARD_TYPES.DIR_ATTACK)) {
    const canUse = canUseDirAttack(room, localState.playerId);
    const btn    = _buildWildcardBtn(WILDCARD_TYPES.DIR_ATTACK, wildcards, canUse);
    btn.addEventListener('click', activateDirAttack);
    container.appendChild(btn);
  }

  // Descarte: solo después de tirar
  if (rolled && canUseDiscard(room)) {
    const btn = _buildWildcardBtn(WILDCARD_TYPES.DISCARD, wildcards, true);
    btn.addEventListener('click', activateDiscard);
    container.appendChild(btn);
  }

  // Escudo Acme: en cualquier momento del turno
  if (hasWildcard(wildcards, WILDCARD_TYPES.ACME_SHIELD)) {
    const targets = getShieldableTargets(room, localState.playerId);
    const btn     = _buildWildcardBtn(WILDCARD_TYPES.ACME_SHIELD, wildcards, targets.length > 0);
    btn.addEventListener('click', activateAcmeShield);
    container.appendChild(btn);
  }
}

/**
 * Construye el botón de un comodín para la zona de controles.
 * @param {string} type
 * @param {object} wildcards
 * @param {boolean} enabled
 * @returns {HTMLElement}
 */
function _buildWildcardBtn(type, wildcards, enabled) {
  const config = WILDCARD_CONFIG[type];
  const count  = wildcards[type] || 0;
  const btn    = document.createElement('button');
  btn.className  = `wildcard-use-btn${enabled ? '' : ' disabled'}`;
  btn.disabled   = !enabled;
  btn.title      = config?.description || type;
  btn.innerHTML  = `${config?.icon || '?'} ${config?.name || type} ×${count}`;
  return btn;
}

/**
 * Renderiza el indicador de turnos extra.
 * @param {object} room
 */
function renderBonusTurnsInfo(room) {
  const el    = document.getElementById('bonus-turns-info');
  const count = document.getElementById('bonus-turns-count');
  if (!el || !count) return;

  const bonus = room.turn?.bonusTurns || 0;
  el.style.display    = (isMyTurn(room) && bonus > 0) ? 'block' : 'none';
  count.textContent   = bonus;
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 22 — RENDERIZADO DE COMODINES Y ESTADÍSTICAS
   (Las estadísticas por jugador se muestran en los paneles,
   los comodines activos durante el turno en los controles)
═══════════════════════════════════════════════════════════════════ */

/**
 * Actualiza la visualización de las fichas con escudo en el tablero.
 * Se llama cuando un Escudo Acme es asignado o consumido.
 * @param {object} room
 */
function refreshShieldedPieces(room) {
  // Re-renderizar el tablero completo para actualizar los indicadores de escudo
  renderBoard(room);
  renderAllPanels(room);
}

/**
 * Genera el resumen de stats de un jugador para el tooltip/hover.
 * @param {object} room
 * @param {string} playerId
 * @returns {string}
 */
function getPlayerStatsTooltip(room, playerId) {
  const stats = room.playerStats?.[playerId];
  if (!stats) return '';
  return [
    `Comidas: ${stats.piecesEaten || 0}`,
    `Regresadas: ${stats.piecesSentBack || 0}`,
    `Salida con: ${(stats.exitNumbers || [1,6]).join(', ')}`,
  ].join(' | ');
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 23 — UI DE LOBBY, CONFIG Y SALA DE ESPERA
═══════════════════════════════════════════════════════════════════ */

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const t = document.getElementById(screenId);
  if (t) t.classList.add('active');
}

function showWaitingRoom(roomCode) {
  showScreen('screen-waiting');
  const codeEl = document.getElementById('display-room-code');
  if (codeEl) codeEl.textContent = roomCode;
  const urlEl = document.getElementById('display-room-url');
  if (urlEl) urlEl.textContent = getRoomUrl(roomCode);
}

function updateWaitingRoomUI(room) {
  const players   = room.players || {};
  const playerIds = Object.keys(players);
  const maxP      = room.config?.maxPlayers || MAX_PLAYERS_GLOBAL;
  const gameMode  = room.config?.gameMode   || GAME_MODES.CLASSIC;

  const countEl = document.getElementById('player-count');
  if (countEl) countEl.textContent = `${playerIds.length} / ${maxP}`;

  const modeBadge = document.getElementById('waiting-mode-badge');
  if (modeBadge) {
    const modeLabels = { classic: '♟️ Clásico', race: '⭐ Race', wild: '🃏 Wild' };
    modeBadge.textContent = modeLabels[gameMode] || gameMode;
    modeBadge.style.display = 'block';
  }

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
      li.innerHTML = `
        <div class="waiting-color-dot ${p.color}"></div>
        <span class="waiting-player-name">${escapeHtml(p.name)}</span>
        ${pid === room.hostId        ? '<span class="host-badge">Anfitrión</span>' : ''}
        ${pid === localState.playerId ? '<span class="you-badge">Tú</span>'         : ''}
      `;
      list.appendChild(li);
    });
  }

  const btnStart  = document.getElementById('btn-start');
  const hint      = document.getElementById('start-hint');
  const waitMsg   = document.getElementById('waiting-for-host');
  const isHost    = room.hostId === localState.playerId;
  const minP      = gameMode === GAME_MODES.WILD ? MIN_PLAYERS_WILD : MIN_PLAYERS_GLOBAL;
  const canStart  = playerIds.length >= minP;

  if (isHost) {
    if (btnStart)  { btnStart.style.display = 'block'; btnStart.disabled = !canStart; }
    if (hint)       hint.style.display  = canStart ? 'none' : 'block';
    if (waitMsg)    waitMsg.style.display = 'none';
  } else {
    if (btnStart)   btnStart.style.display  = 'none';
    if (hint)       hint.style.display      = 'none';
    if (waitMsg)    waitMsg.style.display   = 'block';
  }
}

function showLobbyError(msg) {
  const el = document.getElementById('lobby-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function showGameMsg(msg) {
  const el = document.getElementById('game-msg');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(window._gameMsgTO);
  window._gameMsgTO = setTimeout(() => { el.style.display = 'none'; }, MSG_DURATION_MS);
}

function showLoadingModal(text) {
  const m = document.getElementById('loading-modal');
  const t = document.getElementById('loading-modal-text');
  if (t && text) t.textContent = text;
  if (m) m.style.display = 'flex';
}

function hideLoadingModal() {
  const m = document.getElementById('loading-modal');
  if (m) m.style.display = 'none';
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 24 — LOG DE EVENTOS
═══════════════════════════════════════════════════════════════════ */

async function addGameEvent(msg, cssType) {
  if (!localState.roomCode || !localState.db) return;
  const key = `${Date.now()}_${Math.random().toString(36).substr(2,4)}`;
  try {
    await localState.db.ref(`${FB_ROOMS_PATH}/${localState.roomCode}/eventLog/${key}`)
      .set({ msg, type: cssType || 'event-turn', ts: firebase.database.ServerValue.TIMESTAMP });
  } catch (err) { console.warn('[addGameEvent]', err.message); }
}

function updateEventLog(eventLog) {
  const log = document.getElementById('game-event-log');
  if (!log) return;
  if (!eventLog) { log.innerHTML = '<li class="event-item">Sin eventos...</li>'; return; }

  const sorted = Object.values(eventLog)
    .sort((a, b) => (b.ts||0) - (a.ts||0))
    .slice(0, EVENT_LOG_MAX);

  log.innerHTML = sorted.map(e =>
    `<li class="event-item ${e.type||''}">${escapeHtml(String(e.msg||''))}</li>`
  ).join('');
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 25 — FUNCIONES DE UTILIDAD
═══════════════════════════════════════════════════════════════════ */

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function copyToClipboard(text, btn) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
  }
  if (btn) {
    const orig = btn.textContent; btn.textContent = '✅';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  }
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 26 — MANEJADORES DE EVENTOS (CLICS DE UI)
═══════════════════════════════════════════════════════════════════ */

/**
 * Muestra el modal de selección de comodín (versión móvil y desktop).
 * Lista los comodines disponibles y permite elegir o cancelar.
 * @param {object} room
 */
function showWildcardPickerModal(room) {
  if (!isMyTurn(room) || room.config?.gameMode !== GAME_MODES.WILD) return;

  const rolled    = room.turn?.rolled || false;
  const wildcards = room.playerStats?.[localState.playerId]?.wildcards || {};
  const available = [];

  if (!rolled && hasWildcard(wildcards, WILDCARD_TYPES.DIR_ATTACK) && canUseDirAttack(room, localState.playerId)) {
    available.push({ type: WILDCARD_TYPES.DIR_ATTACK, config: WILDCARD_CONFIG[WILDCARD_TYPES.DIR_ATTACK], count: wildcards[WILDCARD_TYPES.DIR_ATTACK] });
  }
  if (rolled && hasWildcard(wildcards, WILDCARD_TYPES.DISCARD) && canUseDiscard(room)) {
    available.push({ type: WILDCARD_TYPES.DISCARD, config: WILDCARD_CONFIG[WILDCARD_TYPES.DISCARD], count: wildcards[WILDCARD_TYPES.DISCARD] });
  }
  if (hasWildcard(wildcards, WILDCARD_TYPES.ACME_SHIELD)) {
    const targets = getShieldableTargets(room, localState.playerId);
    if (targets.length > 0) {
      available.push({ type: WILDCARD_TYPES.ACME_SHIELD, config: WILDCARD_CONFIG[WILDCARD_TYPES.ACME_SHIELD], count: wildcards[WILDCARD_TYPES.ACME_SHIELD] });
    }
  }

  if (available.length === 0) { showGameMsg('No tienes comodines disponibles ahora.'); return; }

  // Reutilizar el modal de ataque con contenido dinámico
  const modal     = document.getElementById('modal-attack-target');
  const container = document.getElementById('attack-targets');
  const titleEl   = modal?.querySelector('h2');
  const subtitleEl = modal?.querySelector('p.modal-subtitle');
  if (!modal || !container) return;

  if (titleEl)    titleEl.textContent    = '🃏 Usar comodín';
  if (subtitleEl) subtitleEl.textContent = 'Elige qué comodín activar o cancela';

  container.innerHTML = '';
  available.forEach(({ type, config, count }) => {
    const btn = document.createElement('button');
    btn.className   = 'attack-target-btn';
    btn.innerHTML   = `${config.icon} <strong>${config.name}</strong> ×${count}<br><small style="color:var(--text-muted)">${config.description.slice(0,60)}...</small>`;
    btn.addEventListener('click', () => {
      modal.style.display = 'none';
      // Restaurar título
      if (titleEl)    titleEl.textContent    = '🎯 Ataque Dirigido';
      if (subtitleEl) subtitleEl.textContent = 'Elige una ficha rival para retroceder 10 casillas';
      switch(type) {
        case WILDCARD_TYPES.DIR_ATTACK:  activateDirAttack();  break;
        case WILDCARD_TYPES.DISCARD:     activateDiscard();    break;
        case WILDCARD_TYPES.ACME_SHIELD: activateAcmeShield(); break;
      }
    });
    container.appendChild(btn);
  });

  modal.style.display = 'flex';
}

function registerUIListeners() {

  // ── Lobby ──────────────────────────────────────────────────────
  document.getElementById('btn-create')?.addEventListener('click', () =>
    createRoom(document.getElementById('create-name')?.value || ''));

  document.getElementById('create-name')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-create')?.click();
  });

  document.getElementById('btn-join')?.addEventListener('click', () =>
    joinRoom(
      document.getElementById('join-code')?.value  || '',
      document.getElementById('join-name')?.value  || ''
    ));

  ['join-code','join-name'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-join')?.click();
    });
  });

  document.getElementById('btn-reconnect')?.addEventListener('click', attemptReconnect);
  document.getElementById('btn-clear-session')?.addEventListener('click', () => {
    clearSession();
    document.getElementById('reconnect-panel').style.display = 'none';
  });

  // Pre-llenar código si viene en la URL
  const urlCode = getUrlRoomCode();
  if (urlCode) {
    const el = document.getElementById('join-code');
    if (el) el.value = urlCode;
  }

  // ── Pantalla de configuración ──────────────────────────────────
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updatePendingConfig('gameMode', btn.dataset.mode);
    });
  });

  document.querySelectorAll('.num-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.num-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updatePendingConfig('maxPlayers', parseInt(btn.dataset.players, 10));
    });
  });

  document.getElementById('config-timer')?.addEventListener('input', e => {
    updatePendingConfig('timerSeconds', parseInt(e.target.value, 10) || TIMER_SECONDS_DEFAULT);
  });
  document.getElementById('config-positive-cells')?.addEventListener('input', e => {
    updatePendingConfig('positiveCells', parseInt(e.target.value, 10) || 0);
  });
  document.getElementById('config-negative-cells')?.addEventListener('input', e => {
    updatePendingConfig('negativeCells', parseInt(e.target.value, 10) || 0);
  });

  document.getElementById('btn-config-continue')?.addEventListener('click', () => {
    syncConfigFromUI();
    confirmConfig();
  });

  document.getElementById('btn-config-back')?.addEventListener('click', () => {
    showScreen('screen-lobby');
  });

  // ── Sala de espera ─────────────────────────────────────────────
  document.getElementById('btn-start')?.addEventListener('click', startGame);

  document.getElementById('btn-copy-code')?.addEventListener('click', e => {
    copyToClipboard(document.getElementById('display-room-code')?.textContent || '', e.currentTarget);
  });
  document.getElementById('btn-copy-url')?.addEventListener('click', e => {
    copyToClipboard(document.getElementById('display-room-url')?.textContent || '', e.currentTarget);
  });

  document.getElementById('btn-leave-waiting')?.addEventListener('click', () => {
    if (confirm('¿Seguro que quieres salir de la sala?')) {
      clearSession();
      if (activeRoomListener && localState.roomCode) {
        localState.db?.ref(`${FB_ROOMS_PATH}/${localState.roomCode}`)
          .off('value', activeRoomListener);
      }
      showScreen('screen-lobby');
    }
  });

  // ── Pantalla de juego ──────────────────────────────────────────

  // Botón tirar dado
  document.getElementById('btn-roll')?.addEventListener('click', () => {
    if (isMyTurn(localState.room) && !localState.room?.turn?.rolled) {
      const diceEl = document.getElementById('dice-display');
      if (diceEl) { diceEl.classList.add('rolling'); setTimeout(() => diceEl.classList.remove('rolling'), 400); }
      rollDice();
    }
  });

  // Botón confirmar movimiento
  document.getElementById('btn-confirm-move')?.addEventListener('click', confirmMove);
  document.getElementById('btn-cancel-move')?.addEventListener('click', cancelMove);

  // Botón cancelar salida
  document.getElementById('btn-cancel-exit')?.addEventListener('click', () => {
    document.getElementById('modal-exit-choice').style.display = 'none';
    localState.selectedPieceIdx = null;
  });

  // Botón cancelar ataque
  document.getElementById('btn-cancel-attack')?.addEventListener('click', () => {
    document.getElementById('modal-attack-target').style.display = 'none';
  });

  // Botón cancelar escudo
  document.getElementById('btn-cancel-shield')?.addEventListener('click', () => {
    document.getElementById('modal-shield-assign').style.display = 'none';
    localState.shieldTargetMode = false;
  });

  // Botón comodín móvil
  document.getElementById('btn-wildcard-mobile')?.addEventListener('click', () => {
    const room = localState.room;
    if (room) showWildcardPickerModal(room);
  });

  // Toggle log de eventos
  document.getElementById('btn-toggle-log')?.addEventListener('click', () => {
    const panel = document.getElementById('event-log-panel');
    const btn   = document.getElementById('btn-toggle-log');
    if (!panel) return;
    panel.classList.toggle('expanded');
    if (btn) btn.textContent = panel.classList.contains('expanded') ? '▲' : '▼';
  });

  // ── Modal resultados ───────────────────────────────────────────
  document.getElementById('btn-new-game')?.addEventListener('click', () => {
    window.location.href = window.location.origin + window.location.pathname;
  });
}


/* ═══════════════════════════════════════════════════════════════════
   SECCIÓN 27 — RECONEXIÓN
═══════════════════════════════════════════════════════════════════ */

function checkStoredSession() {
  const code = localStorage.getItem('parchis_v2_roomCode');
  const name = localStorage.getItem('parchis_v2_playerName');
  if (!code || !name) return;

  const panel = document.getElementById('reconnect-panel');
  const info  = document.getElementById('reconnect-info');
  if (panel) panel.style.display = 'block';
  if (info)  info.textContent    = `Sala: ${code} · Nombre: ${name}`;
}

async function attemptReconnect() {
  const code = localStorage.getItem('parchis_v2_roomCode');
  const name = localStorage.getItem('parchis_v2_playerName');
  if (!code || !name) { showLobbyError('No hay sesión guardada.'); return; }
  if (!localState.playerId) { showLobbyError('Esperando conexión con Firebase...'); return; }

  showLoadingModal('Reconectando...');
  try {
    const snap = await localState.db.ref(`${FB_ROOMS_PATH}/${code}`).once('value');
    if (!snap.exists()) {
      hideLoadingModal();
      showLobbyError('La sala ya no existe.');
      clearSession();
      document.getElementById('reconnect-panel').style.display = 'none';
      return;
    }
    hideLoadingModal();
    await reconnectToRoom(code, name, snap.val());
  } catch (err) {
    hideLoadingModal();
    showLobbyError('Error al reconectar: ' + err.message);
  }
}

async function handleUrlRoom() {
  const urlCode = getUrlRoomCode();
  if (!urlCode) return;

  const el = document.getElementById('join-code');
  if (el) el.value = urlCode;

  const storedCode = localStorage.getItem('parchis_v2_roomCode');
  const storedName = localStorage.getItem('parchis_v2_playerName');

  if (storedCode === urlCode && storedName && localState.playerId) {
    try {
      const snap = await localState.db.ref(`${FB_ROOMS_PATH}/${urlCode}`).once('value');
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
   SECCIÓN 28 — INICIALIZACIÓN (DOMContentLoaded)
═══════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Parchís Online v2] Iniciando...');

  // 1. Registrar todos los event listeners de la UI
  registerUIListeners();

  // 2. Inicializar Firebase
  await initFirebase();

  // 3. Esperar a que Firebase Auth resuelva el UID
  await new Promise(resolve => {
    if (localState.playerId) { resolve(); return; }
    const unsub = localState.auth?.onAuthStateChanged(() => { unsub?.(); resolve(); });
    setTimeout(resolve, 3000); // Fallback de seguridad
  });

  // 4. Verificar sesión guardada → mostrar panel de reconexión
  checkStoredSession();

  // 5. Manejar ?room= en la URL
  await handleUrlRoom();

  console.log('[Parchís Online v2] Listo. PlayerId:', localState.playerId);
});
