// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for French (`fr`).
class AppLocalizationsFr extends AppLocalizations {
  AppLocalizationsFr([String locale = 'fr']) : super(locale);

  @override
  String get appTitle => 'Application de Recrutement';

  @override
  String get login => 'Connexion';

  @override
  String get loginTitleAesthetic =>
      'Connectez-vous pour accéder à votre espace';

  @override
  String get register => 'S\'inscrire';

  @override
  String get email => 'Email';

  @override
  String get password => 'Mot de passe';

  @override
  String get forgotPassword => 'Mot de passe oublié ?';

  @override
  String get home => 'Accueil';

  @override
  String get profile => 'Profil';

  @override
  String get settings => 'Paramètres';

  @override
  String get welcome => 'Bon retour !';

  @override
  String get loading => 'Chargement...';

  @override
  String welcomeUser(Object name) {
    return 'Bienvenue, $name !';
  }

  @override
  String get welcomeBackTitle => 'Bon retour ! 👋';

  @override
  String get welcomeBackSubtitle =>
      'Connectez-vous pour accéder à votre espace de recrutement.';

  @override
  String get emailHint => 'Email';

  @override
  String get passwordHint => 'Mot de passe';

  @override
  String get emailRequired => 'Veuillez saisir votre adresse e-mail.';

  @override
  String get passwordRequired => 'Veuillez saisir votre mot de passe.';

  @override
  String get loginButton => 'Se connecter';

  @override
  String get newHere => 'Nouveau ici ? ';

  @override
  String get createAccount => 'Créer un compte';

  @override
  String get letsStartTitle => 'Commençons ! 🚀';

  @override
  String get letsStartSubtitle =>
      'Créez votre compte en quelques secondes pour rejoindre l\'aventure.';

  @override
  String get fullNameHint => 'Nom complet';

  @override
  String get nameRequired => 'Veuillez saisir votre nom complet.';

  @override
  String get passwordMinLength => 'Minimum 8 caractères';

  @override
  String get confirmPasswordHint => 'Confirmer mot de passe';

  @override
  String get passwordsDoNotMatch => 'Les mots de passe ne correspondent pas';

  @override
  String get chooseProfile => 'Choisissez votre profil';

  @override
  String get roleCandidate => 'Candidat';

  @override
  String get continueButton => 'Continuer';

  @override
  String get alreadyRegistered => 'Déjà inscrit ? ';

  @override
  String get emailInUse => 'Cet email est déjà utilisé par un autre compte.';

  @override
  String get resetPasswordTitle => 'Réinitialiser mot de passe';

  @override
  String get resetPasswordSubtitle =>
      'Entrez votre email pour recevoir un lien de réinitialisation et créez un nouveau mot de passe sécurisé.';

  @override
  String get resetPasswordSuccess =>
      'Mot de passe réinitialisé avec succès ! Connectez-vous.';

  @override
  String get newPasswordHint => 'Nouveau mot de passe';

  @override
  String get cancelButton => 'Annuler';

  @override
  String greeting(Object name) {
    return 'Bonjour, $name 👋';
  }

  @override
  String get greetingSubtitle => 'Prêt pour de nouvelles opportunités ?';

  @override
  String get dashboard => 'Tableau de bord';

  @override
  String get myProfile => 'Mon Profil';

  @override
  String get favorites => 'Favoris';

  @override
  String get messages => 'Messages';

  @override
  String get logout => 'Déconnexion';

  @override
  String get featuredCompanies => 'Entreprises à la une';

  @override
  String get topTalents => 'Top Talents pour vous';

  @override
  String get recommendedOffers => 'Offres recommandées';

  @override
  String get viewAll => 'Voir tout';

  @override
  String get postOffer => 'Poster une offre';

  @override
  String get statsOffers => 'Offres';

  @override
  String get statsApplied => 'Appliquées';

  @override
  String get statsInterviews => 'Entretiens';

  @override
  String get statsViews => 'Vues';

  @override
  String get statsScore => 'Score';

  @override
  String get completeProfileTitle => 'Compléter Profil';

  @override
  String get lastStepTitle => 'Dernière étape ✨';

  @override
  String get lastStepSubtitle => 'Parlez-nous un peu plus de vous...';

  @override
  String get profilePhoto => 'Photo de profil';

  @override
  String get location => 'Lieu de résidence';

  @override
  String get specialty => 'Spécialité';

  @override
  String get isStudentQuestion => 'Êtes-vous encore étudiant ?';

  @override
  String get isEngineerQuestion => 'Êtes-vous ingénieur ?';

  @override
  String get bioHint => 'Bio (Racontez votre parcours...)';

  @override
  String get finalizeProfileButton => 'Finaliser mon profil';

  @override
  String get photoOptional => 'Optionnel';

  @override
  String get addSkillsTitle => 'Ajouter des Compétences';

  @override
  String get addSkillsSubtitle =>
      'Saisissez vos compétences ou choisissez parmi les suggestions :';

  @override
  String get skillsHint => 'Ex: TypeScript, CSS...';

  @override
  String get add => 'Ajouter';

  @override
  String get yes => 'Oui';

  @override
  String get no => 'Non';

  @override
  String get back => 'Retour';

  @override
  String get success => 'Succès';

