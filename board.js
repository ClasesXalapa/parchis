/* ═══════════════════════════════════════════════════════════════════
   PARCHÍS ONLINE v2 — board.js
   Definición completa del tablero tipo Ludo/Parchís.

   LAYOUT DEL TABLERO (grid 15×15):
   ┌─────────────────────────────────┐
   │ AZUL(sup-izq) │   │ AMARILLO   │
   │   base        │   │ (sup-der)  │
   ├───────────────┤   ├────────────┤
   │               │   │            │
   ├───────────────┼───┼────────────┤
   │ ROJO          │ M │  VERDE     │
   │ (inf-izq)     │ E │  (inf-der) │
   │   base        │ T │  base      │
   └───────────────┴─A─┴────────────┘

   POSICIONES DE BASE:
   - Azul:     esquina superior izquierda (rows 0-5,  cols 0-5)
   - Amarillo: esquina superior derecha  (rows 0-5,  cols 9-14)
   - Rojo:     esquina inferior izquierda(rows 9-14, cols 0-5)
   - Verde:    esquina inferior derecha  (rows 9-14, cols 9-14)

   PASILLOS DE META (HOME_STRETCH) — 3 casillas cada uno:
   - Azul:     baja verticalmente desde arriba al centro
   - Amarillo: entra horizontalmente desde la derecha al centro
   - Rojo:     entra horizontalmente desde la izquierda al centro
   - Verde:    sube verticalmente desde abajo al centro

   PARA MODIFICAR EL TABLERO:
   Solo editar este archivo. app.js usa las funciones aquí definidas.
═══════════════════════════════════════════════════════════════════ */


/* ─────────────────────────────────────────────────────────────
   CONSTANTES DE RECORRIDO
───────────────────────────────────────────────────────────── */

// Total de casillas en el camino principal (anillo exterior)
const PATH_LENGTH = 52;

// Longitud de cada pasillo de meta
const HOME_STRETCH_LENGTH = 3;

// Valor de progress al llegar a meta
const GOAL_PROGRESS = PATH_LENGTH + HOME_STRETCH_LENGTH; // = 55

// Primer índice de progress del pasillo de meta
const HOME_STRETCH_START = PATH_LENGTH; // = 52

// Fichas en base
const HOME_PROGRESS = -1;

// Colores en orden de turno (se asignan según joinedAt)
const COLOR_ORDER = ['blue', 'yellow', 'red', 'green'];

// Nombres de colores para la UI
const COLOR_NAMES = {
  blue:   'Azul',
  yellow: 'Amarillo',
  red:    'Rojo',
  green:  'Verde',
};

// Hexadecimales de colores
const COLOR_HEX = {
  blue:   '#2980b9',
  yellow: '#d4ac0d',
  red:    '#e74c3c',
  green:  '#27ae60',
};

// Emojis de colores para eventos
const COLOR_EMOJI = {
  blue:   '🔵',
  yellow: '🟡',
  red:    '🔴',
  green:  '🟢',
};

// Letras identificadoras de fichas (visibles para todos)
const PIECE_LETTERS = ['A', 'B', 'C', 'D'];

// Número de fichas por jugador
const PIECES_PER_PLAYER = 4;


