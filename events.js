/* ═══════════════════════════════════════════════════════════════════
   PARCHÍS ONLINE v2 — events.js
   Sistema de eventos del juego: disparadores y efectos.

   PARA AGREGAR UN NUEVO EVENTO:
   1. Agregar la constante en GAME_EVENTS
   2. Definir trigger, effect, target, repeatable
   3. Agregar el procesamiento en checkAndFireEvents()
   4. Agregar el efecto en applyEventEffect()

   TIPOS DE TARGET (a quién afecta el evento):
   - 'all'            → a todos los jugadores
   - 'trigger_player' → solo al jugador que disparó el evento
   - 'others'         → a todos MENOS el jugador que lo disparó
   - 'last_place'     → al jugador en último lugar

   TIPOS DE EFFECTS:
   - 'reposition_special_cells' → reposiciona todas las casillas especiales
   - 'give_wildcard'            → da un comodín específico a alguien
   - 'give_random_wildcard'     → da un comodín aleatorio a alguien
   - 'add_exit_cell'            → agrega casilla de salida adicional
   - 'remove_exit_cell'         → quita casilla de salida
   - 'add_exit_number'          → agrega número de salida
   - 'remove_exit_number'       → quita número de salida
═══════════════════════════════════════════════════════════════════ */


/* ─────────────────────────────────────────────────────────────
   DEFINICIÓN DE TODOS LOS EVENTOS DEL JUEGO
   Modificar esta lista para ajustar cuándo y cómo se disparan.
───────────────────────────────────────────────────────────── */
const GAME_EVENTS = {

  // ── Reposicionamiento de casillas especiales ──────────────────

  PIECES_IN_GOAL_2: {
    id:          'PIECES_IN_GOAL_2',
    trigger:     'total_pieces_in_goal',
    triggerValue: 2,
    effect:      'reposition_special_cells',
    target:      'all',
    repeatable:  true,  // Se vuelve a disparar si llegan 4, 6, etc. fichas
    modes:       ['race', 'wild'],
    icon:        '🔄',
    title:       '¡Casillas especiales se mueven!',
    description: '2 fichas llegaron a la meta',
    effectDesc:  'Las casillas especiales han sido reposicionadas aleatoriamente.',
  },

  PIECES_IN_GOAL_4: {
    id:          'PIECES_IN_GOAL_4',
    trigger:     'total_pieces_in_goal',
    triggerValue: 4,
    effect:      'reposition_special_cells',
    target:      'all',
    repeatable:  true,
    modes:       ['race', 'wild'],
    icon:        '🔄',
    title:       '¡Casillas especiales se mueven!',
    description: '4 fichas llegaron a la meta en total',
    effectDesc:  'Las casillas especiales han sido reposicionadas aleatoriamente.',
  },

  PIECES_IN_GOAL_6: {
    id:          'PIECES_IN_GOAL_6',
    trigger:     'total_pieces_in_goal',
    triggerValue: 6,
    effect:      'reposition_special_cells',
    target:      'all',
    repeatable:  true,
    modes:       ['race', 'wild'],
    icon:        '🔄',
    title:       '¡Casillas especiales se mueven!',
    description: '6 fichas llegaron a la meta en total',
    effectDesc:  'Las casillas especiales han sido reposicionadas aleatoriamente.',
  },

  PLAYER_3_IN_GOAL: {
    id:          'PLAYER_3_IN_GOAL',
    trigger:     'player_pieces_in_goal',
    triggerValue: 3,
    effect:      'reposition_special_cells',
    target:      'all',
    repeatable:  true,
    modes:       ['race', 'wild'],
    icon:        '🔄',
    title:       '¡Casillas especiales se mueven!',
    description: 'Un jugador lleva 3 fichas a la meta',
    effectDesc:  'Las casillas especiales han sido reposicionadas.',
  },

  // ── Comodines (solo modo Wild) ────────────────────────────────

  FIRST_PIECE_TO_GOAL: {
    id:          'FIRST_PIECE_TO_GOAL',
    trigger:     'first_piece_ever_to_goal',
    effect:      'give_wildcard',
    wildcard:    WILDCARD_TYPES.ACME_SHIELD,
    target:      'trigger_player',
    repeatable:  false, // Una sola vez en toda la partida
    modes:       ['wild'],
    icon:        '🏆',
    title:       '¡Primera ficha en meta!',
    description: 'El primer jugador en llevar una ficha a la meta',
    effectDesc:  'Recibe un Escudo Acme.',
  },

  PIECE_EATEN: {
    id:          'PIECE_EATEN',
    trigger:     'piece_eaten',
    effect:      'give_wildcard',
    wildcard:    WILDCARD_TYPES.DISCARD,
    target:      'victim_player',  // El jugador cuya ficha fue comida
    repeatable:  true,
    modes:       ['wild'],
    icon:        '💥',
    title:       '¡Ficha comida!',
    description: 'Una ficha fue comida por un rival',
    effectDesc:  'El jugador comido recibe un comodín Descarte.',
  },

  ONLY_WITHOUT_BASE_PIECE: {
    id:          'ONLY_WITHOUT_BASE_PIECE',
    trigger:     'only_player_without_piece_in_base',
    effect:      'give_wildcard',
    wildcard:    WILDCARD_TYPES.DIR_ATTACK,
    target:      'trigger_player',
    repeatable:  false, // Una sola vez por partida
    modes:       ['wild'],
    icon:        '🎯',
    title:       '¡Solitario en el camino!',
    description: 'El único jugador sin fichas en la base',
    effectDesc:  'Recibe el comodín Ataque Dirigido.',
  },

  EVERY_10_TURNS: {
    id:          'EVERY_10_TURNS',
    trigger:     'turn_count_interval',
    triggerValue: 10,  // Cada 10 turnos
    effect:      'give_random_wildcard',
    target:      'all',
    repeatable:  true,
    modes:       ['wild'],
    icon:        '🎁',
    title:       '¡Turno 10!',
    description: 'Cada 10 turnos completados',
    effectDesc:  'Todos los jugadores reciben un comodín aleatorio.',
  },

  // ── Casillas de salida adicionales (todos los modos) ──────────

  PIECES_SENT_BACK_3: {
    id:          'PIECES_SENT_BACK_3',
    trigger:     'player_pieces_sent_back_multiple',
    triggerValue: 3,  // Cada 3 fichas regresadas a la base acumula
    effect:      'add_exit_cell',
    target:      'trigger_player',
    repeatable:  true, // Por cada 3 fichas regresadas acumuladas
    modes:       ['classic', 'race', 'wild'],
    icon:        '🚪',
    title:       '¡Nueva casilla de salida!',
    description: 'Cada 3 fichas que te regresan a la base',
    effectDesc:  'Desbloqueas una nueva casilla de salida adicional.',
  },

  PLAYER_3_IN_GOAL_REMOVE_EXIT: {
    id:          'PLAYER_3_IN_GOAL_REMOVE_EXIT',
    trigger:     'player_pieces_in_goal',
    triggerValue: 3,
    effect:      'remove_exit_cell',
    target:      'trigger_player',
    repeatable:  false,
    modes:       ['classic', 'race', 'wild'],
    icon:        '🚫',
    title:       '¡Pierdes una salida!',
    description: 'Llevas 3 fichas a la meta',
    effectDesc:  'Pierdes tu casilla de salida adicional más reciente (si tenías alguna).',
  },

  // ── Números de salida (todos los modos) ───────────────────────

  PIECES_SENT_BACK_3_EXIT_NUMBER: {
    id:          'PIECES_SENT_BACK_3_EXIT_NUMBER',
    trigger:     'player_pieces_sent_back_multiple',
    triggerValue: 3,
    effect:      'add_exit_number',
    target:      'trigger_player',
    repeatable:  true,
    modes:       ['classic', 'race', 'wild'],
    icon:        '🔢',
    title:       '¡Nuevo número de salida!',
    description: 'Cada 3 fichas regresadas a la base',
    effectDesc:  'Desbloqueas un número adicional para sacar fichas de la base.',
  },

  PLAYER_3_IN_GOAL_REMOVE_NUMBER: {
    id:          'PLAYER_3_IN_GOAL_REMOVE_NUMBER',
    trigger:     'player_pieces_in_goal',
    triggerValue: 3,
    effect:      'remove_exit_number',
    target:      'trigger_player',
    repeatable:  false,
    modes:       ['classic', 'race', 'wild'],
    icon:        '🔻',
    title:       '¡Pierdes un número de salida!',
    description: 'Llevas 3 fichas a la meta',
    effectDesc:  'Pierdes tu número de salida adicional más reciente (si tenías alguno).',
  },

  // ════════════════════════════════════════════════════════════
  // AGREGAR NUEVOS EVENTOS AQUÍ:
  // ════════════════════════════════════════════════════════════
  // EXAMPLE_EVENT: {
  //   id: 'EXAMPLE_EVENT',
  //   trigger: 'trigger_type',
  //   triggerValue: N,
  //   effect: 'effect_type',
  //   target: 'all' | 'trigger_player' | 'others' | 'victim_player',
  //   repeatable: true | false,
  //   modes: ['classic', 'race', 'wild'],
  //   icon: '⚡', title: '...', description: '...', effectDesc: '...',
  // },
};


