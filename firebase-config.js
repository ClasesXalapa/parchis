// ═══════════════════════════════════════════════════════════════════
// PARCHÍS ONLINE — Configuración de Firebase
// Archivo: firebase-config.example.js  (plantilla — SÍ subir a git)
// ═══════════════════════════════════════════════════════════════════
//
// ┌─────────────────────────────────────────────────────────────┐
// │  INSTRUCCIONES PASO A PASO                                  │
// ├─────────────────────────────────────────────────────────────┤
// │  1. Ve a https://console.firebase.google.com                │
// │  2. Crea un proyecto nuevo (desactiva Analytics)            │
// │  3. En el menú izquierdo → "Realtime Database"              │
// │     → "Crear base de datos" → modo de prueba → Listo        │
// │  4. En el menú izquierdo → "Authentication" → "Comenzar"    │
// │     → Pestaña "Método de inicio de sesión"                  │
// │     → "Anónimo" → Habilitar → Guardar                       │
// │  5. ⚙️ Configuración del proyecto → General                 │
// │     → "Tus apps" → "</>" (Web) → Registrar app              │
// │     → Copia el objeto firebaseConfig que aparece            │
// │  6. Copia ESTE archivo → renómbralo firebase-config.js      │
// │  7. Reemplaza los valores de abajo con los tuyos            │
// │  8. firebase-config.js está en .gitignore (no se sube)      │
// └─────────────────────────────────────────────────────────────┘
//
// PLAN GRATUITO (Spark) — Sin tarjeta de crédito:
//   ✓ 100 conexiones simultáneas  (~25 partidas de 4 jugadores)
//   ✓ 1 GB de almacenamiento      (miles de salas, ~5 KB cada una)
//   ✓ 10 GB/mes de ancho de banda (más que suficiente para amigos)
//   ✓ Sin límite de partidas al día
// ═══════════════════════════════════════════════════════════════════
// Import the functions you need from the SDKs you need
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDwXQ8Elai20DT--t1AtHORbC-OfUmyAEs",
  authDomain: "parchis-online-5d130.firebaseapp.com",
  databaseURL: "https://parchis-online-5d130-default-rtdb.firebaseio.com",
  projectId: "parchis-online-5d130",
  storageBucket: "parchis-online-5d130.firebasestorage.app",
  messagingSenderId: "1025410892303",
  appId: "1:1025410892303:web:b7586ce746079737acd97a"
};



// ═══════════════════════════════════════════════════════════════════
// REGLAS DE SEGURIDAD PARA FIREBASE REALTIME DATABASE
// ═══════════════════════════════════════════════════════════════════
//
// Copia y pega estas reglas en:
// Firebase Console → Realtime Database → Reglas → Publicar
//
// ── OPCIÓN A: Reglas para desarrollo/pruebas (más permisivas) ───
// Requiere que el usuario esté autenticado (anónimo cuenta).
// Úsalas mientras pruebas el juego con amigos.
//
//   {
//     "rules": {
//       ".read":  "auth != null",
//       ".write": "auth != null"
//     }
//   }
//
// ── OPCIÓN B: Reglas ultra-abiertas (solo para prueba inicial) ──
// Sin autenticación. Úsalas SOLO si tienes problemas con el auth.
// ADVERTENCIA: Cualquiera podría leer/escribir tu base de datos.
//
//   {
//     "rules": {
//       ".read":  true,
//       ".write": true
//     }
//   }
//
// ── OPCIÓN C: Reglas recomendadas para producción ────────────────
// Protege salas individuales. Requiere Firebase Auth anónimo.
//
//   {
//     "rules": {
//       "rooms": {
//         "$roomCode": {
//           ".read":  "auth != null",
//           ".write": "auth != null",
//           "players": {
//             "$playerId": {
//               ".write": "auth != null && (auth.uid === $playerId || !data.exists())"
//             }
//           }
//         }
//       }
//     }
//   }
//
// ── RECOMENDACIÓN ────────────────────────────────────────────────
// Para jugar con amigos de confianza: usa la Opción A.
// Si quieres máxima seguridad en el futuro: usa la Opción C
// y migra la generación de dados a Firebase Cloud Functions.
// ═══════════════════════════════════════════════════════════════════