/* ─────────────────────────────────────────────────────────────
   CAMINO PRINCIPAL (PATH_CELLS)
   52 casillas en orden de recorrido para el color AZUL.
   El azul empieza en índice 0.
   Cada color tiene un offset diferente (EXIT_CELLS[color]).

   Sentido: horario (mirando desde arriba)
   Azul sale en col=1,row=6 y avanza hacia abajo primero.

   Formato: {col, row} — col=0 izquierda, row=0 arriba
───────────────────────────────────────────────────────────── */
const PATH_CELLS = [
  // ── LADO IZQUIERDO — subiendo por col 0 (filas 8→6) ─────────
  // (punto de entrada desde la esquina inferior izquierda al brazo izquierdo)
  {col:0,  row:8},   // 0   ← salida del brazo izquierdo (fila 8)
  {col:0,  row:7},   // 1
  {col:0,  row:6},   // 2   ← esquina superior izquierda del anillo

  // ── BRAZO SUPERIOR — yendo a la derecha (fila 6, cols 1→5) ──
  {col:1,  row:6},   // 3
  {col:2,  row:6},   // 4
  {col:3,  row:6},   // 5
  {col:4,  row:6},   // 6
  {col:5,  row:6},   // 7

  // ── BRAZO NORTE IZQUIERDO — subiendo (col 6, filas 5→0) ──────
  {col:6,  row:5},   // 8
  {col:6,  row:4},   // 9
  {col:6,  row:3},   // 10
  {col:6,  row:2},   // 11
  {col:6,  row:1},   // 12
  {col:6,  row:0},   // 13  ← SALIDA AZUL (segura permanente)

  // ── TOPE SUPERIOR — cruzando (fila 0, cols 7→8) ──────────────
  {col:7,  row:0},   // 14
  {col:8,  row:0},   // 15  ← esquina superior derecha del brazo norte

  // ── BRAZO NORTE DERECHO — bajando (col 8, filas 1→5) ─────────
  {col:8,  row:1},   // 16
  {col:8,  row:2},   // 17
  {col:8,  row:3},   // 18
  {col:8,  row:4},   // 19
  {col:8,  row:5},   // 20

  // ── BRAZO SUPERIOR DERECHO — yendo a la derecha (fila 6, cols 9→14) ──
  {col:9,  row:6},   // 21
  {col:10, row:6},   // 22
  {col:11, row:6},   // 23
  {col:12, row:6},   // 24
  {col:13, row:6},   // 25
  {col:14, row:6},   // 26  ← SALIDA AMARILLO (segura permanente)

  // ── LADO DERECHO — bajando (col 14, filas 7→8) ───────────────
  {col:14, row:7},   // 27
  {col:14, row:8},   // 28  ← esquina inferior derecha del anillo

  // ── BRAZO INFERIOR DERECHO — yendo a la izquierda (fila 8, cols 13→9) ──
  {col:13, row:8},   // 29
  {col:12, row:8},   // 30
  {col:11, row:8},   // 31
  {col:10, row:8},   // 32
  {col:9,  row:8},   // 33

  // ── BRAZO SUR DERECHO — bajando (col 8, filas 9→14) ──────────
  {col:8,  row:9},   // 34
  {col:8,  row:10},  // 35
  {col:8,  row:11},  // 36
  {col:8,  row:12},  // 37
  {col:8,  row:13},  // 38
  {col:8,  row:14},  // 39  ← SALIDA VERDE (segura permanente)

  // ── TOPE INFERIOR — cruzando (fila 14, cols 7→6) ─────────────
  {col:7,  row:14},  // 40
  {col:6,  row:14},  // 41  ← esquina inferior izquierda del brazo sur

  // ── BRAZO SUR IZQUIERDO — subiendo (col 6, filas 13→9) ───────
  {col:6,  row:13},  // 42
  {col:6,  row:12},  // 43
  {col:6,  row:11},  // 44
  {col:6,  row:10},  // 45
  {col:6,  row:9},   // 46

  // ── BRAZO INFERIOR IZQUIERDO — yendo a la izquierda (fila 8, cols 5→0) ──
  {col:5,  row:8},   // 47
  {col:4,  row:8},   // 48
  {col:3,  row:8},   // 49
  {col:2,  row:8},   // 50
  {col:1,  row:8},   // 51  ← SALIDA ROJO (segura permanente)
  // → vuelve a índice 0 ({col:0,row:8}) completando el ciclo
];

// Verificación en desarrollo
if (PATH_CELLS.length !== PATH_LENGTH) {
  console.error(`[board.js] ERROR: PATH_CELLS tiene ${PATH_CELLS.length} casillas, se esperaban ${PATH_LENGTH}`);
}


