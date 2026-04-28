from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_quizsession_seniority_level'),
    ]

    operations = [
        migrations.AddField(
            model_name='quizquestion',
            name='hr_approved',
            field=models.BooleanField(default=False),
        ),
    ]
