// firebase_options.dart - Firebase configuration for mobile and web
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart';

// Android configuration
const FirebaseOptions android = FirebaseOptions(
  apiKey: "AIzaSyApIdBvv-n58Yz4JkTLxqBX0KVJ4BSZQ7g",
  authDomain: "recrutementpfe-31e97.firebaseapp.com",
  projectId: "recrutementpfe-31e97",
  storageBucket: "recrutementpfe-31e97.firebasestorage.app",
  messagingSenderId: "420887862296",
  appId: "1:420887862296:android:c0ae8904c5d31c429ef76d",
);

// Web configuration (you'll need to add web app in Firebase Console)
const FirebaseOptions web = FirebaseOptions(
  apiKey: "AIzaSyApIdBvv-n58Yz4JkTLxqBX0KVJ4BSZQ7g",
  authDomain: "recrutementpfe-31e97.firebaseapp.com",
  projectId: "recrutementpfe-31e97",
  storageBucket: "recrutementpfe-31e97.firebasestorage.app",
  messagingSenderId: "420887862296",
  appId: "1:420887862296:web:3b748cc58fe559299ef76d",
  measurementId: "G-ZTC5VVZX6X"
);

// Get appropriate options based on platform
FirebaseOptions get getCurrentPlatformOptions {
  if (kIsWeb) {
    return web;
  }
  // Default to Android for mobile
  return android;
}