/* ─────────────────────────────────────────────────────────────
   CONTROL DE EVENTOS DISPARADOS
   Estructura guardada en Firebase para saber cuáles ya ocurrieron.
   firedEvents: { eventId: true }         → evento no repetible ya disparado
   firedEventCounts: { eventId: number }  → cuántas veces se ha disparado (para repeatable)
───────────────────────────────────────────────────────────── */

/**
 * Verifica si un evento no repetible ya fue disparado.
 * @param {object} firedEvents - { eventId: true }
 * @param {string} eventId
 * @returns {boolean}
 */
function wasEventFired(firedEvents, eventId) {
  return !!(firedEvents?.[eventId]);
}

/**
 * Marca un evento como disparado.
 * @param {string} eventId
 * @returns {object} update para Firebase { ['firedEvents/' + eventId]: true }
 */
function markEventFired(eventId) {
  return { [`firedEvents/${eventId}`]: true };
}


/* ─────────────────────────────────────────────────────────────
   VERIFICACIÓN DE DISPARADORES
   checkAndFireEvents() se llama desde app.js después de cada acción
   relevante (mover ficha, llegar a meta, comer ficha, etc.).
───────────────────────────────────────────────────────────── */

/**
 * Verifica todos los eventos y retorna los que deben dispararse.
 * NO modifica Firebase; solo retorna los eventos pendientes para
 * que app.js los procese uno a uno.
 *
 * @param {object} room - snapshot fresco de Firebase
 * @param {string} context - contexto de la verificación
 *   Valores posibles:
 *   'piece_moved'          → después de mover cualquier ficha
 *   'piece_to_goal'        → después de que una ficha llegó a meta
 *   'piece_eaten'          → después de comer una ficha
 *   'turn_started'         → al iniciar un turno
 *   'turn_ended'           → al terminar un turno
 * @param {object} contextData - datos adicionales del contexto
 *   Para 'piece_to_goal':  { playerId, pieceIdx }
 *   Para 'piece_eaten':    { attackerId, victimId, victimPieceIdx }
 *   Para 'turn_started':   { playerId, turnCount }
 * @returns {Array<{event, contextData}>} array de eventos a disparar
 */
