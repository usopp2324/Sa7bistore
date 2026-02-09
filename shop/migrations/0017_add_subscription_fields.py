from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0016_merge_0015_alter_order_order_id_0015_product_images'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='subscription_options',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='orderitem',
            name='subscription_code',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='orderitem',
            name='subscription_label',
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name='orderitem',
            name='subscription_duration_days',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