/* ─────────────────────────────────────────────────────────────
   CASILLAS DE SALIDA POR COLOR
   Índice en PATH_CELLS donde aparece la ficha al salir de base.
   Cada color inicia su recorrido desde este índice.
───────────────────────────────────────────────────────────── */
const EXIT_CELL_INDEX = {
  blue:   13,  // PATH_CELLS[13] = {col:6, row:0}
  yellow: 26,  // PATH_CELLS[26] = {col:13, row:6}
  red:     0,  // PATH_CELLS[0]  = {col:0, row:8}  ← simétrico (fix)
  green:  39,  // PATH_CELLS[39] = {col:8, row:14}
};


/* ─────────────────────────────────────────────────────────────
   PASILLOS DE META POR COLOR (HOME_STRETCH)
   3 casillas de color antes de llegar al centro.
   progress 52 = primera casilla del pasillo
   progress 54 = última casilla antes de meta
   progress 55 = META
───────────────────────────────────────────────────────────── */
const HOME_STRETCH = {
  // Azul: baja verticalmente desde la parte superior al centro
  blue: [
    {col:7, row:1},  // progress 52
    {col:7, row:2},  // progress 53
    {col:7, row:3},  // progress 54
  ],

  // Amarillo: entra horizontalmente desde la derecha al centro
  yellow: [
    {col:13, row:7}, // progress 52
    {col:12, row:7}, // progress 53
    {col:11, row:7}, // progress 54
  ],

  // Rojo: entra horizontalmente desde la izquierda al centro
  red: [
    {col:1,  row:7}, // progress 52
    {col:2,  row:7}, // progress 53
    {col:3,  row:7}, // progress 54
  ],

  // Verde: sube verticalmente desde la parte inferior al centro
  green: [
    {col:7, row:13}, // progress 52
    {col:7, row:12}, // progress 53
    {col:7, row:11}, // progress 54
  ],
};


/* ─────────────────────────────────────────────────────────────
   META COMPARTIDA — Zona central del tablero
   Las fichas que llegan a meta se muestran como contador
   dentro del triángulo de su color en el centro.
   La casilla (7,7) es el punto central.
───────────────────────────────────────────────────────────── */
const GOAL_POSITION = {col:7, row:7}; // progress = GOAL_PROGRESS (55)

// Celdas que forman los triángulos de meta (display visual)
const GOAL_TRIANGLES = {
  blue:   {col:7, row:5},  // Triángulo azul (apunta hacia abajo, en la parte superior)
  yellow: {col:9, row:7},  // Triángulo amarillo (apunta hacia la izquierda, en la derecha)
  red:    {col:5, row:7},  // Triángulo rojo (apunta hacia la derecha, en la izquierda)
  green:  {col:7, row:9},  // Triángulo verde (apunta hacia arriba, en la parte inferior)
};

// Celdas adicionales del centro (relleno de la zona central)
const CENTER_CELLS = [
  // Brazo horizontal del centro
  {col:5,row:7},{col:6,row:7},{col:7,row:7},{col:8,row:7},{col:9,row:7},
  // Brazo vertical del centro
  {col:7,row:5},{col:7,row:6},{col:7,row:8},{col:7,row:9},
  // Celdas diagonales del relleno
  {col:6,row:6},{col:8,row:6},{col:6,row:8},{col:8,row:8},
];


