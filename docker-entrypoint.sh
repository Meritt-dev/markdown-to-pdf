#!/bin/sh
set -e

echo "Starting Next.js app and worker..."

npm run start &
npm run worker &

wait -n

exit $?