function checkAndFireEvents(room, context, contextData = {}) {
  const toFire  = [];
  const gameMode = room.config?.gameMode || 'classic';
  const firedEvents = room.firedEvents || {};
  const globalStats = room.globalStats || {};

  for (const event of Object.values(GAME_EVENTS)) {
    // Verificar si el modo de juego es compatible
    if (!event.modes.includes(gameMode)) continue;

    // Verificar si ya fue disparado (para no repetibles)
    if (!event.repeatable && wasEventFired(firedEvents, event.id)) continue;

    // Verificar el disparador según el contexto
    let shouldFire = false;

    switch (event.trigger) {

      case 'total_pieces_in_goal':
        if (context === 'piece_to_goal') {
          const totalInGoal = countTotalPiecesInGoal(room);
          // Para repeatable: se dispara cada vez que el total alcanza un múltiplo
          const prevTotal = totalInGoal - 1; // Antes de esta ficha
          const threshold = event.triggerValue;
          shouldFire = (totalInGoal >= threshold) &&
                       (Math.floor(totalInGoal / threshold) > Math.floor(prevTotal / threshold));
        }
        break;

      case 'player_pieces_in_goal':
        if (context === 'piece_to_goal' && contextData.playerId) {
          const playerGoalCount = countPlayerPiecesInGoal(room, contextData.playerId);
          const prevGoalCount   = playerGoalCount - 1;
          shouldFire = (playerGoalCount === event.triggerValue) &&
                       (prevGoalCount  < event.triggerValue);
        }
        break;

      case 'first_piece_ever_to_goal':
        if (context === 'piece_to_goal') {
          shouldFire = !globalStats.firstToGoalDone;
        }
        break;

      case 'piece_eaten':
        shouldFire = (context === 'piece_eaten');
        break;

      case 'only_player_without_piece_in_base':
        if (context === 'piece_moved' || context === 'piece_to_goal') {
          shouldFire = isOnlyPlayerWithoutBase(room, contextData.playerId) &&
                       !globalStats.dirAttackUsed;
        }
        break;

      case 'turn_count_interval':
        if (context === 'turn_ended') {
          const turnCount = globalStats.totalTurns || 0;
          const prevCount = turnCount - 1;
          shouldFire = (Math.floor(turnCount / event.triggerValue) >
                        Math.floor(prevCount  / event.triggerValue));
        }
        break;

      case 'player_pieces_sent_back_multiple':
        if (context === 'piece_eaten' && contextData.victimId) {
          const sentBack = room.playerStats?.[contextData.victimId]?.piecesSentBack || 0;
          const prev     = sentBack - 1;
          shouldFire = (Math.floor(sentBack / event.triggerValue) >
                        Math.floor(prev     / event.triggerValue));
          if (shouldFire) contextData.playerId = contextData.victimId;
        }
        break;

      // ════════════════════════════════════════════════════
      // AGREGAR NUEVOS DISPARADORES AQUÍ:
      // ════════════════════════════════════════════════════
    }

    if (shouldFire) {
      toFire.push({ event, contextData: { ...contextData } });
    }
  }

  return toFire;
}