/* ─────────────────────────────────────────────────────────────
   POSICIONES DE FICHAS EN CASA (HOME_POSITIONS)
   Las 4 fichas de cada color se muestran en estas
   posiciones cuando están en la base (progress = -1).
───────────────────────────────────────────────────────────── */
const HOME_POSITIONS = {
  // Azul: esquina superior izquierda (rows 0-5, cols 0-5)
  blue: [
    {col:1, row:1}, // Ficha A
    {col:3, row:1}, // Ficha B
    {col:1, row:3}, // Ficha C
    {col:3, row:3}, // Ficha D
  ],

  // Amarillo: esquina superior derecha (rows 0-5, cols 9-14)
  yellow: [
    {col:11, row:1}, // Ficha A
    {col:13, row:1}, // Ficha B
    {col:11, row:3}, // Ficha C
    {col:13, row:3}, // Ficha D
  ],

  // Rojo: esquina inferior izquierda (rows 9-14, cols 0-5)
  red: [
    {col:1,  row:11}, // Ficha A
    {col:3,  row:11}, // Ficha B
    {col:1,  row:13}, // Ficha C
    {col:3,  row:13}, // Ficha D
  ],

  // Verde: esquina inferior derecha (rows 9-14, cols 9-14)
  green: [
    {col:11, row:11}, // Ficha A
    {col:13, row:11}, // Ficha B
    {col:11, row:13}, // Ficha C
    {col:13, row:13}, // Ficha D
  ],
};


/* ─────────────────────────────────────────────────────────────
   ESTRUCTURA EXIT_CELLS
   Mantiene la casilla de salida principal y las adicionales
   desbloqueadas por eventos para cada jugador.
   Las distancias adicionales son: +6, +8, +10, +12 desde la salida principal.
   Se modifica en Firebase durante la partida.
───────────────────────────────────────────────────────────── */
const EXIT_CELLS_TEMPLATE = {
  blue:   { main: EXIT_CELL_INDEX.blue,   extras: [] },
  yellow: { main: EXIT_CELL_INDEX.yellow, extras: [] },
  red:    { main: EXIT_CELL_INDEX.red,    extras: [] },
  green:  { main: EXIT_CELL_INDEX.green,  extras: [] },
};

// Distancias disponibles para casillas de salida adicionales
// Se añaden en orden: primero +6, luego +8, luego +10, luego +12
const EXIT_EXTRA_DISTANCES = [6, 8, 10, 12];


/* ─────────────────────────────────────────────────────────────
   FUNCIONES DE CONVERSIÓN DE POSICIÓN

   El sistema de PROGRESS es la posición de una ficha:
   -1              → en base
   0 a 51          → en camino principal
   52 a 54         → en pasillo de meta (HOME_STRETCH)
   55              → en meta (GOAL_PROGRESS)
───────────────────────────────────────────────────────────── */

/**
 * Convierte el progress de una ficha a su índice en PATH_CELLS.
 * Solo aplica para progress 0-51 (camino principal).
 * Cada color tiene un offset diferente (EXIT_CELL_INDEX).
 * @param {string} color
 * @param {number} progress - 0 a 51
 * @returns {number} índice en PATH_CELLS (0-51)
 */
function getRingIndex(color, progress) {
  // SENTIDO ANTIHORARIO: se resta el progress del índice de salida.
  // Para ir en sentido horario cambiar a: (EXIT_CELL_INDEX[color] + progress) % PATH_LENGTH
  return (EXIT_CELL_INDEX[color] - progress + PATH_LENGTH * 4) % PATH_LENGTH;
}

/**
 * Convierte el progress de una ficha a su posición visual {col, row} en el grid.
 * Maneja todos los estados: base, camino, pasillo de meta, meta.
 * @param {string} color
 * @param {number} progress
 * @param {number} pieceIdx - índice de la ficha (0-3), usado para posición en base
 * @returns {{col: number, row: number}|null}
 */
