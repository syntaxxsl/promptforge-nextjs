#!/bin/sh
# Bind Next.js dev server to localhost and keep the configured webpack path.
exec ./node_modules/.bin/next dev --webpack -H 127.0.0.1
