/* ═══════════════════════════════════════════════════════════════════
   PARCHÍS ONLINE v2 — wildcards.js
   Sistema completo de comodines (solo modo Wild, mínimo 3 jugadores).

   PARA AGREGAR UN NUEVO COMODÍN:
   1. Agregar la constante en WILDCARD_TYPES
   2. Agregar su config en WILDCARD_CONFIG
   3. Agregar su handler en WILDCARD_HANDLERS
   4. Documentar cuándo se activa (antes/después de tirar dado)
   5. Agregar el evento que lo otorga en events.js

   REGLAS GENERALES:
   - Máximo MAX_WILDCARDS_PER_TYPE (3) de cada tipo por jugador
   - Visibles para TODOS los jugadores en pantalla
   - Se pierden al terminar la partida
   - Se activan manualmente durante el turno propio
   - Momentos de activación: BEFORE_ROLL o AFTER_ROLL (antes/después de tirar dado)
   - El Escudo Acme es especial: se asigna a una ficha específica al recibirlo
═══════════════════════════════════════════════════════════════════ */


/* ─────────────────────────────────────────────────────────────
   CONSTANTES
───────────────────────────────────────────────────────────── */
const MAX_WILDCARDS_PER_TYPE = 3; // Máximo de cada tipo por jugador

// Momentos en que se puede activar el comodín
const WILDCARD_TIMING = {
  BEFORE_ROLL: 'before_roll', // Antes de tirar el dado (ej: Ataque Dirigido)
  AFTER_ROLL:  'after_roll',  // Después de tirar, antes de mover (ej: Descarte)
  ON_RECEIVE:  'on_receive',  // Al recibirlo: asigna protección a una ficha (Escudo Acme)
};


/* ─────────────────────────────────────────────────────────────
   TIPOS DE COMODINES
   Agregar nuevos comodines aquí.
───────────────────────────────────────────────────────────── */
const WILDCARD_TYPES = {
  DISCARD:     'discard',      // Descarta el dado y vuelve a tirar
  ACME_SHIELD: 'acme_shield',  // Protege 1 ficha del siguiente evento negativo
  DIR_ATTACK:  'dir_attack',   // Retrocede 10 casillas a cualquier ficha rival

  // ════════════════════════════════════════════════════════
  // AGREGAR FUTUROS COMODINES AQUÍ:
  // ════════════════════════════════════════════════════════
  // DOUBLE_ROLL:  'double_roll',  // Tiras el dado dos veces y usas el mayor
  // SWAP_POS:     'swap_pos',     // Intercambias posición con una ficha rival
  // IMMUNITY:     'immunity',     // Invulnerable durante 1 turno completo
};


/* ─────────────────────────────────────────────────────────────
   CONFIGURACIÓN DE CADA COMODÍN
───────────────────────────────────────────────────────────── */
const WILDCARD_CONFIG = {
  [WILDCARD_TYPES.DISCARD]: {
    name:        'Descarte',
    icon:        '🎲',
    timing:      WILDCARD_TIMING.AFTER_ROLL,
    maxStack:    MAX_WILDCARDS_PER_TYPE,
    usesPerActivation: 1,
    description: 'Después de tirar el dado, descártalo y vuelve a tirar. Conservas todas las ventajas del nuevo resultado.',
    onlyOnMainPath: false, // No requiere tener fichas en camino
  },

  [WILDCARD_TYPES.ACME_SHIELD]: {
    name:        'Escudo Acme',
    icon:        '🛡️',
    timing:      WILDCARD_TIMING.ON_RECEIVE, // Se activa al recibirlo (asigna a ficha)
    maxStack:    MAX_WILDCARDS_PER_TYPE,
    usesPerActivation: 1,
    description: 'Asigna protección a una ficha en el camino. Si esa ficha sufre un evento negativo, el daño se reduce o elimina. Solo para fichas en el camino común.',
    onlyOnMainPath: true,
  },

  [WILDCARD_TYPES.DIR_ATTACK]: {
    name:        'Ataque Dirigido',
    icon:        '🎯',
    timing:      WILDCARD_TIMING.BEFORE_ROLL,
    maxStack:    MAX_WILDCARDS_PER_TYPE,
    usesPerActivation: 1,
    oncePerGame: true, // Solo puede usarse 1 vez en toda la partida
    description: 'Antes de tirar el dado, selecciona una ficha rival en el camino común. Esa ficha retrocede 10 casillas (o va a la base si cae antes de la salida).',
    onlyOnMainPath: false,
  },

  // ════════════════════════════════════════════════════════
  // CONFIGURAR NUEVOS COMODINES AQUÍ:
  // ════════════════════════════════════════════════════════
  // [WILDCARD_TYPES.DOUBLE_ROLL]: {
  //   name: 'Doble Tiro', icon: '🎯', timing: WILDCARD_TIMING.BEFORE_ROLL,
  //   maxStack: MAX_WILDCARDS_PER_TYPE, usesPerActivation: 1,
  //   description: 'Tiras el dado dos veces y usas el resultado mayor.',
  // },
};