function getVisualPosition(color, progress, pieceIdx) {
  // En base
  if (progress === HOME_PROGRESS) {
    return HOME_POSITIONS[color]?.[pieceIdx] || null;
  }

  // En meta
  if (progress === GOAL_PROGRESS) {
    return GOAL_POSITION;
  }

  // En pasillo de meta
  if (progress >= HOME_STRETCH_START && progress < GOAL_PROGRESS) {
    const stretchIdx = progress - HOME_STRETCH_START; // 0, 1 o 2
    return HOME_STRETCH[color]?.[stretchIdx] || null;
  }

  // En camino principal
  if (progress >= 0 && progress < PATH_LENGTH) {
    const ringIdx = getRingIndex(color, progress);
    return PATH_CELLS[ringIdx] || null;
  }

  console.warn(`[getVisualPosition] Progress inválido: ${progress} para color ${color}`);
  return null;
}

/**
 * Convierte una posición {col, row} a su clave de celda "col,row".
 * Usada como clave en los mapas de celda.
 * @param {number} col
 * @param {number} row
 * @returns {string}
 */
function cellKey(col, row) {
  return `${col},${row}`;
}

/**
 * Obtiene el progress resultante de un movimiento dado.
 * Maneja: salida de base, camino principal, entrada al pasillo,
 * pasillo de meta y rebote en la meta.
 * NO valida bloqueos ni capturas (eso lo hace app.js).
 *
 * @param {string} color
 * @param {number} currentProgress - progress actual de la ficha
 * @param {number} diceValue - valor del dado (1-6)
 * @param {object} exitCells - {main, extras} casillas de salida del jugador
 * @param {number|null} chosenExitIdx - índice en PATH_CELLS elegido si está en base (null = main)
 * @returns {number|null} progress resultante, o null si el movimiento no es válido
 */
function calculateTargetProgress(color, currentProgress, diceValue, exitCells, chosenExitIdx) {
  // ── Ficha en base ─────────────────────────────────────────────
  if (currentProgress === HOME_PROGRESS) {
    // La ficha ya debería haber pasado la validación de número de salida
    // chosenExitIdx es el índice en PATH_CELLS de la casilla de salida elegida
    // Lo convertimos a progress para ese color
    const exitRingIdx = chosenExitIdx !== null ? chosenExitIdx : exitCells.main;

    // Calcular qué progress corresponde a ese ringIndex para este color
    // progress = (ringIndex - EXIT_CELL_INDEX[color] + PATH_LENGTH) % PATH_LENGTH
    const progress = ringIndexToProgress(color, exitRingIdx);
    return progress;
  }

  // ── Ficha en meta (no puede moverse) ─────────────────────────
  if (currentProgress === GOAL_PROGRESS) return null;

  const rawTarget = currentProgress + diceValue;

  // ── Ficha en pasillo de meta ──────────────────────────────────
  if (currentProgress >= HOME_STRETCH_START) {
    if (rawTarget > GOAL_PROGRESS) {
      // Rebote: retrocede el excedente
      return 2 * GOAL_PROGRESS - rawTarget;
    }
    return rawTarget;
  }

  // ── Ficha en camino principal ─────────────────────────────────
  // ¿Entra al pasillo de meta?
  // El pasillo empieza cuando el jugador supera 51 pasos desde su salida.
  // En términos de progress, entra al pasillo cuando progress + diceValue >= PATH_LENGTH

  if (rawTarget >= PATH_LENGTH) {
    const stretchIdx = rawTarget - PATH_LENGTH; // 0, 1 o 2
    const stretchProgress = HOME_STRETCH_START + stretchIdx;

    if (stretchProgress > GOAL_PROGRESS) {
      // Rebote en pasillo
      return 2 * GOAL_PROGRESS - stretchProgress;
    }
    return stretchProgress;
  }

  // Avance normal en camino principal
  return rawTarget;
}

/**
 * Calcula si el camino desde fromProgress hasta fromProgress+diceValue
 * pasa por un ringIndex específico.
 * Usado para validar captura y posición de casillas especiales.
 * @param {string} color
 * @param {number} fromProgress
 * @param {number} diceValue
 * @param {number} ringIdx - índice en PATH_CELLS a verificar
 * @returns {boolean}
 */