/* ─────────────────────────────────────────────────────────────
   APLICACIÓN DE EFECTOS
   applyEventEffect() retorna los updates de Firebase necesarios
   para aplicar el efecto. app.js los escribe en Firebase.
───────────────────────────────────────────────────────────── */

/**
 * Calcula los updates de Firebase para aplicar el efecto de un evento.
 * @param {object} event     - definición del evento (GAME_EVENTS value)
 * @param {object} room      - snapshot actual
 * @param {object} contextData - datos del contexto (playerId, victimId, etc.)
 * @returns {object} updates para roomRef().update(updates)
 */
function applyEventEffect(event, room, contextData) {
  const updates = {};
  const now = Date.now();

  // Marcar evento como disparado si no es repetible
  if (!event.repeatable) {
    updates[`firedEvents/${event.id}`] = true;
  }

  switch (event.effect) {

    // ── Reposicionar casillas especiales ───────────────────────
    case 'reposition_special_cells': {
      const occupiedRingIdxs = getOccupiedRingIdxs(room);
      const positiveCount = room.config?.positiveCells || 3;
      const negativeCount = room.config?.negativeCells || 2;
      const newCells = repositionAllSpecialCells(
        room.specialCells,
        positiveCount,
        negativeCount,
        occupiedRingIdxs
      );
      updates['specialCells'] = newCells;
      break;
    }

    // ── Dar comodín específico ─────────────────────────────────
    case 'give_wildcard': {
      const recipients = resolveTargets(event.target, room, contextData);
      for (const pid of recipients) {
        const wildcards = room.playerStats?.[pid]?.wildcards || {};
        if (canReceiveWildcard(wildcards, event.wildcard)) {
          const newWildcards = addWildcard(wildcards, event.wildcard);
          updates[`playerStats/${pid}/wildcards`] = newWildcards;
        }
      }
      // Marcar globalStats si aplica
      if (event.id === 'FIRST_PIECE_TO_GOAL') {
        updates['globalStats/firstToGoalDone'] = true;
      }
      if (event.id === 'ONLY_WITHOUT_BASE_PIECE') {
        updates['globalStats/dirAttackUsed'] = false; // Se reinicia con cada asignación
      }
      break;
    }

    // ── Dar comodín aleatorio ──────────────────────────────────
    case 'give_random_wildcard': {
      const recipients = resolveTargets(event.target, room, contextData);
      for (const pid of recipients) {
        const wildcards = room.playerStats?.[pid]?.wildcards || {};
        const randomType = getRandomWildcardType();
        if (canReceiveWildcard(wildcards, randomType)) {
          const newWildcards = addWildcard(wildcards, randomType);
          updates[`playerStats/${pid}/wildcards`] = newWildcards;
        }
      }
      break;
    }

    // ── Agregar casilla de salida adicional ───────────────────
    case 'add_exit_cell': {
      const pid   = contextData.playerId;
      const color = room.players?.[pid]?.color;
      if (!color) break;

      const currentExtras = room.playerStats?.[pid]?.exitCells?.extras || [];
      const nextIdx = getNextExitCellIndex(color, currentExtras.length);
      if (nextIdx !== null) {
        updates[`playerStats/${pid}/exitCells/extras`] = [...currentExtras, nextIdx];
      }
      break;
    }

    // ── Quitar casilla de salida adicional ────────────────────
    case 'remove_exit_cell': {
      const pid    = contextData.playerId;
      const extras = room.playerStats?.[pid]?.exitCells?.extras || [];
      if (extras.length > 0) {
        // Quitar la más reciente (la última en el array)
        updates[`playerStats/${pid}/exitCells/extras`] = extras.slice(0, -1);
      }
      break;
    }

    // ── Agregar número de salida ──────────────────────────────
    case 'add_exit_number': {
      const pid         = contextData.playerId;
      const exitNumbers = [...(room.playerStats?.[pid]?.exitNumbers || [1, 6])];
      const available   = [1, 2, 3, 4, 5, 6].filter(n => !exitNumbers.includes(n));
      if (available.length > 0) {
        // Agregar un número aleatorio de los no disponibles
        const newNum = available[Math.floor(Math.random() * available.length)];
        updates[`playerStats/${pid}/exitNumbers`] = [...exitNumbers, newNum].sort((a,b)=>a-b);
      }
      break;
    }

    // ── Quitar número de salida ───────────────────────────────
    case 'remove_exit_number': {
      const pid         = contextData.playerId;
      const exitNumbers = [...(room.playerStats?.[pid]?.exitNumbers || [1, 6])];
      // Nunca quitar el 1 o el 6 originales
      const removable   = exitNumbers.filter(n => n !== 1 && n !== 6);
      if (removable.length > 0) {
        // Quitar el último agregado (el mayor que no sea 1 ni 6)
        const toRemove = removable[removable.length - 1];
        updates[`playerStats/${pid}/exitNumbers`] = exitNumbers.filter(n => n !== toRemove);
      }
      break;
    }

    // ════════════════════════════════════════════════════════
    // AGREGAR NUEVOS EFECTOS AQUÍ:
    // ════════════════════════════════════════════════════════
  }

  // Agregar al log de eventos del juego
  const logKey = `${now}_evt_${event.id}`;
  updates[`eventLog/${logKey}`] = {
    msg:  `${event.icon} ${event.title}: ${event.effectDesc}`,
    type: 'event',
    ts:   now,
  };

  return updates;
}


