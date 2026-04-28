export const environment = {
    production: true,
    apiUrl: 'https://api.yourcompany.com/api',
    reverb: {
       key: 'REPLACE_WITH_REVERB_APP_KEY',
       host: 'api.yourcompany.com',
       port: 443,
       scheme: 'https',
       useTLS: true,
    },
    appName: 'Admin Portal',
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
    // CRITICAL: Replace this placeholder with a strong randomly generated 256-bit key before deploying to production!
    // Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    tokenEncryptionKey: 'REPLACE_WITH_STRONG_RANDOM_KEY_BEFORE_PROD_DEPLOYMENT',
};