function pathPassesThroughRing(color, fromProgress, diceValue, ringIdx) {
  for (let step = 1; step <= diceValue; step++) {
    const checkProgress = fromProgress + step;
    if (checkProgress >= PATH_LENGTH) break; // Entra al pasillo, no más camino común
    if (getRingIndex(color, checkProgress) === ringIdx) return true;
  }
  return false;
}

/**
 * Verifica si una ficha llegaría exactamente a un ringIndex
 * dado su progress actual y el valor del dado.
 * Retorna el progress si llegaría ahí, o null si no.
 * @param {string} color
 * @param {number} currentProgress
 * @param {number} diceValue
 * @param {number} targetRingIdx
 * @returns {number|null}
 */
function wouldLandOnRing(color, currentProgress, diceValue, targetRingIdx) {
  if (currentProgress < 0 || currentProgress >= PATH_LENGTH) return null;
  const rawTarget = currentProgress + diceValue;
  if (rawTarget >= PATH_LENGTH) return null; // Va al pasillo, no aterriza en camino
  const resultRing = getRingIndex(color, rawTarget);
  if (resultRing === targetRingIdx) return rawTarget;
  return null;
}


/* ─────────────────────────────────────────────────────────────
   FUNCIÓN DE CLASIFICACIÓN DE CELDAS DEL TABLERO
   Determina qué tipo de celda es cada posición del grid 15×15.
   Usada por app.js al construir el tablero visual (initBoard).
───────────────────────────────────────────────────────────── */

/**
 * Retorna el tipo de celda para una posición del grid.
 * @param {number} col
 * @param {number} row
 * @returns {object} { type, color?, pathIdx? }
 */
function getCellType(col, row) {
  // ── Meta central ──────────────────────────────────────────────
  if (col === 7 && row === 7) return { type: 'goal-center' };

  // ── Triángulos de meta (zona central de cada color) ───────────
  // Brazos internos: casillas de los pasillos que están en la zona central
  if (col === 7 && row === 5) return { type: 'goal-triangle', color: 'blue' };
  if (col === 9 && row === 7) return { type: 'goal-triangle', color: 'yellow' };
  if (col === 5 && row === 7) return { type: 'goal-triangle', color: 'red' };
  if (col === 7 && row === 9) return { type: 'goal-triangle', color: 'green' };

  // ── Pasillos de meta (HOME_STRETCH) ───────────────────────────
  for (const color of COLOR_ORDER) {
    for (let i = 0; i < HOME_STRETCH[color].length; i++) {
      const hs = HOME_STRETCH[color][i];
      if (hs.col === col && hs.row === row) {
        return { type: 'home-stretch', color, stretchIdx: i };
      }
    }
  }

  // ── Camino principal (PATH_CELLS) ─────────────────────────────
  for (let i = 0; i < PATH_CELLS.length; i++) {
    const pc = PATH_CELLS[i];
    if (pc.col === col && pc.row === row) {
      // ¿Es casilla de salida de algún color?
      for (const color of COLOR_ORDER) {
        if (EXIT_CELL_INDEX[color] === i) {
          return { type: 'exit', color, pathIdx: i };
        }
      }
      return { type: 'path', pathIdx: i };
    }
  }

  // ── Casas de color (esquinas 6×6) ────────────────────────────
  // Azul: rows 0-5, cols 0-5
  if (row >= 0 && row <= 5 && col >= 0 && col <= 5) {
    const isInner = row >= 0 && row <= 4 && col >= 0 && col <= 4;
    return { type: 'home', color: 'blue', isInner };
  }
  // Amarillo: rows 0-5, cols 9-14
  if (row >= 0 && row <= 5 && col >= 9 && col <= 14) {
    const isInner = row >= 0 && row <= 4 && col >= 10 && col <= 14;
    return { type: 'home', color: 'yellow', isInner };
  }
  // Rojo: rows 9-14, cols 0-5
  if (row >= 9 && row <= 14 && col >= 0 && col <= 5) {
    const isInner = row >= 10 && row <= 14 && col >= 0 && col <= 4;
    return { type: 'home', color: 'red', isInner };
  }
  // Verde: rows 9-14, cols 9-14
  if (row >= 9 && row <= 14 && col >= 9 && col <= 14) {
    const isInner = row >= 10 && row <= 14 && col >= 10 && col <= 14;
    return { type: 'home', color: 'green', isInner };
  }

  // ── Zona central (centro de la cruz, no es pasillo ni meta) ───
  if ((col >= 5 && col <= 9 && row >= 5 && row <= 9)) {
    return { type: 'center' };
  }

  // ── Celda vacía (fuera de todos los tipos) ─────────────────────
  return { type: 'empty' };
}