// Distancia de retroceso del Ataque Dirigido
const DIR_ATTACK_DISTANCE = 10;


/* ─────────────────────────────────────────────────────────────
   HANDLERS DE COMODINES
   Cada handler retorna un objeto que describe qué debe hacer app.js.
   Los handlers NO modifican Firebase directamente; solo calculan.
───────────────────────────────────────────────────────────── */

/**
 * @typedef {Object} WildcardResult
 * @property {string} wildcardType     - tipo de comodín usado
 * @property {string} action           - qué debe hacer app.js
 * @property {*}      actionData       - datos para la acción
 * @property {string} message          - mensaje para el log
 * @property {boolean} consumeWildcard - si se consume el comodín
 */

const WILDCARD_HANDLERS = {

  /**
   * DESCARTE:
   * El jugador descarta el resultado del dado y vuelve a tirar.
   * El nuevo resultado conserva todas las ventajas (si es 6 → turno extra).
   * El contador de 6 consecutivos continúa desde donde estaba.
   * @param {object} params - { playerName, diceValue, consecutiveSixes }
   * @returns {WildcardResult}
   */
  [WILDCARD_TYPES.DISCARD]: (params) => {
    const { playerName, diceValue } = params;
    return {
      wildcardType:     WILDCARD_TYPES.DISCARD,
      action:           'reroll_dice',    // app.js vuelve a tirar el dado
      actionData:       { discardedValue: diceValue },
      message:          `🎲 ${playerName} usó DESCARTE. El dado (${diceValue}) se descarta → nuevo tiro.`,
      consumeWildcard:  true,
    };
  },

  /**
   * ESCUDO ACME:
   * El jugador elige qué ficha proteger al activar el comodín.
   * La protección dura hasta que esa ficha recibe un evento negativo.
   * Solo aplica a fichas en el camino común.
   * @param {object} params - { playerName, pieceIdx, pieceLetter }
   * @returns {WildcardResult}
   */
  [WILDCARD_TYPES.ACME_SHIELD]: (params) => {
    const { playerName, pieceIdx, pieceLetter } = params;
    return {
      wildcardType:     WILDCARD_TYPES.ACME_SHIELD,
      action:           'shield_piece',   // app.js agrega la ficha a shieldedPieces
      actionData:       { pieceIdx },
      message:          `🛡️ ${playerName} activó ESCUDO ACME en Ficha ${pieceLetter}. ¡Está protegida!`,
      consumeWildcard:  true,
    };
  },

  /**
   * ATAQUE DIRIGIDO:
   * El jugador elige una ficha rival en el camino común.
   * Esa ficha retrocede DIR_ATTACK_DISTANCE casillas.
   * Si cae antes de su casilla de salida → va a la base.
   * Si cae en casilla especial positiva → sigue hasta la siguiente libre.
   * No puede atacar fichas en casillas SAFE ni fichas con Escudo Acme.
   * Solo puede usarse 1 vez por partida.
   * @param {object} params - { playerName, targetPlayerId, targetPlayerName, targetPieceIdx, targetPieceLetter, targetProgress, targetColor }
   * @returns {WildcardResult}
   */
  [WILDCARD_TYPES.DIR_ATTACK]: (params) => {
    const {
      playerName,
      targetPlayerName,
      targetPieceIdx,
      targetPieceLetter,
      targetProgress,
      targetColor,
    } = params;

    // Calcular el nuevo progress después del retroceso
    const newProgress = calculateAttackResult(targetProgress, targetColor);

    return {
      wildcardType:     WILDCARD_TYPES.DIR_ATTACK,
      action:           'move_rival_piece', // app.js mueve la ficha rival
      actionData: {
        targetPieceIdx,
        targetProgress,
        newProgress,
        targetColor,
        distance: DIR_ATTACK_DISTANCE,
      },
      message:          `🎯 ${playerName} usó ATAQUE DIRIGIDO en Ficha ${targetPieceLetter} de ${targetPlayerName}. ¡Retrocede ${DIR_ATTACK_DISTANCE} casillas!`,
      consumeWildcard:  true,
    };
  },

  // ════════════════════════════════════════════════════════
  // AGREGAR HANDLERS DE NUEVOS COMODINES AQUÍ:
  // ════════════════════════════════════════════════════════
};


