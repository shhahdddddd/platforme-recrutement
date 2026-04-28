from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='quizsession',
            name='job_title',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='quizsession',
            name='job_description',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='quizsession',
            name='job_skills',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='quizsession',
            name='job_offer_type',
            field=models.CharField(blank=True, default='job', max_length=50),
        ),
    ]