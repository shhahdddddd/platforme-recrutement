<!DOCTYPE html>
<html>

<head>
    <title>Félicitations ! Votre candidature a été acceptée</title>
</head>

<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc;">
    <div style="max-width: 600px; margin: 40px auto; padding: 0;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #10B981, #3B82F6); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: #ffffff; font-size: 24px; margin: 0;">RecrutiTN</h1>
            <p style="color: rgba(255,255,255,0.8); font-size: 13px; margin: 5px 0 0;">Plateforme de recrutement intelligente</p>
        </div>

        <!-- Body -->
        <div style="background: #ffffff; padding: 35px 30px; border: 1px solid #e2e8f0; border-top: none;">
            <h2 style="color: #065f46; font-size: 20px; margin: 0 0 20px;">Excellente nouvelle !</h2>

            <p>Bonjour <strong>{{ $candidateName }}</strong>,</p>

            <p>Nous avons le plaisir de vous informer que votre candidature pour le poste de
                <strong>{{ $jobTitle }}</strong> chez <strong>{{ $companyName }}</strong> a été 
                <strong style="color: #10B981;">acceptée</strong>.
            </p>

            <div style="background: #ecfdf5; border-left: 4px solid #10B981; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 25px 0;">
                <p style="margin: 0; color: #065f46; font-weight: 600;">
                    Félicitations ! Votre profil a convaincu l'équipe de recrutement.
                </p>
            </div>

            <p>Nous sommes impatients de vous accueillir. Un membre de l'équipe RH de <strong>{{ $companyName }}</strong> vous contactera prochainement pour discuter des prochaines étapes de votre intégration.</p>

            <p>Vous pouvez également consulter le statut de votre candidature et vos messages directement sur l'application mobile RecrutiTN.</p>

            <p style="margin-top: 30px;">Cordialement,<br>
                <strong>L'équipe RH de {{ $companyName }}</strong>
            </p>
        </div>

        <!-- Footer -->
        <div style="background: #f1f5f9; padding: 20px 30px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0; border-top: none; text-align: center;">
            <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                &copy; {{ date('Y') }} RecrutiTN. Tous droits réservés.
            </p>
            <p style="font-size: 11px; color: #cbd5e1; margin: 5px 0 0;">
                Cet e-mail a été envoyé automatiquement. Merci de ne pas y répondre.
            </p>
        </div>
    </div>
</body>

</html>