/* ─────────────────────────────────────────────────────────────
   FUNCIONES DE LÓGICA
───────────────────────────────────────────────────────────── */

/**
 * Calcula el nuevo progress de una ficha después de ser atacada
 * por el Ataque Dirigido (retrocede DIR_ATTACK_DISTANCE casillas).
 * Si el retroceso lleva antes de la salida → va a la base.
 * @param {number} currentProgress - progress actual de la ficha atacada
 * @param {string} color - color de la ficha atacada
 * @returns {number} nuevo progress (-1 si va a base, o el progress reducido)
 */
function calculateAttackResult(currentProgress, color) {
  if (!isOnMainPath(currentProgress)) return currentProgress; // No está en camino, no hace nada

  const newProgress = currentProgress - DIR_ATTACK_DISTANCE;

  // Si el retroceso lleva a antes de la casilla de salida (progress < 0) → base
  if (newProgress < 0) return HOME_PROGRESS; // -1

  return newProgress;
}

/**
 * Verifica si el Ataque Dirigido puede usarse.
 * Requiere:
 * 1. Que no se haya usado en esta partida (dirAttackUsed = false)
 * 2. Que haya fichas rivales atacables en el camino común
 * 3. Que esas fichas no estén en casillas SAFE ni tengan Escudo Acme
 * @param {object} room - snapshot de Firebase
 * @param {string} attackerId - playerId del atacante
 * @returns {boolean}
 */
function canUseDirAttack(room, attackerId) {
  if (room.globalStats?.dirAttackUsed) return false;

  // Verificar que hay fichas rivales atacables
  const attackables = getAttackableTargets(room, attackerId);
  return attackables.length > 0;
}

/**
 * Retorna la lista de fichas rivales que pueden ser atacadas con el Ataque Dirigido.
 * Excluye fichas en base, meta, pasillo, casillas SAFE o con Escudo Acme.
 * @param {object} room
 * @param {string} attackerId
 * @returns {Array<{playerId, playerName, pieceIdx, pieceLetter, progress, color}>}
 */
