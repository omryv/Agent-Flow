#!/usr/bin/env bash
set -e
HTML="public/index.html"

for f in public/js/*.js; do
  filename=$(basename "$f")
  hash="sha384-$(openssl dgst -sha384 -binary "$f" | openssl base64 -A)"
  sed -i "s|src=\"/js/${filename}\" integrity=\"sha384-[^\"]*\"|src=\"/js/${filename}\" integrity=\"${hash}\"|" "$HTML"
done

echo "SRI hashes injected."
