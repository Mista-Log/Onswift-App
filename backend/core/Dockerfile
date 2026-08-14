# syntax=docker/dockerfile:1
FROM python:3.11-slim

# Unbuffered stdout/stderr so logs show up promptly in Cloud Run / Cloud Logging.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
# This file has been observed round-tripping to UTF-16 (a Windows PowerShell `>` redirection
# habit) between dev-machine edits, which pip's installer cannot parse. Normalize to UTF-8
# before install so the build can't be broken by the source file's encoding again.
RUN python -c "\
import pathlib; \
p = pathlib.Path('requirements.txt'); \
data = p.read_bytes(); \
is_utf16 = data[:2] in (b'\xff\xfe', b'\xfe\xff') or (len(data) > 1 and data[1] == 0); \
text = data.decode('utf-16') if is_utf16 else data.decode('utf-8'); \
p.write_text(text, encoding='utf-8')"
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

# Bake static assets into the image; served at runtime by whitenoise.
# DATABASE_URL/CLOUDINARY_* aren't needed for this step (collectstatic doesn't touch the DB
# or upload media), so no secrets need to be available at build time.
RUN python manage.py collectstatic --noinput

# Cloud Run injects $PORT at runtime; 8080 is the default for local `docker run`.
ENV PORT=8080
EXPOSE 8080

CMD exec gunicorn core.wsgi:application --bind 0.0.0.0:${PORT} --workers 2 --threads 4 --timeout 60
