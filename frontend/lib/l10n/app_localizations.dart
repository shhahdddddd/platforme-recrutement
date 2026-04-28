import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ar.dart';
import 'app_localizations_en.dart';
import 'app_localizations_fr.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ar'),
    Locale('en'),
    Locale('fr'),
  ];

  /// No description provided for @appTitle.
  ///
  /// In en, this message translates to:
  /// **'Recruitment App'**
  String get appTitle;

  /// No description provided for @login.
  ///
  /// In en, this message translates to:
  /// **'Login'**
  String get login;

  /// No description provided for @loginTitleAesthetic.
  ///
  /// In en, this message translates to:
  /// **'Log in to access your space'**
  String get loginTitleAesthetic;

  /// No description provided for @register.
  ///
  /// In en, this message translates to:
  /// **'Register'**
  String get register;

  /// No description provided for @email.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get email;

  /// No description provided for @password.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get password;

  /// No description provided for @forgotPassword.
  ///
  /// In en, this message translates to:
  /// **'Forgot Password?'**
  String get forgotPassword;

  /// No description provided for @home.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get home;

  /// No description provided for @profile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profile;

  /// No description provided for @settings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settings;

  /// No description provided for @welcome.
  ///
  /// In en, this message translates to:
  /// **'Welcome back!'**
  String get welcome;

  /// No description provided for @loading.
  ///
  /// In en, this message translates to:
  /// **'Loading...'**
  String get loading;

  /// No description provided for @welcomeUser.
  ///
  /// In en, this message translates to:
  /// **'Welcome, {name}!'**
  String welcomeUser(Object name);

  /// No description provided for @welcomeBackTitle.
  ///
  /// In en, this message translates to:
  /// **'Welcome back! 👋'**
  String get welcomeBackTitle;

  /// No description provided for @welcomeBackSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Log in to access your recruitment space.'**
  String get welcomeBackSubtitle;

  /// No description provided for @emailHint.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get emailHint;

  /// No description provided for @passwordHint.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get passwordHint;

  /// No description provided for @emailRequired.
  ///
  /// In en, this message translates to:
  /// **'Please enter your email address.'**
  String get emailRequired;

  /// No description provided for @passwordRequired.
  ///
  /// In en, this message translates to:
  /// **'Please enter your password.'**
  String get passwordRequired;

  /// No description provided for @loginButton.
  ///
  /// In en, this message translates to:
  /// **'Login'**
  String get loginButton;

  /// No description provided for @newHere.
  ///
  /// In en, this message translates to:
  /// **'New here? '**
  String get newHere;

  /// No description provided for @createAccount.
  ///
  /// In en, this message translates to:
  /// **'Create account'**
  String get createAccount;

  /// No description provided for @letsStartTitle.
  ///
  /// In en, this message translates to:
  /// **'Let\'s get started! 🚀'**
  String get letsStartTitle;

  /// No description provided for @letsStartSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Create your account in seconds to join the adventure.'**
  String get letsStartSubtitle;

  /// No description provided for @fullNameHint.
  ///
  /// In en, this message translates to:
  /// **'Full Name'**
  String get fullNameHint;

  /// No description provided for @nameRequired.
  ///
  /// In en, this message translates to:
  /// **'Please enter your full name.'**
  String get nameRequired;

  /// No description provided for @passwordMinLength.
  ///
  /// In en, this message translates to:
  /// **'Minimum 8 characters'**
  String get passwordMinLength;

  /// No description provided for @confirmPasswordHint.
  ///
  /// In en, this message translates to:
  /// **'Confirm Password'**
  String get confirmPasswordHint;

  /// No description provided for @passwordsDoNotMatch.
  ///
  /// In en, this message translates to:
  /// **'Passwords do not match'**
  String get passwordsDoNotMatch;

  /// No description provided for @chooseProfile.
  ///
  /// In en, this message translates to:
  /// **'Choose your profile'**
  String get chooseProfile;

  /// No description provided for @roleCandidate.
  ///
  /// In en, this message translates to:
  /// **'Candidate'**
  String get roleCandidate;

  /// No description provided for @continueButton.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get continueButton;

  /// No description provided for @alreadyRegistered.
  ///
  /// In en, this message translates to:
  /// **'Already registered? '**
  String get alreadyRegistered;

  /// No description provided for @emailInUse.
  ///
  /// In en, this message translates to:
  /// **'This email is already in use.'**
  String get emailInUse;

  /// No description provided for @resetPasswordTitle.
  ///
  /// In en, this message translates to:
  /// **'Reset Password'**
  String get resetPasswordTitle;

  /// No description provided for @resetPasswordSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Enter your email to receive a password reset link and create a new secure password.'**
  String get resetPasswordSubtitle;

  /// No description provided for @resetPasswordSuccess.
  ///
  /// In en, this message translates to:
  /// **'Password reset successfully! Log in.'**
  String get resetPasswordSuccess;

  /// No description provided for @newPasswordHint.
  ///
  /// In en, this message translates to:
  /// **'New Password'**
  String get newPasswordHint;

  /// No description provided for @cancelButton.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancelButton;

  /// No description provided for @greeting.
  ///
  /// In en, this message translates to:
  /// **'Hello, {name} 👋'**
  String greeting(Object name);

  /// No description provided for @greetingSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Ready for new opportunities?'**
  String get greetingSubtitle;

  /// No description provided for @dashboard.
  ///
  /// In en, this message translates to:
  /// **'Dashboard'**
  String get dashboard;

  /// No description provided for @myProfile.
  ///
  /// In en, this message translates to:
  /// **'My Profile'**
  String get myProfile;

  /// No description provided for @favorites.
  ///
  /// In en, this message translates to:
  /// **'Favorites'**
  String get favorites;

  /// No description provided for @messages.
  ///
  /// In en, this message translates to:
  /// **'Messages'**
  String get messages;

  /// No description provided for @logout.
  ///
  /// In en, this message translates to:
  /// **'Logout'**
  String get logout;

  /// No description provided for @featuredCompanies.
  ///
  /// In en, this message translates to:
  /// **'Featured Companies'**
  String get featuredCompanies;

  /// No description provided for @topTalents.
  ///
  /// In en, this message translates to:
  /// **'Top Talents for you'**
  String get topTalents;

  /// No description provided for @recommendedOffers.
  ///
  /// In en, this message translates to:
  /// **'Recommended Offers'**
  String get recommendedOffers;

  /// No description provided for @viewAll.
  ///
  /// In en, this message translates to:
  /// **'View All'**
  String get viewAll;

  /// No description provided for @postOffer.
  ///
  /// In en, this message translates to:
  /// **'Post an Offer'**
  String get postOffer;

  /// No description provided for @statsOffers.
  ///
  /// In en, this message translates to:
  /// **'Offers'**
  String get statsOffers;

  /// No description provided for @statsApplied.
  ///
  /// In en, this message translates to:
  /// **'Applied'**
  String get statsApplied;

  /// No description provided for @statsInterviews.
  ///
  /// In en, this message translates to:
  /// **'Interviews'**
  String get statsInterviews;

  /// No description provided for @statsViews.
  ///
  /// In en, this message translates to:
  /// **'Views'**
  String get statsViews;

  /// No description provided for @statsScore.
  ///
  /// In en, this message translates to:
  /// **'Score'**
  String get statsScore;

  /// No description provided for @completeProfileTitle.
  ///
  /// In en, this message translates to:
  /// **'Complete Profile'**
  String get completeProfileTitle;

  /// No description provided for @lastStepTitle.
  ///
  /// In en, this message translates to:
  /// **'Last step ✨'**
  String get lastStepTitle;

  /// No description provided for @lastStepSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Tell us a bit more about yourself...'**
  String get lastStepSubtitle;

  /// No description provided for @profilePhoto.
  ///
  /// In en, this message translates to:
  /// **'Profil picture'**
  String get profilePhoto;

  /// No description provided for @location.
  ///
  /// In en, this message translates to:
  /// **'Location'**
  String get location;

  /// No description provided for @specialty.
  ///
  /// In en, this message translates to:
  /// **'Specialty'**
  String get specialty;

  /// No description provided for @isStudentQuestion.
  ///
  /// In en, this message translates to:
  /// **'Are you currently a student?'**
  String get isStudentQuestion;

  /// No description provided for @isEngineerQuestion.
  ///
  /// In en, this message translates to:
  /// **'Are you an engineer?'**
  String get isEngineerQuestion;

  /// No description provided for @bioHint.
  ///
  /// In en, this message translates to:
  /// **'Bio (Tell us about your journey...)'**
  String get bioHint;

  /// No description provided for @finalizeProfileButton.
  ///
  /// In en, this message translates to:
  /// **'Finalize my profile'**
  String get finalizeProfileButton;

  /// No description provided for @photoOptional.
  ///
  /// In en, this message translates to:
  /// **'Optional'**
  String get photoOptional;

  /// No description provided for @addSkillsTitle.
  ///
  /// In en, this message translates to:
  /// **'Add Skills'**
  String get addSkillsTitle;

  /// No description provided for @addSkillsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Enter your skills or choose from suggestions:'**
  String get addSkillsSubtitle;

  /// No description provided for @skillsHint.
  ///
  /// In en, this message translates to:
  /// **'Ex: TypeScript, CSS...'**
  String get skillsHint;

  /// No description provided for @add.
  ///
  /// In en, this message translates to:
  /// **'Add'**
  String get add;

  /// No description provided for @yes.
  ///
  /// In en, this message translates to:
  /// **'Yes'**
  String get yes;

  /// No description provided for @no.
  ///
  /// In en, this message translates to:
  /// **'No'**
  String get no;

  /// No description provided for @back.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get back;

  /// No description provided for @success.
  ///
  /// In en, this message translates to:
  /// **'Success'**
  String get success;

  /// No description provided for @error.
  ///
  /// In en, this message translates to:
  /// **'Error'**
  String get error;

  /// No description provided for @profilePhotoUpdated.
  ///
  /// In en, this message translates to:
  /// **'Profile photo updated successfully!'**
  String get profilePhotoUpdated;

  /// No description provided for @skillsUpdated.
  ///
  /// In en, this message translates to:
  /// **'Skills updated!'**
  String get skillsUpdated;

  /// No description provided for @fileTooLarge.
  ///
  /// In en, this message translates to:
  /// **'File too large'**
  String get fileTooLarge;

  /// No description provided for @unsupportedFormat.
  ///
  /// In en, this message translates to:
  /// **'Unsupported format'**
  String get unsupportedFormat;

  /// No description provided for @deleteCv.
  ///
  /// In en, this message translates to:
  /// **'Delete CV?'**
  String get deleteCv;

  /// No description provided for @deleteCvConfirmation.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to delete your CV?'**
  String get deleteCvConfirmation;

  /// No description provided for @delete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get delete;

  /// No description provided for @cvDeleted.
  ///
  /// In en, this message translates to:
  /// **'CV deleted successfully'**
  String get cvDeleted;

  /// No description provided for @uploading.
  ///
  /// In en, this message translates to:
  /// **'Uploading...'**
  String get uploading;

  /// No description provided for @accountSecurity.
  ///
  /// In en, this message translates to:
  /// **'ACCOUNT SECURITY'**
  String get accountSecurity;

  /// No description provided for @changePassword.
  ///
  /// In en, this message translates to:
  /// **'Change Password'**
  String get changePassword;

  /// No description provided for @changePasswordSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Strengthen your access security'**
  String get changePasswordSubtitle;

  /// No description provided for @emailVerification.
  ///
  /// In en, this message translates to:
  /// **'Email Verification'**
  String get emailVerification;

  /// No description provided for @emailVerifiedSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your account is currently verified'**
  String get emailVerifiedSubtitle;

  /// No description provided for @globalLogout.
  ///
  /// In en, this message translates to:
  /// **'Global Logout'**
  String get globalLogout;

  /// No description provided for @globalLogoutSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Log out from all devices'**
  String get globalLogoutSubtitle;

  /// No description provided for @globalLogoutDialogTitle.
  ///
  /// In en, this message translates to:
  /// **'Global Logout'**
  String get globalLogoutDialogTitle;

  /// No description provided for @globalLogoutDialogContent.
  ///
  /// In en, this message translates to:
  /// **'Do you really want to log out from all connected devices?'**
  String get globalLogoutDialogContent;

  /// No description provided for @preferences.
  ///
  /// In en, this message translates to:
  /// **'PREFERENCES'**
  String get preferences;

  /// No description provided for @appLanguage.
  ///
  /// In en, this message translates to:
  /// **'App Language'**
  String get appLanguage;

  /// No description provided for @currentLanguage.
  ///
  /// In en, this message translates to:
  /// **'Currently: {lang}'**
  String currentLanguage(Object lang);

  /// No description provided for @dangerZone.
  ///
  /// In en, this message translates to:
  /// **'DANGER ZONE'**
  String get dangerZone;

  /// No description provided for @deactivateAccount.
  ///
  /// In en, this message translates to:
  /// **'Deactivate Account'**
  String get deactivateAccount;

  /// No description provided for @deactivateAccountSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Temporarily hide your profile'**
  String get deactivateAccountSubtitle;

  /// No description provided for @deactivateAccountDialogTitle.
  ///
  /// In en, this message translates to:
  /// **'Deactivate Account'**
  String get deactivateAccountDialogTitle;

  /// No description provided for @deactivateAccountDialogContent.
  ///
  /// In en, this message translates to:
  /// **'Your profile will no longer be visible to recruiters. You can reactivate it at any time by logging in.'**
  String get deactivateAccountDialogContent;

  /// No description provided for @deleteAccountPermanent.
  ///
  /// In en, this message translates to:
  /// **'Delete Permanently'**
  String get deleteAccountPermanent;

  /// No description provided for @deleteAccountSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Irreversible action on your data'**
  String get deleteAccountSubtitle;

  /// No description provided for @deleteAccountDialogTitle.
  ///
  /// In en, this message translates to:
  /// **'Permanent Deletion'**
  String get deleteAccountDialogTitle;

  /// No description provided for @deleteAccountDialogContent.
  ///
  /// In en, this message translates to:
  /// **'All your data will be erased. This action is irreversible.'**
  String get deleteAccountDialogContent;

  /// No description provided for @languageChanged.
  ///
  /// In en, this message translates to:
  /// **'Language changed to {lang}'**
  String languageChanged(Object lang);

  /// No description provided for @accountDeactivated.
  ///
  /// In en, this message translates to:
  /// **'Account deactivated successfully'**
  String get accountDeactivated;

  /// No description provided for @deleteRequestSent.
  ///
  /// In en, this message translates to:
  /// **'Deletion request sent.'**
  String get deleteRequestSent;

  /// No description provided for @logoutAllSuccess.
  ///
  /// In en, this message translates to:
  /// **'Logged out from all devices successfully.'**
  String get logoutAllSuccess;

  /// No description provided for @editProfileTitle.
  ///
  /// In en, this message translates to:
  /// **'Edit Profile'**
  String get editProfileTitle;

  /// No description provided for @basicInfo.
  ///
  /// In en, this message translates to:
  /// **'Basic Information'**
  String get basicInfo;

  /// No description provided for @basicInfoSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Update your personal information.'**
  String get basicInfoSubtitle;

  /// No description provided for @fullName.
  ///
  /// In en, this message translates to:
  /// **'Full Name'**
  String get fullName;

  /// No description provided for @yourNameHint.
  ///
  /// In en, this message translates to:
  /// **'Your Name'**
  String get yourNameHint;

  /// No description provided for @yourEmailHint.
  ///
  /// In en, this message translates to:
  /// **'your@email.com'**
  String get yourEmailHint;

  /// No description provided for @phoneNumber.
  ///
  /// In en, this message translates to:
  /// **'Phone Number'**
  String get phoneNumber;

  /// No description provided for @selectCity.
  ///
  /// In en, this message translates to:
  /// **'Select your city'**
  String get selectCity;

  /// No description provided for @saveChanges.
  ///
  /// In en, this message translates to:
  /// **'Save Changes'**
  String get saveChanges;

  /// No description provided for @infoUpdated.
  ///
  /// In en, this message translates to:
  /// **'Information updated!'**
  String get infoUpdated;

  /// No description provided for @updatePassword.
  ///
  /// In en, this message translates to:
  /// **'Update Password'**
  String get updatePassword;

  /// No description provided for @passwordUpdatedSuccess.
  ///
  /// In en, this message translates to:
  /// **'Your password has been updated successfully.'**
  String get passwordUpdatedSuccess;

  /// No description provided for @currentPassword.
  ///
  /// In en, this message translates to:
  /// **'Current Password'**
  String get currentPassword;

  /// No description provided for @enterCurrentPassword.
  ///
  /// In en, this message translates to:
  /// **'Enter your current password'**
  String get enterCurrentPassword;

  /// No description provided for @newPassword.
  ///
  /// In en, this message translates to:
  /// **'New Password'**
  String get newPassword;

  /// No description provided for @enterNewPassword.
  ///
  /// In en, this message translates to:
  /// **'Please enter a new password'**
  String get enterNewPassword;

  /// No description provided for @confirmNewPassword.
  ///
  /// In en, this message translates to:
  /// **'Confirm New Password'**
  String get confirmNewPassword;

  /// No description provided for @repeatNewPassword.
  ///
  /// In en, this message translates to:
  /// **'Repeat new password'**
  String get repeatNewPassword;

  /// No description provided for @passwordSecurityInfo.
  ///
  /// In en, this message translates to:
  /// **'For security reasons, we recommend using a unique password that you do not use on other sites.'**
  String get passwordSecurityInfo;

  /// No description provided for @ok.
  ///
  /// In en, this message translates to:
  /// **'OK'**
  String get ok;

  /// No description provided for @confirm.
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get confirm;

  /// No description provided for @passwordStrength.
  ///
  /// In en, this message translates to:
  /// **'Password Strength'**
  String get passwordStrength;

  /// No description provided for @strengthWeak.
  ///
  /// In en, this message translates to:
  /// **'Weak'**
  String get strengthWeak;

  /// No description provided for @strengthFair.
  ///
  /// In en, this message translates to:
  /// **'Fair'**
  String get strengthFair;

  /// No description provided for @strengthGood.
  ///
  /// In en, this message translates to:
  /// **'Good'**
  String get strengthGood;

  /// No description provided for @strengthStrong.
  ///
  /// In en, this message translates to:
  /// **'Strong'**
  String get strengthStrong;

  /// No description provided for @passwordsMatch.
  ///
  /// In en, this message translates to:
  /// **'Passwords Match'**
  String get passwordsMatch;

  /// No description provided for @viewPicture.
  ///
  /// In en, this message translates to:
  /// **'View picture'**
  String get viewPicture;

  /// No description provided for @changePicture.
  ///
  /// In en, this message translates to:
  /// **'Change picture'**
  String get changePicture;

  /// No description provided for @calendar.
  ///
  /// In en, this message translates to:
  /// **'CALENDAR'**
  String get calendar;

  /// No description provided for @selectYear.
  ///
  /// In en, this message translates to:
  /// **'Select Year'**
  String get selectYear;

  /// No description provided for @pleaseWaitUploading.
  ///
  /// In en, this message translates to:
  /// **'Please wait while uploading...'**
  String get pleaseWaitUploading;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['ar', 'en', 'fr'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ar':
      return AppLocalizationsAr();
    case 'en':
      return AppLocalizationsEn();
    case 'fr':
      return AppLocalizationsFr();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
