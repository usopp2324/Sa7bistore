from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0017_add_subscription_fields'),
    ]

    operations = [
        migrations.AlterField(
            model_name='product',
            name='subscription_options',
            field=models.JSONField(blank=True, default=list, null=True),
        ),
    ]
