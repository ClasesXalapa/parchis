/* ═══════════════════════════════════════════════════════════════════
   PARCHÍS ONLINE v2 — special-cells.js
   Sistema completo de casillas especiales dinámicas.

   PARA AGREGAR UN NUEVO TIPO DE CASILLA ESPECIAL:
   1. Agregar la constante en SPECIAL_CELL_TYPES
   2. Agregar su config en SPECIAL_CELL_CONFIG
   3. Agregar su handler en SPECIAL_CELL_HANDLERS
   4. El sistema se encarga del resto automáticamente

   PRINCIPIOS:
   - Solo aparecen en el camino común (PATH_CELLS)
   - Máximo 1 ficha por casilla (regla global del juego)
   - Siempre visibles con símbolo e indicación de efecto
   - Se reposicionan completamente cuando un evento las activa
   - Las fichas son estáticas al reposicionar; las casillas buscan celdas libres
   - Casillas de 1 uso: desaparecen al activarse (quedan como camino normal)
   - Casillas OASIS: parecen positivas pero no dan efecto al activarse
═══════════════════════════════════════════════════════════════════ */


/* ─────────────────────────────────────────────────────────────
   TIPOS DE CASILLAS ESPECIALES
   Agregar nuevos tipos aquí.
───────────────────────────────────────────────────────────── */
const SPECIAL_CELL_TYPES = {
  // ── Positivas ─────────────────────────────────────────────────
  SAFE:        'safe',        // Protege de capturas y comodines mientras estés ahí
  BONUS_MOVE:  'bonus_move',  // Avance extra aleatorio +1 a +6 (con posible cadena)

  // ── Negativas ─────────────────────────────────────────────────
  SEND_HOME:   'send_home',   // Regresa la ficha a su base
  LOSE_TURN:   'lose_turn',   // Pierde el siguiente turno (o el turno extra si lo tiene)
  RETREAT:     'retreat',     // Retrocede N casillas (N asignado al crear la casilla)

  // ── Especiales ────────────────────────────────────────────────
  OASIS:       'oasis',       // Parece positiva (BONUS_MOVE) pero no da efecto al caer

  // ════════════════════════════════════════════════════════════
  // AGREGAR NUEVOS TIPOS AQUÍ:
  // ════════════════════════════════════════════════════════════
  // DOUBLE_MOVE:   'double_move',   // Mueve el doble de lo que sacaste
  // FREEZE:        'freeze',        // Pierdes 2 turnos
  // TELEPORT:      'teleport',      // Te teletransporta a una casilla aleatoria
  // STEAL_WILDCARD:'steal_wildcard',// Roba un comodín aleatorio a un rival
};

