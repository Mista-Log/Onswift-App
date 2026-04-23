#!/usr/bin/env bash

echo "Applying migrations..."
python manage.py migrate

echo "Creating superuser if not exists..."

python manage.py shell << END
from django.contrib.auth import get_user_model
import os

User = get_user_model()

username = os.environ.get("DJANGO_SUPERUSER_USERNAME")
email = os.environ.get("DJANGO_SUPERUSER_EMAIL")
password = os.environ.get("DJANGO_SUPERUSER_PASSWORD")

if username and password:
    if not User.objects.filter(username=username).exists():
        print("Creating superuser...")
        User.objects.create_superuser(username=username, email=email, password=password)
    else:
        print("Superuser already exists.")
else:
    print("Superuser env variables not set. Skipping.")
END

echo "Starting server..."
gunicorn core.wsgi:application --bind 0.0.0.0:$PORT