  @override
  String get error => 'Erreur';

  @override
  String get profilePhotoUpdated => 'Photo de profil mise à jour avec succès !';

  @override
  String get skillsUpdated => 'Compétences mises à jour !';

  @override
  String get fileTooLarge => 'Fichier trop volumineux';

  @override
  String get unsupportedFormat => 'Format non supporté';

  @override
  String get deleteCv => 'Supprimer le CV ?';

  @override
  String get deleteCvConfirmation =>
      'Êtes-vous sûr de vouloir supprimer votre CV ?';

  @override
  String get delete => 'Supprimer';

  @override
  String get cvDeleted => 'CV supprimé avec succès';

  @override
  String get uploading => 'Téléchargement...';

  @override
  String get accountSecurity => 'SÉCURITÉ DU COMPTE';

  @override
  String get changePassword => 'Changer le mot de passe';

  @override
  String get changePasswordSubtitle => 'Renforcez la sécurité de votre accès';

  @override
  String get emailVerification => 'Vérification de l\'email';

  @override
  String get emailVerifiedSubtitle => 'Votre compte est actuellement vérifié';

  @override
  String get globalLogout => 'Déconnexion globale';

  @override
  String get globalLogoutSubtitle => 'Se déconnecter de tous les appareils';

  @override
  String get globalLogoutDialogTitle => 'Déconnexion globale';

  @override
  String get globalLogoutDialogContent =>
      'Voulez-vous vraiment vous déconnecter de tous les appareils connectés ?';

  @override
  String get preferences => 'PRÉFÉRENCES';

  @override
  String get appLanguage => 'Langue de l\'application';

  @override
  String currentLanguage(Object lang) {
    return 'Actuellement : $lang';
  }

  @override
  String get dangerZone => 'ZONE DE DANGER';

  @override
  String get deactivateAccount => 'Désactiver le compte';

  @override
  String get deactivateAccountSubtitle => 'Cacher temporairement votre profil';

  @override
  String get deactivateAccountDialogTitle => 'Désactiver le compte';

  @override
  String get deactivateAccountDialogContent =>
      'Votre profil ne sera plus visible par les recruteurs. Vous pourrez le réactiver à tout moment en vous reconnectant.';

  @override
  String get deleteAccountPermanent => 'Supprimer définitivement';

  @override
  String get deleteAccountSubtitle => 'Action irréversible sur vos données';

  @override
  String get deleteAccountDialogTitle => 'Suppression définitive';

  @override
  String get deleteAccountDialogContent =>
      'Toutes vos données seront effacées. Cette action est irréversible.';

  @override
  String languageChanged(Object lang) {
    return 'Langue changée en $lang';
  }

  @override
  String get accountDeactivated => 'Compte désactivé avec succès';

  @override
  String get deleteRequestSent => 'Demande de suppression envoyée.';

  @override
  String get logoutAllSuccess => 'Déconnexion de tous les appareils réussie.';

  @override
  String get editProfileTitle => 'Modifier Profil';

  @override
  String get basicInfo => 'Informations de base';

  @override
  String get basicInfoSubtitle =>
      'Mettez à jour vos informations personnelles.';

  @override
  String get fullName => 'Nom complet';

  @override
  String get yourNameHint => 'Votre nom';

  @override
  String get yourEmailHint => 'votre@email.com';

  @override
  String get phoneNumber => 'Numéro de téléphone';

  @override
  String get selectCity => 'Sélectionnez votre ville';

  @override
  String get saveChanges => 'Enregistrer les changements';

  @override
  String get infoUpdated => 'Informations mises à jour !';

  @override
  String get updatePassword => 'Mettre à jour le mot de passe';

  @override
  String get passwordUpdatedSuccess =>
      'Votre mot de passe a été mis à jour avec succès.';

  @override
  String get currentPassword => 'Mot de passe actuel';

  @override
  String get enterCurrentPassword => 'Entrez votre mot de passe actuel';

  @override
  String get newPassword => 'Nouveau mot de passe';

  @override
  String get enterNewPassword => 'Veuillez entrer un nouveau mot de passe';

  @override
  String get confirmNewPassword => 'Confirmer le nouveau mot de passe';

  @override
  String get repeatNewPassword => 'Répétez le nouveau mot de passe';

  @override
  String get passwordSecurityInfo =>
      'Pour des raisons de sécurité, nous vous recommandons d\'utiliser un mot de passe unique que vous n\'utilisez pas sur d\'autres sites.';

  @override
  String get ok => 'OK';

  @override
  String get confirm => 'Confirmer';

  @override
  String get passwordStrength => 'Force du mot de passe';

  @override
  String get strengthWeak => 'Faible';

  @override
  String get strengthFair => 'Moyen';

  @override
  String get strengthGood => 'Bon';

  @override
  String get strengthStrong => 'Fort';

  @override
  String get passwordsMatch => 'Les mots de passe correspondent';

  @override
  String get viewPicture => 'Voir la photo';

  @override
  String get changePicture => 'Changer la photo';

  @override
  String get calendar => 'CALENDRIER';

  @override
  String get selectYear => 'Sélectionnez l\'année';

  @override
  String get pleaseWaitUploading =>
      'Veuillez patienter pendant le téléchargement...';
}