/* ─────────────────────────────────────────────────────────────
   CONFIGURACIÓN DE CADA TIPO
   positive: si es una casilla positiva o negativa
   uses: Infinity = usos ilimitados, 1 = un solo uso y desaparece
   symbol: emoji/símbolo que se muestra en el tablero
   label: texto corto del efecto (máximo ~6 chars para que quepa en la celda)
   cssClass: clase CSS que se aplica a la celda del tablero
───────────────────────────────────────────────────────────── */
const SPECIAL_CELL_CONFIG = {
  [SPECIAL_CELL_TYPES.SAFE]: {
    positive:  true,
    uses:      Infinity,
    symbol:    '🛡️',
    label:     'Segura',
    cssClass:  'cell-special-pos',
    description: 'Mientras estés aquí no puedes ser comido ni recibir comodines en tu contra.',
  },
  [SPECIAL_CELL_TYPES.BONUS_MOVE]: {
    positive:  true,
    uses:      1,           // Se activa una vez y desaparece
    symbol:    '⭐',
    label:     '+?',        // El valor se revela al caer
    cssClass:  'cell-special-pos',
    description: 'Avance extra aleatorio de +1 a +6 casillas. ¡Puede encadenarse!',
  },
  [SPECIAL_CELL_TYPES.SEND_HOME]: {
    positive:  false,
    uses:      Infinity,
    symbol:    '💀',
    label:     'Casa',
    cssClass:  'cell-special-neg',
    description: 'Tu ficha regresa directamente a la base.',
  },
  [SPECIAL_CELL_TYPES.LOSE_TURN]: {
    positive:  false,
    uses:      Infinity,
    symbol:    '⏸️',
    label:     '-Turno',
    cssClass:  'cell-special-neg',
    description: 'Pierdes tu siguiente turno (o el turno extra si lo tenías).',
  },
  [SPECIAL_CELL_TYPES.RETREAT]: {
    positive:  false,
    uses:      Infinity,
    symbol:    '⬇️',
    label:     null,        // Se genera dinámicamente: "-3", "-5", etc.
    cssClass:  'cell-special-neg',
    description: 'Retrocedes N casillas en el camino.',
  },
  [SPECIAL_CELL_TYPES.OASIS]: {
    positive:  true,        // Visualmente positiva (engaño)
    uses:      1,           // Un uso: al caer se revela y desaparece
    symbol:    '⭐',        // Idéntico a BONUS_MOVE intencionalmente
    label:     '+?',        // Idéntico a BONUS_MOVE intencionalmente
    cssClass:  'cell-special-pos',
    description: 'Parece un bonus pero... ¡es una trampa! No da ningún efecto.',
  },

  // ════════════════════════════════════════════════════════════
  // CONFIGURAR NUEVOS TIPOS AQUÍ:
  // ════════════════════════════════════════════════════════════
  // [SPECIAL_CELL_TYPES.DOUBLE_MOVE]: {
  //   positive: true, uses: 1, symbol: '×2', label: '×2', cssClass: 'cell-special-pos',
  //   description: 'Tu próximo movimiento cuenta como el doble.',
  // },
};


/* ─────────────────────────────────────────────────────────────
   GENERACIÓN DE CASILLAS ESPECIALES
───────────────────────────────────────────────────────────── */

/**
 * Genera el estado inicial de las casillas especiales para una partida.
 * Elige posiciones aleatorias en el camino común que NO estén:
 * - En casillas de salida de ningún color
 * - Ya ocupadas por otra casilla especial
 * @param {number} positiveCount - número de casillas positivas
 * @param {number} negativeCount - número de casillas negativas
 * @param {Array} occupiedRingIdxs - ringIdxs ya ocupados por fichas (al inicio suelen estar vacíos)
 * @returns {object} mapa { ringIdx: specialCellObject }
 */
function generateSpecialCells(positiveCount, negativeCount, occupiedRingIdxs = []) {
  const cells = {};
  const forbidden = new Set([
    ...Object.values(EXIT_CELL_INDEX), // Casillas de salida siempre prohibidas
    ...occupiedRingIdxs,
  ]);

  // Pool de tipos disponibles
  const positiveTypes = [
    SPECIAL_CELL_TYPES.SAFE,
    SPECIAL_CELL_TYPES.BONUS_MOVE,
    SPECIAL_CELL_TYPES.OASIS,
  ];
  const negativeTypes = [
    SPECIAL_CELL_TYPES.SEND_HOME,
    SPECIAL_CELL_TYPES.LOSE_TURN,
    SPECIAL_CELL_TYPES.RETREAT,
  ];

  // Generar casillas positivas
  const positivePlaced = _placeRandomCells(positiveCount, positiveTypes, forbidden, cells);
  positivePlaced.forEach(idx => forbidden.add(idx));

  // Generar casillas negativas
  _placeRandomCells(negativeCount, negativeTypes, forbidden, cells);

  return cells;
}

/**
 * Helper interno: coloca N casillas especiales aleatorias.
 * @param {number} count
 * @param {string[]} typePool - tipos disponibles para elegir
 * @param {Set<number>} forbidden - índices prohibidos
 * @param {object} cells - objeto a modificar (mapa de casillas)
 * @returns {number[]} índices colocados
 */
