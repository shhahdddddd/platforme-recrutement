<!DOCTYPE html>
<html>

<head>
    <title>Alerte de sécurité - Mot de passe modifié</title>
</head>

<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #DC2626; text-align: center;">🔒 Alerte de sécurité</h2>
        
        <p>Bonjour {{ $user->email }},</p>
        
        <p>Nous vous informons que le mot de passe de votre compte <strong>RecrutiTN</strong> a été modifié.</p>
        
        <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <p style="margin: 0;"><strong>Détails de la modification :</strong></p>
            <ul style="margin: 10px 0;">
                <li><strong>Type de compte :</strong> {{ $userType }}</li>
                <li><strong>Date et heure :</strong> {{ $changedAt }}</li>
                <li><strong>Adresse e-mail :</strong> {{ $user->email }}</li>
            </ul>
        </div>
        
        <p style="color: #DC2626; font-weight: bold;">⚠️ Si vous n'êtes pas à l'origine de cette modification, veuillez immédiatement :</p>
        <ol>
            <li>Réinitialiser votre mot de passe en cliquant sur "Mot de passe oublié" sur la page de connexion</li>
            <li>Contacter notre équipe de support si vous suspectez une activité suspecte</li>
        </ol>
        
        <p>Si vous êtes bien l'auteur de cette modification, vous pouvez ignorer cet e-mail.</p>
        
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        
        <p style="font-size: 12px; color: #888; text-align: center;">
            &copy; {{ date('Y') }} RecrutiTN. Tous droits réservés.<br>
            Cet e-mail a été envoyé automatiquement pour la sécurité de votre compte.
        </p>
    </div>
</body>

</html>
