export const environment = {
    production: false,
    apiUrl: 'https://localhost:8000/api',
    reverb: {
       key: 'recrutitn-websocket-key',
       host: 'localhost',
       port: 8081,
       scheme: 'http',
       useTLS: false,
    },
    appName: 'Admin Portal - Development',
    firebase: {
       apiKey: "AIzaSyBZ7ITs2HoftiCBQKUE9nYvAb9v47OLRCY",
       authDomain: "recrutementpfe-31e97.firebaseapp.com",
       projectId: "recrutementpfe-31e97",
       storageBucket: "recrutementpfe-31e97.firebasestorage.app",
       messagingSenderId: "420887862296",
       appId: "1:420887862296:web:3b748cc58fe559299ef76d",
       measurementId: "G-ZTC5VVZX6X",
       vapidKey: "BKV9ngyoABcGMA7Vesptul0w9Ror_izYtPilVPr5ia-SI6Ykv7ZtvSTKDRVHx32D5Q5Rp9108mEw7ZXigeRBYfQ"
    },
    // STAFF FIX: Encryption key moved out of source code (token.service.ts).
    // In production, replace this with a strong randomly generated 256-bit key.
    tokenEncryptionKey: 'dev-local-encryption-key-change-in-prod',
    //const app = initializeApp(firebaseConfig);
    //const analytics = getAnalytics(app);
};