function _placeRandomCells(count, typePool, forbidden, cells) {
  const placed = [];
  let attempts = 0;
  const maxAttempts = PATH_LENGTH * 3;

  while (placed.length < count && attempts < maxAttempts) {
    attempts++;
    const ringIdx = Math.floor(Math.random() * PATH_LENGTH);
    if (forbidden.has(ringIdx)) continue;

    const type = typePool[Math.floor(Math.random() * typePool.length)];
    const config = SPECIAL_CELL_CONFIG[type];

    cells[ringIdx] = createSpecialCellObject(type, ringIdx);
    placed.push(ringIdx);
    forbidden.add(ringIdx);
  }

  if (placed.length < count) {
    console.warn(`[special-cells] Solo se pudieron colocar ${placed.length}/${count} casillas.`);
  }

  return placed;
}

/**
 * Crea el objeto de una casilla especial para guardar en Firebase.
 * @param {string} type - SPECIAL_CELL_TYPES value
 * @param {number} ringIdx - índice en PATH_CELLS
 * @returns {object}
 */
function createSpecialCellObject(type, ringIdx) {
  const config = SPECIAL_CELL_CONFIG[type];
  const cell = {
    type,
    ringIdx,
    positive:  config.positive,
    uses:      config.uses === Infinity ? -1 : config.uses, // -1 = ilimitado en Firebase
    symbol:    config.symbol,
    label:     config.label,
  };

  // Para RETREAT: asignar valor de retroceso aleatorio (1-6)
  if (type === SPECIAL_CELL_TYPES.RETREAT) {
    cell.retreatValue = Math.floor(Math.random() * 6) + 1;
    cell.label = `-${cell.retreatValue}`;
  }

  return cell;
}

/**
 * Reposiciona TODAS las casillas especiales a nuevas posiciones aleatorias.
 * Los efectos también cambian aleatoriamente.
 * Las fichas se quedan en sus posiciones; las casillas buscan posiciones libres.
 * @param {object} currentCells - casillas actuales { ringIdx: cellObject }
 * @param {number} positiveCount - número de positivas a mantener
 * @param {number} negativeCount - número de negativas a mantener
 * @param {Array<number>} pieceRingIdxs - ringIdxs ocupados por fichas actualmente
 * @returns {object} nuevas casillas especiales
 */
function repositionAllSpecialCells(currentCells, positiveCount, negativeCount, pieceRingIdxs) {
  // Contar cuántas de 1 uso han desaparecido vs. cuántas quedan
  // Para el reposicionamiento, generamos de nuevo con los conteos originales
  return generateSpecialCells(positiveCount, negativeCount, pieceRingIdxs);
}


/* ─────────────────────────────────────────────────────────────
   HANDLERS DE EFECTOS
   Cada handler retorna un objeto que describe qué ocurrió,
   para que app.js lo procese y actualice Firebase.
───────────────────────────────────────────────────────────── */

/**
 * Objeto de resultado de activar una casilla especial.
 * @typedef {Object} SpecialCellResult
 * @property {boolean} consumed - si la casilla se consume (desaparece)
 * @property {string} effectType - tipo de efecto aplicado
 * @property {*} effectValue - valor del efecto (casillas de avance, etc.)
 * @property {string} message - mensaje para el log de eventos
 * @property {boolean} isOasis - si resultó ser un oasis (trampa)
 */

/**
 * Manejadores de efectos por tipo de casilla.
 * Cada función recibe: (cell, playerName, pieceIdx, currentProgress, color, room)
 * y retorna un SpecialCellResult.
 *
 * AGREGAR NUEVOS HANDLERS AQUÍ al crear un nuevo tipo de casilla.
 */
