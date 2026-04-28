// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'Recruitment App';

  @override
  String get login => 'Login';

  @override
  String get loginTitleAesthetic => 'Log in to access your space';

  @override
  String get register => 'Register';

  @override
  String get email => 'Email';

  @override
  String get password => 'Password';

  @override
  String get forgotPassword => 'Forgot Password?';

  @override
  String get home => 'Home';

  @override
  String get profile => 'Profile';

  @override
  String get settings => 'Settings';

  @override
  String get welcome => 'Welcome back!';

  @override
  String get loading => 'Loading...';

  @override
  String welcomeUser(Object name) {
    return 'Welcome, $name!';
  }

  @override
  String get welcomeBackTitle => 'Welcome back! 👋';

  @override
  String get welcomeBackSubtitle => 'Log in to access your recruitment space.';

  @override
  String get emailHint => 'Email';

  @override
  String get passwordHint => 'Password';

  @override
  String get emailRequired => 'Please enter your email address.';

  @override
  String get passwordRequired => 'Please enter your password.';

  @override
  String get loginButton => 'Login';

  @override
  String get newHere => 'New here? ';

  @override
  String get createAccount => 'Create account';

  @override
  String get letsStartTitle => 'Let\'s get started! 🚀';

  @override
  String get letsStartSubtitle =>
      'Create your account in seconds to join the adventure.';

  @override
  String get fullNameHint => 'Full Name';

  @override
  String get nameRequired => 'Please enter your full name.';

  @override
  String get passwordMinLength => 'Minimum 8 characters';

  @override
  String get confirmPasswordHint => 'Confirm Password';

  @override
  String get passwordsDoNotMatch => 'Passwords do not match';

  @override
  String get chooseProfile => 'Choose your profile';

  @override
  String get roleCandidate => 'Candidate';

  @override
  String get continueButton => 'Continue';

  @override
  String get alreadyRegistered => 'Already registered? ';

  @override
  String get emailInUse => 'This email is already in use.';

  @override
  String get resetPasswordTitle => 'Reset Password';

  @override
  String get resetPasswordSubtitle =>
      'Enter your email to receive a password reset link and create a new secure password.';

  @override
  String get resetPasswordSuccess => 'Password reset successfully! Log in.';

  @override
  String get newPasswordHint => 'New Password';

  @override
  String get cancelButton => 'Cancel';

  @override
  String greeting(Object name) {
    return 'Hello, $name 👋';
  }

  @override
  String get greetingSubtitle => 'Ready for new opportunities?';

  @override
  String get dashboard => 'Dashboard';

  @override
  String get myProfile => 'My Profile';

  @override
  String get favorites => 'Favorites';

  @override
  String get messages => 'Messages';

  @override
  String get logout => 'Logout';

  @override
  String get featuredCompanies => 'Featured Companies';

  @override
  String get topTalents => 'Top Talents for you';

  @override
  String get recommendedOffers => 'Recommended Offers';

  @override
  String get viewAll => 'View All';

  @override
  String get postOffer => 'Post an Offer';

  @override
  String get statsOffers => 'Offers';

  @override
  String get statsApplied => 'Applied';

  @override
  String get statsInterviews => 'Interviews';

  @override
  String get statsViews => 'Views';

  @override
  String get statsScore => 'Score';

  @override
  String get completeProfileTitle => 'Complete Profile';

  @override
  String get lastStepTitle => 'Last step ✨';

  @override
  String get lastStepSubtitle => 'Tell us a bit more about yourself...';

  @override
  String get profilePhoto => 'Profil picture';

  @override
  String get location => 'Location';

  @override
  String get specialty => 'Specialty';

  @override
  String get isStudentQuestion => 'Are you currently a student?';

  @override
  String get isEngineerQuestion => 'Are you an engineer?';

  @override
  String get bioHint => 'Bio (Tell us about your journey...)';

  @override
  String get finalizeProfileButton => 'Finalize my profile';

  @override
  String get photoOptional => 'Optional';

  @override
  String get addSkillsTitle => 'Add Skills';

  @override
  String get addSkillsSubtitle =>
      'Enter your skills or choose from suggestions:';

  @override
  String get skillsHint => 'Ex: TypeScript, CSS...';

  @override
  String get add => 'Add';

  @override
  String get yes => 'Yes';

  @override
  String get no => 'No';

  @override
  String get back => 'Back';

  @override
  String get success => 'Success';

  @override
  String get error => 'Error';

  @override
  String get profilePhotoUpdated => 'Profile photo updated successfully!';

  @override
  String get skillsUpdated => 'Skills updated!';

  @override
  String get fileTooLarge => 'File too large';

  @override
  String get unsupportedFormat => 'Unsupported format';

  @override
  String get deleteCv => 'Delete CV?';

  @override
  String get deleteCvConfirmation => 'Are you sure you want to delete your CV?';

  @override
  String get delete => 'Delete';

  @override
  String get cvDeleted => 'CV deleted successfully';

  @override
  String get uploading => 'Uploading...';

  @override
  String get accountSecurity => 'ACCOUNT SECURITY';

  @override
  String get changePassword => 'Change Password';

  @override
  String get changePasswordSubtitle => 'Strengthen your access security';

  @override
  String get emailVerification => 'Email Verification';

  @override
  String get emailVerifiedSubtitle => 'Your account is currently verified';

  @override
  String get globalLogout => 'Global Logout';

  @override
  String get globalLogoutSubtitle => 'Log out from all devices';

  @override
  String get globalLogoutDialogTitle => 'Global Logout';

  @override
  String get globalLogoutDialogContent =>
      'Do you really want to log out from all connected devices?';

  @override
  String get preferences => 'PREFERENCES';

  @override
  String get appLanguage => 'App Language';

  @override
  String currentLanguage(Object lang) {
    return 'Currently: $lang';
  }

  @override
  String get dangerZone => 'DANGER ZONE';

  @override
  String get deactivateAccount => 'Deactivate Account';

  @override
  String get deactivateAccountSubtitle => 'Temporarily hide your profile';

  @override
  String get deactivateAccountDialogTitle => 'Deactivate Account';

  @override
  String get deactivateAccountDialogContent =>
      'Your profile will no longer be visible to recruiters. You can reactivate it at any time by logging in.';

  @override
  String get deleteAccountPermanent => 'Delete Permanently';

  @override
  String get deleteAccountSubtitle => 'Irreversible action on your data';

  @override
  String get deleteAccountDialogTitle => 'Permanent Deletion';

  @override
  String get deleteAccountDialogContent =>
      'All your data will be erased. This action is irreversible.';

  @override
  String languageChanged(Object lang) {
    return 'Language changed to $lang';
  }

  @override
  String get accountDeactivated => 'Account deactivated successfully';

  @override
  String get deleteRequestSent => 'Deletion request sent.';

  @override
  String get logoutAllSuccess => 'Logged out from all devices successfully.';

  @override
  String get editProfileTitle => 'Edit Profile';

  @override
  String get basicInfo => 'Basic Information';

  @override
  String get basicInfoSubtitle => 'Update your personal information.';

  @override
  String get fullName => 'Full Name';

  @override
  String get yourNameHint => 'Your Name';

  @override
  String get yourEmailHint => 'your@email.com';

  @override
  String get phoneNumber => 'Phone Number';

  @override
  String get selectCity => 'Select your city';

  @override
  String get saveChanges => 'Save Changes';

  @override
  String get infoUpdated => 'Information updated!';

  @override
  String get updatePassword => 'Update Password';

  @override
  String get passwordUpdatedSuccess =>
      'Your password has been updated successfully.';

  @override
  String get currentPassword => 'Current Password';

  @override
  String get enterCurrentPassword => 'Enter your current password';

  @override
  String get newPassword => 'New Password';

  @override
  String get enterNewPassword => 'Please enter a new password';

  @override
  String get confirmNewPassword => 'Confirm New Password';

  @override
  String get repeatNewPassword => 'Repeat new password';

  @override
  String get passwordSecurityInfo =>
      'For security reasons, we recommend using a unique password that you do not use on other sites.';

  @override
  String get ok => 'OK';

  @override
  String get confirm => 'Confirm';

  @override
  String get passwordStrength => 'Password Strength';

  @override
  String get strengthWeak => 'Weak';

  @override
  String get strengthFair => 'Fair';

  @override
  String get strengthGood => 'Good';

  @override
  String get strengthStrong => 'Strong';

  @override
  String get passwordsMatch => 'Passwords Match';

  @override
  String get viewPicture => 'View picture';

  @override
  String get changePicture => 'Change picture';

  @override
  String get calendar => 'CALENDAR';

  @override
  String get selectYear => 'Select Year';

  @override
  String get pleaseWaitUploading => 'Please wait while uploading...';
}