/* ─────────────────────────────────────────────────────────────
   FUNCIONES AUXILIARES
───────────────────────────────────────────────────────────── */

/**
 * Resuelve a qué jugadores afecta un evento según su target.
 * @param {string} target
 * @param {object} room
 * @param {object} contextData
 * @returns {string[]} array de playerIds
 */
function resolveTargets(target, room, contextData) {
  const allPlayers = Object.keys(room.players || {});

  switch (target) {
    case 'all':
      return allPlayers;
    case 'trigger_player':
      return contextData.playerId ? [contextData.playerId] : [];
    case 'victim_player':
      return contextData.victimId ? [contextData.victimId] : [];
    case 'others':
      return allPlayers.filter(pid => pid !== contextData.playerId);
    case 'last_place':
      const last = getLastPlacePlayer(room);
      return last ? [last] : [];
    default:
      return [];
  }
}

/**
 * Cuenta el total de fichas en meta entre todos los jugadores.
 * @param {object} room
 * @returns {number}
 */
function countTotalPiecesInGoal(room) {
  if (!room.pieces) return 0;
  let total = 0;
  for (const pieces of Object.values(room.pieces)) {
    for (let i = 0; i < PIECES_PER_PLAYER; i++) {
      if (isAtGoal(pieces['p' + i])) total++;
    }
  }
  return total;
}