const SPECIAL_CELL_HANDLERS = {

  /**
   * SAFE: protección mientras la ficha esté en la casilla.
   * El efecto real (impedir capturas/comodines) se valida en app.js
   * al intentar comer o usar comodines. Aquí solo se registra el evento.
   */
  [SPECIAL_CELL_TYPES.SAFE]: (cell, playerName, pieceIdx) => ({
    consumed:    false,   // Usos ilimitados, no desaparece
    effectType:  'safe',
    effectValue: null,
    message:     `🛡️ ${playerName} (Ficha ${PIECE_LETTERS[pieceIdx]}) cayó en casilla SEGURA. No puede ser comido aquí.`,
    isOasis:     false,
  }),

  /**
   * BONUS_MOVE: avance extra aleatorio +1 a +6.
   * El valor se determina aquí aleatoriamente.
   * app.js aplica el movimiento y verifica si cae en otra casilla especial (cadena).
   */
  [SPECIAL_CELL_TYPES.BONUS_MOVE]: (cell, playerName, pieceIdx) => {
    const bonus = Math.floor(Math.random() * 6) + 1;
    return {
      consumed:    true,    // 1 solo uso: desaparece
      effectType:  'bonus_move',
      effectValue: bonus,
      message:     `⭐ ${playerName} (Ficha ${PIECE_LETTERS[pieceIdx]}) recibió +${bonus} casillas extra.`,
      isOasis:     false,
    };
  },

  /**
   * SEND_HOME: regresa la ficha a la base.
   * Si la ficha tiene Escudo Acme: app.js intercepta y aplica punto medio.
   */
  [SPECIAL_CELL_TYPES.SEND_HOME]: (cell, playerName, pieceIdx) => ({
    consumed:    false,
    effectType:  'send_home',
    effectValue: HOME_PROGRESS,
    message:     `💀 ${playerName} (Ficha ${PIECE_LETTERS[pieceIdx]}) ¡Regresa a la base!`,
    isOasis:     false,
  }),

  /**
   * LOSE_TURN: pierde el siguiente turno (o el turno extra si lo tiene).
   * app.js verifica si hay turno extra y lo consume, o marca loseTurnPending.
   */
  [SPECIAL_CELL_TYPES.LOSE_TURN]: (cell, playerName, pieceIdx) => ({
    consumed:    false,
    effectType:  'lose_turn',
    effectValue: null,
    message:     `⏸️ ${playerName} (Ficha ${PIECE_LETTERS[pieceIdx]}) ¡Pierde su turno!`,
    isOasis:     false,
  }),

  /**
   * RETREAT: retrocede N casillas.
   * El valor N está guardado en cell.retreatValue.
   * Si retroceder llevaría antes de la casilla de salida: se queda en la salida.
   * Si la ficha tiene Escudo Acme: app.js aplica la mitad del retroceso.
   */
  [SPECIAL_CELL_TYPES.RETREAT]: (cell, playerName, pieceIdx) => {
    const n = cell.retreatValue || 3;
    return {
      consumed:    false,
      effectType:  'retreat',
      effectValue: -n,   // Negativo indica retroceso
      message:     `⬇️ ${playerName} (Ficha ${PIECE_LETTERS[pieceIdx]}) retrocede ${n} casillas.`,
      isOasis:     false,
    };
  },

  /**
   * OASIS: parece positivo pero no da efecto.
   * Se consume (desaparece) al caer, revelando que era trampa.
   */
  [SPECIAL_CELL_TYPES.OASIS]: (cell, playerName, pieceIdx) => ({
    consumed:    true,    // Se consume: revela la trampa y desaparece
    effectType:  'oasis',
    effectValue: null,
    message:     `😅 ${playerName} (Ficha ${PIECE_LETTERS[pieceIdx]}) cayó en un OASIS... ¡No hay nada aquí!`,
    isOasis:     true,
  }),

  // ════════════════════════════════════════════════════════════
  // AGREGAR HANDLERS DE NUEVOS TIPOS AQUÍ:
  // ════════════════════════════════════════════════════════════
  // [SPECIAL_CELL_TYPES.DOUBLE_MOVE]: (cell, playerName, pieceIdx) => ({
  //   consumed: true, effectType: 'double_move', effectValue: null,
  //   message: `×2 ${playerName} mueve el doble en su próximo tiro.`, isOasis: false,
  // }),
};

