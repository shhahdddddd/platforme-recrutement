<!DOCTYPE html>
<html>

<head>
    <title>Ton code de vérification</title>
</head>

<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #6366F1; text-align: center;">Vérification de ton compte</h2>
        <p>Bonjour,</p>
        <p>Merci de rejoindre <strong>RecrutiTN</strong>. Pour finaliser ton inscription, utilise le code de
            vérification suivant :</p>
        <div style="text-align: center; margin: 30px 0;">
            <span
                style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #6366F1; background: #F3F4F6; padding: 10px 20px; border-radius: 5px; border: 1px dashed #6366F1;">
                {{ $otp }}
            </span>
        </div>
        <p>Ce code expirera dans 10 minutes.</p>
        <p>Si tu n'as pas demandé ce code, tu peux ignorer cet e-mail en toute sécurité.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #888; text-align: center;">
            &copy; {{ date('Y') }} RecrutiTN. Tous droits réservés.
        </p>
    </div>
</body>

</html>