/**
 * Construye y retorna el mapa completo de tipos de celda para el tablero.
 * Formato: { "col,row": cellTypeObject }
 * Se llama una vez al inicializar el tablero.
 * @returns {Map<string, object>}
 */
function buildCellTypeMap() {
  const map = new Map();
  for (let row = 0; row < 15; row++) {
    for (let col = 0; col < 15; col++) {
      map.set(cellKey(col, row), getCellType(col, row));
    }
  }
  return map;
}


/* ─────────────────────────────────────────────────────────────
   FUNCIONES DE UTILIDAD DEL TABLERO
───────────────────────────────────────────────────────────── */

/**
 * Construye el mapa de posición → fichas para renderizar.
 * Recorre todos los jugadores y sus fichas.
 * @param {object} room - snapshot de Firebase
 * @returns {Map<string, Array>} "col,row" → [{color, playerId, pieceIdx, progress}]
 */
function buildPiecesMap(room) {
  const map = new Map();
  if (!room.pieces || !room.players) return map;

  for (const [pid, playerPieces] of Object.entries(room.pieces)) {
    const color = room.players[pid]?.color;
    if (!color) continue;

    for (let i = 0; i < PIECES_PER_PLAYER; i++) {
      const key      = 'p' + i;
      const progress = playerPieces[key];
      if (progress === undefined) continue;

      const pos = getVisualPosition(color, progress, i);
      if (!pos) continue;

      const ck = cellKey(pos.col, pos.row);
      if (!map.has(ck)) map.set(ck, []);
      map.get(ck).push({ color, playerId: pid, pieceIdx: i, progress });
    }
  }
  return map;
}

/**
 * Retorna el índice en PATH_CELLS de la casilla de salida adicional
 * que se debe agregar cuando un jugador desbloquea una nueva salida.
 * @param {string} color
 * @param {number} currentExtrasCount - cuántas extras ya tiene
 * @returns {number|null} índice en PATH_CELLS, o null si ya tiene todas
 */
function getNextExitCellIndex(color, currentExtrasCount) {
  if (currentExtrasCount >= EXIT_EXTRA_DISTANCES.length) return null;
  const distance = EXIT_EXTRA_DISTANCES[currentExtrasCount];
  // La casilla extra está a `distance` casillas ANTES de la salida principal
  // (en sentido antihorario, para que las fichas rivales puedan estar ahí)
  const mainIdx = EXIT_CELL_INDEX[color];
  const extraIdx = (mainIdx - distance + PATH_LENGTH) % PATH_LENGTH;
  return extraIdx;
}

/**
 * Retorna el progress que corresponde a un ringIndex para un color dado.
 * Inversa de getRingIndex.
 * @param {string} color
 * @param {number} ringIdx
 * @returns {number} progress (0-51)
 */
function ringIndexToProgress(color, ringIdx) {
  // Inversa de getRingIndex antihorario:
  // ringIdx = (EXIT - progress) % PATH → progress = (EXIT - ringIdx) % PATH
  return (EXIT_CELL_INDEX[color] - ringIdx + PATH_LENGTH * 4) % PATH_LENGTH;
}