/**
 * Punto de entrada principal para activar una casilla especial.
 * Verifica el tipo, llama al handler correcto y retorna el resultado.
 * @param {object} cell - objeto de la casilla especial de Firebase
 * @param {string} playerName
 * @param {number} pieceIdx - índice de la ficha (0-3)
 * @returns {SpecialCellResult|null}
 */
function activateSpecialCell(cell, playerName, pieceIdx) {
  if (!cell || !cell.type) return null;

  const handler = SPECIAL_CELL_HANDLERS[cell.type];
  if (!handler) {
    console.warn(`[special-cells] Handler no encontrado para tipo: ${cell.type}`);
    return null;
  }

  return handler(cell, playerName, pieceIdx);
}


/* ─────────────────────────────────────────────────────────────
   FUNCIONES DE CONSULTA
───────────────────────────────────────────────────────────── */

/**
 * Retorna la casilla especial en un ringIdx dado, o null si no hay ninguna.
 * @param {object} specialCells - mapa de casillas de Firebase { ringIdx: cell }
 * @param {number} ringIdx
 * @returns {object|null}
 */
function getSpecialCellAt(specialCells, ringIdx) {
  if (!specialCells) return null;
  return specialCells[ringIdx] || null;
}

/**
 * Verifica si una casilla en un ringIdx es SAFE (segura).
 * Usado para validar capturas y comodines.
 * @param {object} specialCells
 * @param {number} ringIdx
 * @returns {boolean}
 */
function isSafeCell(specialCells, ringIdx) {
  const cell = getSpecialCellAt(specialCells, ringIdx);
  return cell?.type === SPECIAL_CELL_TYPES.SAFE;
}

/**
 * Verifica si hay una casilla especial positiva en un ringIdx.
 * Usado por el Ataque Dirigido: si la casilla destino es positiva,
 * el ataque mueve la ficha a la siguiente casilla libre.
 * @param {object} specialCells
 * @param {number} ringIdx
 * @returns {boolean}
 */
function isPositiveSpecialCell(specialCells, ringIdx) {
  const cell = getSpecialCellAt(specialCells, ringIdx);
  return cell ? (cell.positive === true) : false;
}

/**
 * Retorna todos los ringIdxs que tienen casillas especiales activas.
 * @param {object} specialCells
 * @returns {number[]}
 */
function getSpecialCellRingIdxs(specialCells) {
  if (!specialCells) return [];
  return Object.keys(specialCells).map(Number);
}

/**
 * Cuenta casillas especiales por tipo (positivas/negativas/total).
 * @param {object} specialCells
 * @returns {{ positive: number, negative: number, total: number }}
 */
function countSpecialCells(specialCells) {
  if (!specialCells) return { positive: 0, negative: 0, total: 0 };
  let positive = 0, negative = 0;
  for (const cell of Object.values(specialCells)) {
    if (cell.positive) positive++;
    else negative++;
  }
  return { positive, negative, total: positive + negative };
}

/**
 * Calcula el progress de retroceso aplicando el efecto RETREAT.
 * Si el retroceso llevaría antes de la casilla de salida del color,
 * la ficha se queda en su casilla de salida (progress = 0).
 * @param {number} currentProgress - progress actual de la ficha
 * @param {number} retreatValue - cuántas casillas retrocede (positivo)
 * @param {boolean} shielded - si la ficha tiene Escudo Acme
 * @returns {number} nuevo progress
 */
function calculateRetreatProgress(currentProgress, retreatValue, shielded) {
  const effectiveRetreat = shielded ? Math.ceil(retreatValue / 2) : retreatValue;
  const newProgress = currentProgress - effectiveRetreat;

  // Si quedaría antes de la casilla de salida (progress < 0): quedarse en salida
  if (newProgress < 0) return 0;
  return newProgress;
}