function getAttackableTargets(room, attackerId) {
  const targets = [];
  if (!room.pieces || !room.players) return targets;

  const specialCells = room.specialCells || {};

  for (const [pid, playerPieces] of Object.entries(room.pieces)) {
    if (pid === attackerId) continue; // No puede atacar sus propias fichas
    const color      = room.players[pid]?.color;
    const playerName = room.players[pid]?.name || 'Rival';
    if (!color) continue;

    const shieldedPieces = room.playerStats?.[pid]?.shieldedPieces || [];

    for (let i = 0; i < PIECES_PER_PLAYER; i++) {
      const progress = playerPieces['p' + i];
      if (!isOnMainPath(progress)) continue; // Solo fichas en camino común

      // Verificar casilla SAFE
      const ringIdx = getRingIndex(color, progress);
      if (isSafeCell(specialCells, ringIdx)) continue; // En casilla segura: no atacable

      // Verificar Escudo Acme
      if (shieldedPieces.includes(i)) continue; // Tiene escudo: no atacable

      targets.push({
        playerId:    pid,
        playerName,
        pieceIdx:    i,
        pieceLetter: PIECE_LETTERS[i],
        progress,
        color,
        ringIdx,
      });
    }
  }

  return targets;
}

/**
 * Retorna la lista de fichas propias que pueden recibir el Escudo Acme.
 * Solo fichas en el camino común (no base, no pasillo, no meta).
 * @param {object} room
 * @param {string} playerId
 * @returns {Array<{pieceIdx, pieceLetter, progress}>}
 */
function getShieldableTargets(room, playerId) {
  const targets = [];
  if (!room.pieces || !room.pieces[playerId]) return targets;

  const pieces         = room.pieces[playerId];
  const alreadyShielded = room.playerStats?.[playerId]?.shieldedPieces || [];

  for (let i = 0; i < PIECES_PER_PLAYER; i++) {
    const progress = pieces['p' + i];
    if (!isOnMainPath(progress)) continue; // Solo fichas en camino común
    if (alreadyShielded.includes(i)) continue; // Ya tiene escudo

    targets.push({
      pieceIdx:    i,
      pieceLetter: PIECE_LETTERS[i],
      progress,
    });
  }

  return targets;
}

/**
 * Verifica si una ficha específica tiene Escudo Acme activo.
 * @param {object} room
 * @param {string} playerId
 * @param {number} pieceIdx
 * @returns {boolean}
 */
function hasPieceShield(room, playerId, pieceIdx) {
  const shieldedPieces = room.playerStats?.[playerId]?.shieldedPieces || [];
  return shieldedPieces.includes(pieceIdx);
}

/**
 * Aplica el efecto del Escudo Acme a un evento negativo.
 * Retorna el efecto modificado (reducido) o null si se bloquea completamente.
 * @param {string} effectType - tipo de efecto negativo
 * @param {*} effectValue - valor del efecto
 * @returns {{ effectType, effectValue, shieldConsumed: boolean, protectionMsg: string }}
 */
function applyShieldProtection(effectType, effectValue) {
  switch (effectType) {

    case 'send_home':
      // SEND_HOME: no va a la base, va al punto medio
      // calculateShieldedSendHome se llama desde app.js con el progress actual
      return {
        effectType:    'send_home_shielded',
        effectValue:   null, // app.js calculará el punto medio
        shieldConsumed: true,
        protectionMsg: '🛡️ ¡Escudo Acme! En lugar de la base, va al punto medio.',
      };

    case 'retreat':
      // RETREAT: retrocede la mitad (redondeado hacia arriba)
      const halfRetreat = Math.ceil(Math.abs(effectValue) / 2);
      return {
        effectType:    'retreat_shielded',
        effectValue:   -halfRetreat,
        shieldConsumed: true,
        protectionMsg: `🛡️ ¡Escudo Acme! Retrocede solo ${halfRetreat} casillas en lugar de ${Math.abs(effectValue)}.`,
      };

    case 'lose_turn':
      // LOSE_TURN: protección completa (no pierde el turno)
      return {
        effectType:    'lose_turn_blocked',
        effectValue:   null,
        shieldConsumed: true,
        protectionMsg: '🛡️ ¡Escudo Acme! El turno perdido fue bloqueado completamente.',
      };

    case 'capture':
      // CAPTURA: la ficha va al punto medio en lugar de la base
      return {
        effectType:    'capture_shielded',
        effectValue:   null, // app.js calculará el punto medio
        shieldConsumed: true,
        protectionMsg: '🛡️ ¡Escudo Acme! La ficha va al punto medio en lugar de la base.',
      };

    default:
      // Efecto no protegido por el escudo
      return null;
  }
}


