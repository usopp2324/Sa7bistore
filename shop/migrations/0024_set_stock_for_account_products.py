# Set stock for existing account category products

from django.db import migrations


def set_stock_for_account_products(apps, schema_editor):
    Product = apps.get_model('shop', 'Product')
    # Set stock to 1 for products in account categories
    Product.objects.filter(
        category__name__iexact='accounts'
    ).update(stock=1)
    Product.objects.filter(
        category__name__iexact='account'
    ).update(stock=1)


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0023_add_product_stock'),
    ]

    operations = [
        migrations.RunPython(set_stock_for_account_products),
    ]