# Generated manually for adding stock field to Product model

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0022_category_alter_product_category'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='stock',
            field=models.PositiveIntegerField(blank=True, help_text='Available stock quantity. 0 means unlimited for non-account products.', null=True),
        ),
    ]