/* ─────────────────────────────────────────────────────────────
   FUNCIONES DE INVENTARIO DE COMODINES
───────────────────────────────────────────────────────────── */

/**
 * Verifica si un jugador puede recibir un comodín de un tipo específico.
 * No puede acumular más de MAX_WILDCARDS_PER_TYPE de cada tipo.
 * @param {object} wildcards - { discard: N, acme_shield: N, dir_attack: N }
 * @param {string} wildcardType
 * @returns {boolean}
 */
function canReceiveWildcard(wildcards, wildcardType) {
  if (!wildcards) return true;
  const current = wildcards[wildcardType] || 0;
  return current < MAX_WILDCARDS_PER_TYPE;
}

/**
 * Agrega 1 comodín al inventario de un jugador.
 * Respeta el máximo por tipo.
 * @param {object} wildcards - inventario actual
 * @param {string} wildcardType
 * @returns {object} nuevo inventario (sin mutar el original)
 */
function addWildcard(wildcards, wildcardType) {
  const current = (wildcards?.[wildcardType] || 0);
  if (current >= MAX_WILDCARDS_PER_TYPE) return wildcards; // Ya tiene el máximo
  return {
    ...wildcards,
    [wildcardType]: current + 1,
  };
}

/**
 * Consume 1 comodín del inventario de un jugador.
 * @param {object} wildcards
 * @param {string} wildcardType
 * @returns {object} nuevo inventario
 */
function consumeWildcard(wildcards, wildcardType) {
  const current = (wildcards?.[wildcardType] || 0);
  if (current <= 0) return wildcards;
  return {
    ...wildcards,
    [wildcardType]: current - 1,
  };
}

/**
 * Retorna un tipo de comodín aleatorio de los disponibles.
 * Usado por el evento "cada 10 turnos → comodín aleatorio".
 * @returns {string} WILDCARD_TYPES value
 */
function getRandomWildcardType() {
  const types = Object.values(WILDCARD_TYPES);
  return types[Math.floor(Math.random() * types.length)];
}

/**
 * Verifica si el jugador tiene al menos 1 comodín de un tipo.
 * @param {object} wildcards
 * @param {string} wildcardType
 * @returns {boolean}
 */
function hasWildcard(wildcards, wildcardType) {
  return (wildcards?.[wildcardType] || 0) > 0;
}

/**
 * Cuenta el total de comodines de un jugador (todos los tipos sumados).
 * Usado para el desempate en el ranking.
 * @param {object} wildcards
 * @returns {number}
 */
function getTotalWildcards(wildcards) {
  if (!wildcards) return 0;
  return Object.values(wildcards).reduce((sum, count) => sum + (count || 0), 0);
}

/**
 * Genera el HTML/texto del panel de comodines de un jugador.
 * Retorna un array de { icon, name, count } para renderizar en la UI.
 * @param {object} wildcards
 * @returns {Array<{type, icon, name, count}>}
 */
function getWildcardDisplayData(wildcards) {
  if (!wildcards) return [];
  return Object.entries(WILDCARD_TYPES)
    .map(([, type]) => {
      const count = wildcards[type] || 0;
      if (count === 0) return null;
      const config = WILDCARD_CONFIG[type];
      return {
        type,
        icon:  config?.icon  || '?',
        name:  config?.name  || type,
        count,
      };
    })
    .filter(Boolean);
}

/**
 * Verifica si el Escudo Acme puede aplicarse en un contexto dado.
 * El escudo no actúa si la ficha está en base, pasillo de meta o meta.
 * @param {number} progress - progress de la ficha
 * @returns {boolean}
 */
function shieldAppliesAt(progress) {
  return isOnMainPath(progress); // Solo en el camino común
}

console.log('[wildcards.js] Sistema de comodines cargado.');
console.log(`[wildcards.js] Comodines disponibles: ${Object.values(WILDCARD_TYPES).join(', ')}`);