/**
 * Cuenta fichas en meta de un jugador específico.
 * @param {object} room
 * @param {string} playerId
 * @returns {number}
 */
function countPlayerPiecesInGoal(room, playerId) {
  if (!room.pieces || !room.pieces[playerId]) return 0;
  const pieces = room.pieces[playerId];
  let count = 0;
  for (let i = 0; i < PIECES_PER_PLAYER; i++) {
    if (isAtGoal(pieces['p' + i])) count++;
  }
  return count;
}

/**
 * Verifica si un jugador es el ÚNICO sin fichas en base.
 * Se usa para el evento ONLY_WITHOUT_BASE_PIECE.
 * @param {object} room
 * @param {string} playerId
 * @returns {boolean}
 */
function isOnlyPlayerWithoutBase(room, playerId) {
  if (!room.pieces || !playerId) return false;

  // Verificar que el jugador no tiene fichas en base
  const myPieces = room.pieces[playerId];
  if (!myPieces) return false;
  for (let i = 0; i < PIECES_PER_PLAYER; i++) {
    if (isAtHome(myPieces['p' + i])) return false; // Tiene al menos 1 en base
  }

  // Verificar que TODOS los demás tienen al menos 1 en base
  for (const [pid, pieces] of Object.entries(room.pieces)) {
    if (pid === playerId) continue;
    let hasBase = false;
    for (let i = 0; i < PIECES_PER_PLAYER; i++) {
      if (isAtHome(pieces['p' + i])) { hasBase = true; break; }
    }
    if (!hasBase) return false; // Hay otro jugador también sin fichas en base
  }

  return true;
}

/**
 * Retorna el playerId del jugador en último lugar.
 * Criterios (mayor a menor prioridad):
 * 1. Menos fichas en meta
 * 2. Más fichas en base
 * 3. Menos comodines totales
 * En empate: todos los empatados serían targets (pero la función retorna solo 1).
 * @param {object} room
 * @returns {string|null}
 */
function getLastPlacePlayer(room) {
  if (!room.players || !room.pieces) return null;

  const players = Object.keys(room.players);
  let lastPlace = null;
  let lastScore = Infinity;

  for (const pid of players) {
    if (room.players[pid]?.eliminated) continue;
    const pieces   = room.pieces[pid];
    const stats    = room.playerStats?.[pid];
    const inGoal   = countPlayerPiecesInGoal(room, pid);
    const inBase   = countPiecesInState(pieces, 'home');
    const wildcards = getTotalWildcards(stats?.wildcards);

    // Score bajo = peor posición
    // Score = (inGoal * 100) - (inBase * 10) - wildcards
    const score = (inGoal * 100) - (inBase * 10) - wildcards;

    if (score < lastScore) {
      lastScore = score;
      lastPlace = pid;
    }
  }

  return lastPlace;
}

/**
 * Retorna todos los ringIdxs del camino principal que están
 * actualmente ocupados por alguna ficha.
 * Usado al reposicionar casillas especiales para evitar fichas.
 * @param {object} room
 * @returns {number[]}
 */
function getOccupiedRingIdxs(room) {
  const occupied = [];
  if (!room.pieces || !room.players) return occupied;

  for (const [pid, pieces] of Object.entries(room.pieces)) {
    const color = room.players[pid]?.color;
    if (!color) continue;

    for (let i = 0; i < PIECES_PER_PLAYER; i++) {
      const prog = pieces['p' + i];
      if (isOnMainPath(prog)) {
        occupied.push(getRingIndex(color, prog));
      }
    }
  }

  return occupied;
}

/**
 * Genera el objeto de banner para mostrar en la UI cuando se dispara un evento.
 * @param {object} event
 * @param {object} contextData
 * @returns {{ icon, title, description, effectDesc }}
 */
function getEventBannerData(event, contextData) {
  return {
    icon:        event.icon        || '⚡',
    title:       event.title       || '¡Evento!',
    description: event.description || '',
    effectDesc:  event.effectDesc  || '',
  };
}

console.log('[events.js] Sistema de eventos cargado.');
console.log(`[events.js] Eventos disponibles: ${Object.keys(GAME_EVENTS).join(', ')}`);
