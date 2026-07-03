// ============================================================
//  APIZZA · config.js  —  Configuración de producción
//  Este archivo se despliega con la app y sobreescribe
//  los valores por defecto de data.js
// ============================================================

const APP_CONFIG = {
  whatsappNumber:  '5491123934273',
  googleMapsApiKey: 'AIzaSyAXFS4ealQUGTRHBqwybWGt6OGsW7FwrNk',
  adminPassword:   '123',
  firebaseConfig: {
    apiKey:            'AIzaSyCoCHLWpgodchNpj_gRiDsa2biPYMdP08k',
    authDomain:        'apizza-ecc06.firebaseapp.com',
    projectId:         'apizza-ecc06',
    storageBucket:     'apizza-ecc06.firebasestorage.app',
    messagingSenderId: '120298533419',
    appId:             '1:120298533419:web:8fed92e6c8f5373b8df06e'
  },
  openHours: {
    enabled:       true,
    from:          '19:00',
    to:            '23:00',
    closedMsg:     'Admiramos tus ganas de pizza! Te esperamos a las 19hs',
    pickupAddress: 'Pujol 187, Villa Luzuriaga'
  }
};