/**
 * Calcula el progress destino del Escudo Acme cuando absorbe SEND_HOME.
 * La ficha va a la casilla más cercana al punto medio entre
 * su posición actual y su casilla de salida (progress = 0).
 * @param {number} currentProgress - progress actual de la ficha
 * @returns {number} nuevo progress
 */
function calculateShieldedSendHome(currentProgress) {
  // Punto medio entre currentProgress y 0 (casilla de salida)
  const mid = Math.round(currentProgress / 2);
  return Math.max(0, mid);
}

/**
 * Dado un ringIdx de destino del Ataque Dirigido,
 * si la casilla es especial positiva, retorna el siguiente ringIdx libre
 * (sin fichas y sin casilla especial positiva).
 * Si la casilla es especial negativa, la ficha aterriza ahí y sufre el efecto.
 * @param {number} targetRingIdx
 * @param {object} specialCells
 * @param {Set<number>} occupiedRingIdxs - ringIdxs con fichas
 * @returns {number} ringIdx final donde aterriza la ficha
 */
function resolveAttackTargetCell(targetRingIdx, specialCells, occupiedRingIdxs) {
  let ringIdx = targetRingIdx;
  let attempts = 0;

  while (attempts < PATH_LENGTH) {
    const cell = getSpecialCellAt(specialCells, ringIdx);
    const isPositive = cell && cell.positive;
    const isOccupied = occupiedRingIdxs.has(ringIdx);

    // Si es casilla positiva: avanzar al siguiente
    if (isPositive) {
      ringIdx = (ringIdx + 1) % PATH_LENGTH;
      attempts++;
      continue;
    }

    // Si está ocupada por otra ficha: no puede aterrizar (regla de 1 ficha por casilla)
    // En este caso también avanza
    if (isOccupied) {
      ringIdx = (ringIdx + 1) % PATH_LENGTH;
      attempts++;
      continue;
    }

    // Casilla libre y no positiva: aterrizar aquí
    return ringIdx;
  }

  // Fallback: retornar el destino original
  return targetRingIdx;
}


/* ─────────────────────────────────────────────────────────────
   RENDERIZADO DE CASILLAS ESPECIALES
   Genera los atributos CSS y data necesarios para pintar
   cada casilla especial en el tablero.
───────────────────────────────────────────────────────────── */

/**
 * Retorna los atributos de renderizado para una casilla especial.
 * @param {object} cell - objeto de Firebase
 * @returns {{ cssClass: string, symbol: string, effectLabel: string, dataEffect: string }}
 */
function getSpecialCellRenderData(cell) {
  if (!cell) return null;

  const config  = SPECIAL_CELL_CONFIG[cell.type];
  const symbol  = cell.symbol || config?.symbol || '?';
  const label   = cell.label  || config?.label  || '?';

  return {
    cssClass:    config?.cssClass || 'cell-special-pos',
    symbol,
    effectLabel: label,
    dataEffect:  label,      // Se pone en data-effect para el ::before del CSS
  };
}

/**
 * Retorna el texto de descripción completa de una casilla especial.
 * Usado en tooltips o en el log cuando se activa.
 * @param {object} cell
 * @returns {string}
 */
function getSpecialCellDescription(cell) {
  if (!cell) return '';
  const config = SPECIAL_CELL_CONFIG[cell.type];
  if (!config) return cell.type;

  if (cell.type === SPECIAL_CELL_TYPES.RETREAT) {
    return `Retrocedes ${cell.retreatValue} casillas.`;
  }
  return config.description || cell.type;
}

console.log('[special-cells.js] Sistema de casillas especiales cargado.');
console.log(`[special-cells.js] Tipos disponibles: ${Object.values(SPECIAL_CELL_TYPES).join(', ')}`);