/**
 * Retorna el punto medio (en casillas del camino) entre dos progress.
 * Usado por el Escudo Acme para calcular adónde va la ficha protegida.
 * @param {string} color
 * @param {number} fromProgress - progress de la ficha
 * @param {number} toProgress   - progress destino (base = 0)
 * @returns {number} progress del punto medio (casilla más cercana)
 */
function getMidpointProgress(color, fromProgress, toProgress) {
  if (fromProgress < 0 || toProgress < 0) return 0; // Si alguno está en base, ir a salida
  const diff = Math.abs(fromProgress - toProgress);
  const mid  = Math.round(diff / 2);
  return Math.min(fromProgress, toProgress) + mid;
}

/**
 * Verifica si un progress está en el camino común (no base, no pasillo, no meta).
 * @param {number} progress
 * @returns {boolean}
 */
function isOnMainPath(progress) {
  return progress >= 0 && progress < PATH_LENGTH;
}

/**
 * Verifica si un progress está en el pasillo de meta.
 * @param {number} progress
 * @returns {boolean}
 */
function isInHomeStretch(progress) {
  return progress >= HOME_STRETCH_START && progress < GOAL_PROGRESS;
}

/**
 * Verifica si un progress corresponde a la meta.
 * @param {number} progress
 * @returns {boolean}
 */
function isAtGoal(progress) {
  return progress === GOAL_PROGRESS;
}

/**
 * Verifica si un progress corresponde a la base.
 * @param {number} progress
 * @returns {boolean}
 */
function isAtHome(progress) {
  return progress === HOME_PROGRESS;
}

/**
 * Retorna el progreso total de un jugador (para ranking).
 * Suma del progress de todas sus fichas, con bonus por fichas en meta.
 * @param {object} playerPieces - {p0, p1, p2, p3}
 * @returns {number}
 */
function getPlayerTotalProgress(playerPieces) {
  let total = 0;
  for (let i = 0; i < PIECES_PER_PLAYER; i++) {
    const prog = playerPieces['p' + i];
    if (prog === undefined) continue;
    if (prog === HOME_PROGRESS) {
      total += 0;
    } else if (prog === GOAL_PROGRESS) {
      total += GOAL_PROGRESS + 10; // Bonus por ficha en meta
    } else {
      total += Math.max(0, prog);
    }
  }
  return total;
}

/**
 * Cuenta fichas de un jugador en un estado específico.
 * @param {object} playerPieces
 * @param {'home'|'path'|'stretch'|'goal'} state
 * @returns {number}
 */
function countPiecesInState(playerPieces, state) {
  let count = 0;
  for (let i = 0; i < PIECES_PER_PLAYER; i++) {
    const prog = playerPieces['p' + i];
    if (prog === undefined) continue;
    switch (state) {
      case 'home':    if (isAtHome(prog))        count++; break;
      case 'path':    if (isOnMainPath(prog))    count++; break;
      case 'stretch': if (isInHomeStretch(prog)) count++; break;
      case 'goal':    if (isAtGoal(prog))        count++; break;
    }
  }
  return count;
}

/**
 * Retorna los índices (0-3) de las fichas de un jugador en el camino principal.
 * Usado por el Ataque Dirigido para encontrar fichas atacables.
 * @param {object} playerPieces
 * @returns {number[]}
 */
function getPiecesOnMainPath(playerPieces) {
  const result = [];
  for (let i = 0; i < PIECES_PER_PLAYER; i++) {
    if (isOnMainPath(playerPieces['p' + i])) result.push(i);
  }
  return result;
}

// Exportar todo como constantes globales (se acceden desde app.js)
// En un entorno sin módulos ES6, las constantes y funciones
// se declaran en el scope global y están disponibles para app.js
console.log(`[board.js] Tablero cargado: ${PATH_LENGTH} casillas, ${HOME_STRETCH_LENGTH} casillas de pasillo, meta en progress ${GOAL_PROGRESS}`);
