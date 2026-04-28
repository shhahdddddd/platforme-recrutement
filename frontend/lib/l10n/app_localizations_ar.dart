// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String get appTitle => 'تطبيق التوظيف';

  @override
  String get login => 'تسجيل الدخول';

  @override
  String get loginTitleAesthetic => 'Log in to access your space';

  @override
  String get register => 'إنشاء حساب';

  @override
  String get email => 'البريد الإلكتروني';

  @override
  String get password => 'كلمة المرور';

  @override
  String get forgotPassword => 'نسيت كلمة المرور؟';

  @override
  String get home => 'الرئيسية';

  @override
  String get profile => 'الملف الشخصي';

  @override
  String get settings => 'الإعدادات';

  @override
  String get welcome => 'مرحباً!';

  @override
  String get loading => 'Loading...';

  @override
  String welcomeUser(Object name) {
    return 'مرحباً $name!';
  }

  @override
  String get welcomeBackTitle => 'أهلاً بعودتك! 🎉';

  @override
  String get welcomeBackSubtitle =>
      'سجل الدخول للوصول إلى مساحة التوظيف الخاصة بك.';

  @override
  String get emailHint => 'البريد الإلكتروني';

  @override
  String get passwordHint => 'كلمة المرور';

  @override
  String get emailRequired => 'البريد الإلكتروني مطلوب';

  @override
  String get passwordRequired => 'كلمة المرور مطلوبة';

  @override
  String get loginButton => 'تسجيل الدخول';

  @override
  String get newHere => 'جديد هنا؟';

  @override
  String get createAccount => 'إنشاء حساب';

  @override
  String get letsStartTitle => 'لنبدأ! 🚀';

  @override
  String get letsStartSubtitle => 'أنشئ حسابك في ثوانٍ للانضمام إلى المغامرة.';

  @override
  String get fullNameHint => 'الاسم الكامل';

  @override
  String get nameRequired => 'الاسم مطلوب';

  @override
  String get passwordMinLength => 'على الأقل 8 أحرف';

  @override
  String get confirmPasswordHint => 'تأكيد كلمة المرور';

  @override
  String get passwordsDoNotMatch => 'كلمات المرور غير متطابقة';

  @override
  String get chooseProfile => 'اختر ملفك الشخصي';

  @override
  String get roleCandidate => 'مرشح';

  @override
  String get continueButton => 'استمرار';

  @override
  String get alreadyRegistered => 'مسجل بالفعل؟';

  @override
  String get emailInUse => 'هذا البريد الإلكتروني مستخدم بالفعل.';

  @override
  String get resetPasswordTitle => 'إعادة تعيين كلمة المرور';

  @override
  String get resetPasswordSubtitle =>
      'Enter your email to receive a password reset link and create a new secure password.';

  @override
  String get resetPasswordSuccess =>
      'تم إعادة تعيين كلمة المرور بنجاح! سجل الدخول.';

  @override
  String get newPasswordHint => 'كلمة مرور جديدة';

  @override
  String get cancelButton => 'إلغاء';

  @override
  String greeting(Object name) {
    return 'مرحباً $name 🎉';
  }

  @override
  String get greetingSubtitle => 'جاهز لفرص جديدة؟';

  @override
  String get dashboard => 'لوحة التحكم';

  @override
  String get myProfile => 'ملفي الشخصي';

  @override
  String get favorites => 'المفضلة';

  @override
  String get messages => 'الرسائل';

  @override
  String get logout => 'تسجيل الخروج';

  @override
  String get featuredCompanies => 'شركات مميزة';

  @override
  String get topTalents => 'أفضل المواهب لك';

  @override
  String get recommendedOffers => 'عروض موصى بها';

  @override
  String get viewAll => 'عرض الكل';

  @override
  String get postOffer => 'نشر عرض';

  @override
  String get statsOffers => 'عروض';

  @override
  String get statsApplied => 'تم التقديم';

  @override
  String get statsInterviews => 'مقابلات';

  @override
  String get statsViews => 'مشاهدات';

  @override
  String get statsScore => 'النتيجة';

  @override
  String get completeProfileTitle => 'إكمال الملف الشخصي';

  @override
  String get lastStepTitle => 'الخطوة الأخيرة 🏁';

  @override
  String get lastStepSubtitle => 'أخبرنا المزيد عن نفسك...';

  @override
  String get profilePhoto => 'صورة الملف الشخصي';

  @override
  String get location => 'الموقع';

  @override
  String get specialty => 'التخصص';

  @override
  String get isStudentQuestion => 'هل أنت طالب حالياً؟';

  @override
  String get isEngineerQuestion => 'هل أنت مهندس؟';

  @override
  String get bioHint => 'السيرة الذاتية (أخبرنا عن رحلتك...)';

  @override
  String get finalizeProfileButton => 'إنهاء ملفي الشخصي';

  @override
  String get photoOptional => 'اختياري';

  @override
  String get addSkillsTitle => 'إضافة مهارات';

  @override
  String get addSkillsSubtitle => 'أدخل مهاراتك أو اختر من الاقتراحات:';

  @override
  String get skillsHint => 'مثال: TypeScript، CSS...';

  @override
  String get add => 'إضافة';

  @override
  String get yes => 'نعم';

  @override
  String get no => 'لا';

  @override
  String get back => 'عودة';

  @override
  String get success => 'نجاح';

  @override
  String get error => 'خطأ';

  @override
  String get profilePhotoUpdated => 'تم تحديث صورة الملف الشخصي بنجاح!';

  @override
  String get skillsUpdated => 'تم تحديث المهارات!';

  @override
  String get fileTooLarge => 'الملف كبير جداً';

  @override
  String get unsupportedFormat => 'تنسيق غير مدعوم';

  @override
  String get deleteCv => 'حذف السيرة الذاتية؟';

  @override
  String get deleteCvConfirmation => 'هل أنت متأكد أنك تريد حذف سيرتك الذاتية؟';

  @override
  String get delete => 'حذف';

  @override
  String get cvDeleted => 'تم حذف السيرة الذاتية بنجاح';

  @override
  String get uploading => 'جار التحميل...';

  @override
  String get accountSecurity => 'أمان الحساب';

  @override
  String get changePassword => 'تغيير كلمة المرور';

  @override
  String get changePasswordSubtitle => 'عزز أمان وصولك';

  @override
  String get emailVerification => 'التحقق من البريد الإلكتروني';

  @override
  String get emailVerifiedSubtitle => 'حسابك تم التحقق منه حالياً';

  @override
  String get globalLogout => 'تسجيل خروج عالمي';

  @override
  String get globalLogoutSubtitle => 'تسجيل الخروج من جميع الأجهزة';

  @override
  String get globalLogoutDialogTitle => 'تسجيل خروج عالمي';

  @override
  String get globalLogoutDialogContent =>
      'هل تريد حقاً تسجيل الخروج من جميع الأجهزة المتصلة؟';

  @override
  String get preferences => 'التفضيلات';

  @override
  String get appLanguage => 'لغة التطبيق';

  @override
  String currentLanguage(Object lang) {
    return 'حالياً: $lang';
  }

  @override
  String get dangerZone => 'منطقة الخطر';

  @override
  String get deactivateAccount => 'تعطيل الحساب';

  @override
  String get deactivateAccountSubtitle => 'إخفاء ملفك الشخصي مؤقتاً';

  @override
  String get deactivateAccountDialogTitle => 'تعطيل الحساب';

  @override
  String get deactivateAccountDialogContent =>
      'لن يكون ملفك الشخصي مرئياً للشركات. يمكنك إعادة تفعيله في أي وقت بتسجيل الدخول.';

  @override
  String get deleteAccountPermanent => 'حذف نهائي';

  @override
  String get deleteAccountSubtitle => 'إجراء لا رجعة فيه على بياناتك';

  @override
  String get deleteAccountDialogTitle => 'حذف نهائي';

  @override
  String get deleteAccountDialogContent =>
      'سيتم مسح جميع بياناتك. هذا الإجراء لا رجعة فيه.';

  @override
  String languageChanged(Object lang) {
    return 'تم تغيير اللغة إلى $lang';
  }

  @override
  String get accountDeactivated => 'تم تعطيل الحساب بنجاح';

  @override
  String get deleteRequestSent => 'تم إرسال طلب الحذف.';

  @override
  String get logoutAllSuccess => 'تم تسجيل الخروج من جميع الأجهزة بنجاح.';

  @override
  String get editProfileTitle => 'تعديل الملف الشخصي';

  @override
  String get basicInfo => 'المعلومات الأساسية';

  @override
  String get basicInfoSubtitle => 'تحديث معلوماتك الشخصية.';

  @override
  String get fullName => 'الاسم الكامل';

  @override
  String get yourNameHint => 'اسمك';

  @override
  String get yourEmailHint => 'example@email.com';

  @override
  String get phoneNumber => 'رقم الهاتف';

  @override
  String get selectCity => 'اختر مدينتك';

  @override
  String get saveChanges => 'حفظ التغييرات';

  @override
  String get infoUpdated => 'تم تحديث المعلومات!';

  @override
  String get updatePassword => 'تحديث كلمة المرور';

  @override
  String get passwordUpdatedSuccess => 'تم تحديث كلمة المرور الخاصة بك بنجاح.';

  @override
  String get currentPassword => 'كلمة المرور الحالية';

  @override
  String get enterCurrentPassword => 'أدخل كلمة المرور الحالية';

  @override
  String get newPassword => 'كلمة مرور جديدة';

  @override
  String get enterNewPassword => 'الرجاء إدخال كلمة مرور جديدة';

  @override
  String get confirmNewPassword => 'تأكيد كلمة المرور الجديدة';

  @override
  String get repeatNewPassword => 'كرر كلمة المرور الجديدة';

  @override
  String get passwordSecurityInfo =>
      'لأسباب أمنية، نوصي باستخدام كلمة مرور فريدة لا تستخدمها في مواقع أخرى.';

  @override
  String get ok => 'موافق';

  @override
  String get confirm => 'تأكيد';

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
